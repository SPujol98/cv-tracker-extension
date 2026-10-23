// Contract E types (PORTAL-3, PORTAL-11, PRIV-11; A19, A20). The type-level assertions are checked
// by `pnpm typecheck`; the runtime assertions prove the file is DOM-free by compiling it without the
// DOM lib and prove no page-side reader interface lives in core.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  ClassifyTables,
  GenericPreview,
  HostClass,
  OfferDetail,
  PageMarkers,
  PageState,
  PortalAdapter,
  RawSearchItem,
  ReadResult,
  SearchItem,
  SourceId,
} from '../../../src/core/ports/portal.ts';

const root = resolve(import.meta.dirname, '../../..');
const portalFile = join(root, 'src/core/ports/portal.ts');

/**
 * The compiler entry point, resolved through the package (its `exports` map hides `bin/tsc`, so the
 * path comes from the `bin` field) and run with the current Node, not the `.bin` shell shim, which
 * does not exist on every platform.
 */
function tscEntry(): string {
  const manifest = createRequire(import.meta.url).resolve('typescript/package.json');
  const { bin } = JSON.parse(readFileSync(manifest, 'utf8')) as { bin: { tsc: string } };
  return resolve(manifest, '..', bin.tsc);
}

/** Compiles one file with the ES library only: a DOM type in it would be an unknown name. */
function compileWithoutDom(file: string) {
  return spawnSync(
    process.execPath,
    [
      tscEntry(),
      '--noEmit',
      '--strict',
      '--target',
      'es2023',
      '--module',
      'esnext',
      '--moduleResolution',
      'bundler',
      '--allowImportingTsExtensions',
      '--lib',
      'es2023',
      '--types',
      '',
      file,
    ],
    // A neutral cwd: tsc refuses explicit files when the cwd holds a tsconfig.json.
    { encoding: 'utf8', cwd: tmpdir() },
  );
}

describe('portal port types are DOM-free (Contract E)', () => {
  it('compiles with no DOM lib', () => {
    const result = compileWithoutDom(portalFile);
    expect(result.stdout).toBe('');
    expect(result.status).toBe(0);
  });

  it('the check can fail: a DOM type is rejected by the same compile', () => {
    const dir = mkdtempSync(join(tmpdir(), 'portal-dom-'));
    try {
      const probe = join(dir, 'probe.ts');
      writeFileSync(probe, 'export type Bad = { doc: Document };\n');
      const result = compileWithoutDom(probe);
      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain("Cannot find name 'Document'");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps PortalReaders out of src/core', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
      );
    const offenders = walk(join(root, 'src/core')).filter((file) =>
      readFileSync(file, 'utf8').includes('PortalReaders'),
    );
    expect(offenders).toEqual([]);
  });
});

describe('reader results carry ids, never URLs (A19)', () => {
  it('RawSearchItem has exactly id, title, company and an optional location', () => {
    expectTypeOf<keyof RawSearchItem>().toEqualTypeOf<'id' | 'title' | 'company' | 'location'>();
    expectTypeOf<RawSearchItem['location']>().toEqualTypeOf<string | undefined>();
  });

  it('a reader search result exposes no URL field at any level', () => {
    type Ok = Extract<ReadResult<RawSearchItem[]>, { ok: true }>;
    expectTypeOf<keyof Ok['data'][number]>().toEqualTypeOf<
      'id' | 'title' | 'company' | 'location'
    >();
    expectTypeOf<keyof Ok>().toEqualTypeOf<'ok' | 'data' | 'strategy'>();
    type Unreadable = Extract<ReadResult<RawSearchItem[]>, { failure: 'unreadable' }>;
    expectTypeOf<keyof Unreadable>().toEqualTypeOf<'ok' | 'failure' | 'attempted'>();
  });

  it('SearchItem is RawSearchItem plus the worker-built canonicalUrl', () => {
    expectTypeOf<SearchItem>().toMatchTypeOf<RawSearchItem>();
    expectTypeOf<SearchItem['canonicalUrl']>().toEqualTypeOf<string>();
    expectTypeOf<keyof SearchItem>().toEqualTypeOf<keyof RawSearchItem | 'canonicalUrl'>();
  });

  it('GenericPreview holds title and text only, and OfferDetail has no URL', () => {
    expectTypeOf<keyof GenericPreview>().toEqualTypeOf<'title' | 'text'>();
    expectTypeOf<keyof OfferDetail>().toEqualTypeOf<'title' | 'company' | 'location' | 'text'>();
  });
});

describe('closed unions and tables (Contract E)', () => {
  it('SourceId, PageState and HostClass kinds are closed', () => {
    expectTypeOf<SourceId>().toEqualTypeOf<'linkedin' | 'infojobs'>();
    expectTypeOf<PageState>().toEqualTypeOf<
      'ok' | 'login' | 'authwall' | 'checkpoint' | 'rate_limit' | 'unreadable_shell'
    >();
    expectTypeOf<HostClass['kind']>().toEqualTypeOf<'portal' | 'known_ats' | 'unverified'>();
    type Unverified = Extract<HostClass, { kind: 'unverified' }>;
    expectTypeOf<Unverified['reason']>().toEqualTypeOf<
      | 'unparseable'
      | 'not_https'
      | 'userinfo'
      | 'port'
      | 'trailing_dot'
      | 'punycode'
      | 'unknown_host'
    >();
    expectTypeOf<Unverified['host']>().toEqualTypeOf<string | null>();
  });

  it('PageMarkers is five booleans and ClassifyTables is data only', () => {
    expectTypeOf<PageMarkers>().toEqualTypeOf<{
      loginForm: boolean;
      authwall: boolean;
      challenge: boolean;
      contentRoot: boolean;
      noResults: boolean;
    }>();
    expectTypeOf<keyof ClassifyTables>().toEqualTypeOf<
      'loginUrl' | 'authwallUrl' | 'checkpointUrl' | 'rateLimitStatuses'
    >();
  });

  it('PortalAdapter carries idPattern and canonicalFor (A19)', () => {
    expectTypeOf<PortalAdapter['idPattern']>().toEqualTypeOf<RegExp>();
    expectTypeOf<PortalAdapter['canonicalFor']>().toEqualTypeOf<(id: string) => string | null>();
    expectTypeOf<PortalAdapter['readerScript']>().toEqualTypeOf<`reader-${SourceId}`>();
    expectTypeOf<PortalAdapter['classify']>().returns.toEqualTypeOf<PageState>();
  });
});
