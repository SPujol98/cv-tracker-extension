import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const config = join(root, '.dependency-cruiser.cjs');

// Each case is a tiny source tree built in a throwaway directory: `from` imports `specifier`, and
// `target` (when given) is created so the import resolves to a real internal module.
type Case = { name: string; rule: string; from: string; specifier: string; target?: string };

const violations: Case[] = [
  ...['storage', 'providers', 'portals', 'background', 'ui', 'shared', 'entrypoints'].map(
    (layer) => ({
      name: `core imports src/${layer}`,
      rule: 'core-isolated',
      from: 'src/core/a.ts',
      specifier: `../${layer}/x`,
      target: `src/${layer}/x.ts`,
    }),
  ),
  ...['chrome', 'dexie', 'react', 'wxt/browser'].map((pkg) => ({
    name: `core imports ${pkg}`,
    rule: 'core-isolated',
    from: 'src/core/a.ts',
    specifier: pkg,
  })),
  {
    name: 'core imports the page-side portal readers (PortalReaders stays out of core)',
    rule: 'core-isolated',
    from: 'src/core/ports/portal.ts',
    specifier: '../../portals/readers',
    target: 'src/portals/readers.ts',
  },
  {
    name: 'a portal adapter imports chrome outside inject.ts',
    rule: 'portals-chrome',
    from: 'src/portals/linkedin/adapter.ts',
    specifier: 'chrome',
  },
  {
    name: 'providers import portals',
    rule: 'providers-portals-separate',
    from: 'src/providers/a.ts',
    specifier: '../portals/x',
    target: 'src/portals/x.ts',
  },
  {
    name: 'portals import providers',
    rule: 'portals-providers-separate',
    from: 'src/portals/a.ts',
    specifier: '../providers/x',
    target: 'src/providers/x.ts',
  },
  {
    name: 'ui imports providers',
    rule: 'ui-restricted',
    from: 'src/ui/a.ts',
    specifier: '../providers/x',
    target: 'src/providers/x.ts',
  },
  {
    name: 'ui imports background',
    rule: 'ui-restricted',
    from: 'src/ui/a.ts',
    specifier: '../background/x',
    target: 'src/background/x.ts',
  },
  {
    name: 'ui imports a portal reader',
    rule: 'ui-restricted',
    from: 'src/ui/a.ts',
    specifier: '../portals/linkedin/readers/x',
    target: 'src/portals/linkedin/readers/x.ts',
  },
  {
    name: 'ui imports a storage worker',
    rule: 'ui-restricted',
    from: 'src/ui/a.ts',
    specifier: '../storage/db.worker',
    target: 'src/storage/db.worker.ts',
  },
  {
    name: 'ui imports storage secrets',
    rule: 'ui-restricted',
    from: 'src/ui/a.ts',
    specifier: '../storage/secrets/keys',
    target: 'src/storage/secrets/keys.ts',
  },
  {
    name: 'storage imports react',
    rule: 'storage-restricted',
    from: 'src/storage/a.ts',
    specifier: 'react',
  },
  {
    name: 'storage imports ui',
    rule: 'storage-restricted',
    from: 'src/storage/a.ts',
    specifier: '../ui/x',
    target: 'src/ui/x.ts',
  },
  {
    name: 'shared imports dexie',
    rule: 'shared-restricted',
    from: 'src/shared/a.ts',
    specifier: 'dexie',
  },
  {
    name: 'shared imports storage',
    rule: 'shared-restricted',
    from: 'src/shared/a.ts',
    specifier: '../storage/x',
    target: 'src/storage/x.ts',
  },
  {
    name: 'background imports an entrypoint',
    rule: 'no-import-entrypoints',
    from: 'src/background/a.ts',
    specifier: '../entrypoints/main',
    target: 'src/entrypoints/main.ts',
  },
  {
    name: 'a relative path that climbs out and back in still hits the core rule',
    rule: 'core-isolated',
    from: 'src/core/deep/a.ts',
    specifier: '../../core/../storage/x',
    target: 'src/storage/x.ts',
  },
];

const conforming: Case[] = [
  {
    name: 'a portal inject.ts glue file imports chrome',
    rule: '',
    from: 'src/portals/linkedin/inject.ts',
    specifier: 'chrome',
  },
  {
    name: 'core imports a core module',
    rule: '',
    from: 'src/core/a.ts',
    specifier: './b',
    target: 'src/core/b.ts',
  },
  {
    name: 'providers import core',
    rule: '',
    from: 'src/providers/a.ts',
    specifier: '../core/ports/llm',
    target: 'src/core/ports/llm.ts',
  },
  {
    name: 'ui imports core and storage repos',
    rule: '',
    from: 'src/ui/a.ts',
    specifier: '../storage/jobs',
    target: 'src/storage/jobs.ts',
  },
  {
    name: 'background imports everything except ui',
    rule: '',
    from: 'src/background/a.ts',
    specifier: '../providers/x',
    target: 'src/providers/x.ts',
  },
];

let work: string;

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'depcruise-'));
});

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

function cruise(testCase: Case, index: number) {
  const tree = join(work, String(index));
  for (const file of [testCase.from, testCase.target].filter((f): f is string => Boolean(f))) {
    mkdirSync(dirname(join(tree, file)), { recursive: true });
    writeFileSync(
      join(tree, file),
      file === testCase.from ? `import '${testCase.specifier}';\n` : 'export {};\n',
    );
  }
  const result = spawnSync(
    join(root, 'node_modules/.bin/depcruise'),
    ['--config', config, '--output-type', 'err', 'src'],
    { cwd: tree, encoding: 'utf8', shell: process.platform === 'win32' },
  );
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('layer rules (ADR-01, Module Boundaries)', () => {
  it.each(violations.map((c, i) => [c.name, c, i] as const))('fails: %s', (_name, testCase, i) => {
    const { status, output } = cruise(testCase, i);
    expect(output).toContain(testCase.rule);
    expect(status).not.toBe(0);
  });

  it.each(conforming.map((c, i) => [c.name, c, i + 100] as const))(
    'passes: %s',
    (_n, testCase, i) => {
      const { status, output } = cruise(testCase, i);
      // The module count guards against a silent run that cruised nothing.
      expect(output).toMatch(/no dependency violations found \(\d+ modules/);
      expect(output).not.toMatch(/0 modules/);
      expect(status).toBe(0);
    },
  );
});
