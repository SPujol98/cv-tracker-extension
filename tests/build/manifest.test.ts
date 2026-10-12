import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { deriveExtensionId } from '../../src/core/extensionId.ts';
import { checkManifest } from './manifest-rules.ts';

const root = resolve(import.meta.dirname, '../..');
const outDir = join(root, '.output/chrome-mv3');
const fixture = (name: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8')) as Record<
    string,
    unknown
  >;

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

// SHELL-1, SHELL-2, SHELL-3, SHELL-5 and amendment A1: Contract L on the built production manifest.
describe('manifest rules (negative fixtures)', () => {
  it('accepts the valid fixture', () => {
    expect(checkManifest(fixture('manifest-valid.json'))).toEqual([]);
  });

  it('names an unexpected optional permission (A1)', () => {
    expect(checkManifest(fixture('manifest-extra-optional.json'))).toContain(
      'unexpected optional permission: history',
    );
  });

  it('names forbidden permissions, wildcards, content scripts and CSP problems', () => {
    const problems = checkManifest(fixture('manifest-all-urls.json'));
    expect(problems).toEqual(
      expect.arrayContaining([
        'unexpected permission: unlimitedStorage',
        'forbidden permission: unlimitedStorage',
        'wildcard host matches all sites: <all_urls>',
        'wildcard host matches all sites: *://*/*',
        'content_scripts must be absent',
        'CSP contains unsafe-eval',
        'CSP contains a remote source',
      ]),
    );
  });

  it('rejects an optional host outside the sub-change origin table', () => {
    const m = {
      ...fixture('manifest-valid.json'),
      optional_host_permissions: ['https://x.example/*'],
    };
    expect(checkManifest(m, 0)).toContain(
      'optional_host_permissions must equal the sub-change 0 origin set',
    );
  });
});

describe('built manifest (production build)', () => {
  let manifest: Record<string, unknown>;

  beforeAll(() => {
    execFileSync('pnpm', ['build'], { cwd: root, stdio: 'pipe' });
    manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8'));
  }, 180_000);

  it('satisfies every Contract L rule', () => {
    expect(checkManifest(manifest)).toEqual([]);
  });

  it('pins a key whose derived ID equals docs/extension-id.txt (SHELL-2)', async () => {
    expect(typeof manifest.key).toBe('string');
    const der = Uint8Array.from(Buffer.from(manifest.key as string, 'base64'));
    const documented = readFileSync(join(root, 'docs/extension-id.txt'), 'utf8').trim();
    expect(await deriveExtensionId(der)).toBe(documented);
  });

  it('declares the three extension pages and the background worker', () => {
    expect(manifest.background).toMatchObject({ service_worker: 'background.js' });
    expect(manifest.options_ui ?? manifest.options_page).toBeDefined();
    const files = [...walk(outDir)].map((f) => f.slice(outDir.length + 1));
    expect(files).toEqual(expect.arrayContaining(['popup.html', 'sidepanel.html', 'options.html']));
  });

  it('contains no E2E override sentinel and no fake provider id (ADR-28)', () => {
    for (const file of walk(outDir)) {
      if (!/\.(js|html|json|css)$/.test(file)) continue;
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toContain('__cvt_e2e_override__');
      expect(text, file).not.toMatch(/"fake"/);
    }
  });
});
