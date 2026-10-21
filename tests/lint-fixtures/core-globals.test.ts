import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const fixtures = resolve(import.meta.dirname, 'core-globals');
const globals = [
  'chrome',
  'browser',
  'document',
  'window',
  'navigator',
  'indexedDB',
  'localStorage',
  'fetch',
];

// Biome 2.5 prints no per-rule diagnostics in --stdin-file-path mode, so the fixtures are copied
// into a throwaway tree that mirrors the real layout (src/core vs src/background) and linted as
// real files through a config that extends the repository biome.json.
let work: string;

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'core-globals-'));
  writeFileSync(
    join(work, 'biome.json'),
    JSON.stringify({ extends: [join(root, 'biome.json')], vcs: { enabled: false } }),
  );
  // Plugin paths in the extended config resolve against the temporary tree.
  cpSync(join(root, 'biome-plugins'), join(work, 'biome-plugins'), { recursive: true });
  for (const layer of ['core', 'background']) {
    mkdirSync(join(work, 'src', layer), { recursive: true });
    for (const name of globals) {
      copyFileSync(join(fixtures, `${name}.ts`), join(work, 'src', layer, `${name}.ts`));
    }
  }
});

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

function lint(file: string) {
  const result = spawnSync(
    'pnpm',
    [
      '--dir',
      root,
      'exec',
      'biome',
      'lint',
      '--colors=off',
      `--config-path=${work}`,
      join(work, file),
    ],
    { cwd: work, encoding: 'utf8', shell: process.platform === 'win32' },
  );
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('src/core globals override (ADR-01, ADR-23)', () => {
  it.each(globals)('rejects the %s global in src/core', (name) => {
    const { status, output } = lint(`src/core/${name}.ts`);
    expect(output).toContain('lint/style/noRestrictedGlobals');
    expect(status).not.toBe(0);
  });

  it.each(globals)('allows the %s global in src/background', (name) => {
    const { status, output } = lint(`src/background/${name}.ts`);
    expect(output).not.toContain('noRestrictedGlobals');
    // Global fetch is reported by the restricted-egress plugin (PRIV-11) outside the allowlist, so
    // only the other globals are expected to lint clean here.
    if (name === 'fetch') expect(output).toContain('restricted-egress');
    else expect(status).toBe(0);
  });
});
