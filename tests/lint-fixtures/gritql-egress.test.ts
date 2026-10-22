import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const fixtures = resolve(import.meta.dirname, 'restricted-egress');

// Biome 2.5 prints no per-rule diagnostics in --stdin-file-path mode, so each fixture is copied to
// its stated path inside a throwaway tree and linted as a real file through a config that extends
// the repository biome.json. This exercises the rule scope and the allowlist override.
let work: string;

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'gritql-egress-'));
  writeFileSync(
    join(work, 'biome.json'),
    JSON.stringify({ extends: [join(root, 'biome.json')], vcs: { enabled: false } }),
  );
  cpSync(join(root, 'biome-plugins'), join(work, 'biome-plugins'), { recursive: true });
});

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

function lintAs(fixture: string, path: string) {
  const target = join(work, path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(fixtures, `${fixture}.ts`), target);
  const result = spawnSync(
    'pnpm',
    ['--dir', root, 'exec', 'biome', 'lint', '--colors=off', `--config-path=${work}`, target],
    { cwd: work, encoding: 'utf8', shell: process.platform === 'win32' },
  );
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const ALLOWED_PATHS = [
  'src/background/services/providerGateway.ts',
  'src/background/services/update.ts',
  'src/background/scanTabDriver.ts',
  'src/e2e/overrides.ts',
  'src/ui/lib/openBlob.ts',
];

const POSITIVES = [
  'fetch',
  'xhr',
  'websocket',
  'event-source',
  'window-open',
  'tabs-create',
  'tabs-update',
  'browser-tabs-create',
];

// PRIV-11 (ADR-14 item 7, ADR-23, A19): network egress and tab opening live in five allowlisted modules.
describe('restricted-egress rule (PRIV-11)', () => {
  it.each(POSITIVES)('reports %s under src/ui/x.ts', (fixture) => {
    const { status, output } = lintAs(fixture, 'src/ui/x.ts');
    expect(output).not.toContain('during loading of plugins');
    expect(output).toContain('restricted-egress');
    expect(status).not.toBe(0);
  });

  it.each(ALLOWED_PATHS.flatMap((path) => POSITIVES.map((fixture) => [fixture, path])))(
    'allows %s under %s',
    (fixture, path) => {
      const { status, output } = lintAs(fixture, path);
      expect(output).not.toContain('during loading of plugins');
      expect(output).not.toContain('restricted-egress');
      expect(status).toBe(0);
    },
  );

  it.each(['injected-fetch', 'property-fetch'])(
    'accepts %s under src/providers/x.ts',
    (fixture) => {
      const { status, output } = lintAs(fixture, 'src/providers/x.ts');
      expect(output).not.toContain('during loading of plugins');
      expect(output).not.toContain('restricted-egress');
      expect(status).toBe(0);
    },
  );

  it.each([
    'scripts/x.ts',
    'scripts/record-provider.ts',
    'tests/e2e/x.spec.ts',
    'tests/support/x.ts',
    'src/ui/x.test.ts',
    'wxt.config.ts',
  ])('does not report global fetch under %s (production source only)', (path) => {
    const { output } = lintAs('fetch', path);
    expect(output).not.toContain('during loading of plugins');
    expect(output).not.toContain('restricted-egress');
  });

  it('reports global fetch under src/background/x.ts', () => {
    const { status, output } = lintAs('fetch', 'src/background/x.ts');
    expect(output).toContain('restricted-egress');
    expect(status).not.toBe(0);
  });
});
