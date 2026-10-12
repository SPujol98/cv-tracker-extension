import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const fixtures = resolve(import.meta.dirname, 'gritql-portal');
const forbidden = ['jobs-guest', 'job-apply', 'run-search'];

// The forbidden strings only exist in the fixture files, never in this test. The fixtures are
// copied into a throwaway tree that mirrors the real layout, so the plugin path exemption is
// exercised against the real guard and guard test locations.
let work: string;

function place(fixture: string, target: string) {
  mkdirSync(dirname(join(work, target)), { recursive: true });
  appendFileSync(join(work, target), readFileSync(join(fixtures, `${fixture}.ts`), 'utf8'));
}

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'gritql-portal-'));
  writeFileSync(
    join(work, 'biome.json'),
    JSON.stringify({ extends: [join(root, 'biome.json')], vcs: { enabled: false } }),
  );
  cpSync(join(root, 'biome-plugins'), join(work, 'biome-plugins'), { recursive: true });
  for (const name of forbidden) {
    place(name, `src/portals/${name}.ts`);
    place(name, 'src/core/guard.ts');
    place(name, 'tests/unit/core/guard.test.ts');
  }
  place('clean', 'src/portals/clean.ts');
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

describe('forbidden portal strings (PORTAL-6)', () => {
  it.each(forbidden)('rejects the %s string outside the guard', (name) => {
    const { status, output } = lint(`src/portals/${name}.ts`);
    expect(output).not.toContain('during loading of plugins');
    expect(output).toContain('no-forbidden-portal-strings');
    expect(status).not.toBe(0);
  });

  it('accepts ordinary portal URLs', () => {
    const { status, output } = lint('src/portals/clean.ts');
    expect(output).not.toContain('no-forbidden-portal-strings');
    expect(status).toBe(0);
  });

  it.each(['src/core/guard.ts', 'tests/unit/core/guard.test.ts'])('exempts %s', (file) => {
    const { output } = lint(file);
    expect(output).not.toContain('during loading of plugins');
    expect(output).not.toContain('no-forbidden-portal-strings');
  });
});
