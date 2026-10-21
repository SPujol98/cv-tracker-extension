import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
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
const fixtures = resolve(import.meta.dirname, 'restricted-egress');

// Biome 2.5 prints no per-rule diagnostics in --stdin-file-path mode, so each fixture is copied to
// its stated path inside a throwaway tree and linted as a real file through a config that extends
// the repository biome.json. This exercises the rule scope and the allowlist override.
let work: string;
let ancestorRoot: string;
let ancestorWork: string;

function makeProject(dir: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'biome.json'),
    JSON.stringify({ extends: [join(root, 'biome.json')], vcs: { enabled: false } }),
  );
  cpSync(join(root, 'biome-plugins'), join(dir, 'biome-plugins'), { recursive: true });
}

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'gritql-egress-'));
  makeProject(work);
  // A project whose absolute path has an ancestor directory named `src` (R4-ancestor-src-glob).
  ancestorRoot = mkdtempSync(join(tmpdir(), 'gritql-egress-anc-'));
  ancestorWork = join(ancestorRoot, 'src', 'project');
  makeProject(ancestorWork);
});

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
  rmSync(ancestorRoot, { recursive: true, force: true });
});

// A run only counts when Biome exited normally and reported that it checked the file, so a timeout,
// a crash or "No files were processed" can never pass a negative case vacuously.
function lintAs(fixture: string, path: string, project: () => string = () => work) {
  const dir = project();
  const target = join(dir, path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(fixtures, `${fixture}.ts`), target);
  const result = spawnSync(
    'pnpm',
    ['--dir', root, 'exec', 'biome', 'lint', '--colors=off', `--config-path=${dir}`, target],
    { cwd: dir, encoding: 'utf8', timeout: 60_000, shell: process.platform === 'win32' },
  );
  if (result.error || result.status === null) {
    throw new Error(`biome did not finish: ${result.error?.message ?? `signal ${result.signal}`}`);
  }
  const output = `${result.stdout}${result.stderr}`;
  return { status: result.status, output, checked: /Checked 1 file/.test(output) };
}

function expectClean(r: ReturnType<typeof lintAs>) {
  expect(r.output).not.toContain('during loading of plugins');
  expect(r.output).not.toContain('No files were processed');
  expect(r.checked).toBe(true);
  expect(r.output).not.toContain('restricted-egress');
  expect(r.status).toBe(0);
}

// The allowlist lives in biome.json (the plugin's negated `**/src/...` includes); derive it here so
// a path added there is tested automatically.
function allowedPathsFromBiomeJson(): string[] {
  const config = JSON.parse(readFileSync(join(root, 'biome.json'), 'utf8')) as {
    plugins: (string | { path: string; includes?: string[] })[];
  };
  const plugin = config.plugins.find(
    (p): p is { path: string; includes?: string[] } =>
      typeof p === 'object' && p.path.endsWith('restricted-egress.grit'),
  );
  return (plugin?.includes ?? [])
    .filter((g) => g.startsWith('!**/src/') && !g.includes('*', '!**/'.length))
    .map((g) => g.slice('!**/'.length));
}

const ALLOWED_PATHS = allowedPathsFromBiomeJson();

const POSITIVES = [
  'fetch',
  'xhr',
  'websocket',
  'event-source',
  'window-open',
  'tabs-create',
  'tabs-update',
  'browser-tabs-create',
  'browser-tabs-update',
];

// Receiver forms and aliases (R1-egress-member-bypass, R3-egress-alias-gaps).
const MEMBER_POSITIVES = ['globalthis', 'self', 'window'].flatMap((r) =>
  ['fetch', 'xhr', 'websocket', 'event-source'].map((k) => `${r}-${k}`),
);
const EXTRA_POSITIVES = ['globalthis-window-open', 'self-window-open', 'alias-fetch'];

// PRIV-11 (ADR-14 item 7, ADR-23, A19): network egress and tab opening live in five allowlisted modules.
describe('restricted-egress rule (PRIV-11)', () => {
  it('derives the five allowlisted modules from biome.json', () => {
    expect(ALLOWED_PATHS).toHaveLength(5);
  });

  it.each([...POSITIVES, ...MEMBER_POSITIVES, ...EXTRA_POSITIVES])(
    'reports %s under src/ui/x.ts',
    (fixture) => {
      const { status, output } = lintAs(fixture, 'src/ui/x.ts');
      expect(output).not.toContain('during loading of plugins');
      expect(output).toContain('restricted-egress');
      expect(status).not.toBe(0);
    },
  );

  it.each(ALLOWED_PATHS.flatMap((path) => POSITIVES.map((fixture) => [fixture, path])))(
    'allows %s under %s',
    (fixture, path) => {
      expectClean(lintAs(fixture, path));
    },
  );

  it.each(['injected-fetch', 'property-fetch'])(
    'accepts %s under src/providers/x.ts',
    (fixture) => {
      expectClean(lintAs(fixture, 'src/providers/x.ts'));
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
    expectClean(lintAs('fetch', path));
  });

  // Biome 2.5.15 plugin globs cannot be anchored to the project root, so `**/src/**` also matches an
  // ancestor directory named `src`. The plugin therefore excludes every non-src top-level path.
  it.each(['scripts/x.ts', 'tests/e2e/x.spec.ts', 'tests/support/x.ts', 'wxt.config.ts'])(
    'does not report %s when an ancestor directory is named src',
    (path) => {
      expectClean(lintAs('fetch', path, () => ancestorWork));
    },
  );

  it('still reports production source when an ancestor directory is named src', () => {
    const { status, output } = lintAs('fetch', 'src/ui/x.ts', () => ancestorWork);
    expect(output).toContain('restricted-egress');
    expect(status).not.toBe(0);
  });

  it('keeps every non-src top-level path excluded from the plugin scope', () => {
    const tracked = spawnSync('git', ['ls-files'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(tracked.status).toBe(0);
    const config = JSON.parse(readFileSync(join(root, 'biome.json'), 'utf8')) as {
      plugins: (string | { path: string; includes?: string[] })[];
    };
    const includes = config.plugins.flatMap((p) =>
      typeof p === 'object' && p.path.endsWith('restricted-egress.grit') ? (p.includes ?? []) : [],
    );
    const excluded = new Set(includes.filter((g) => g.startsWith('!**/')).map((g) => g.slice(4)));
    const sources = tracked.stdout
      .split('\n')
      .filter((f) => /\.(c|m)?[jt]sx?$/.test(f) && !f.startsWith('src/'));
    const uncovered = sources.filter((f) => {
      if (f.includes('/')) return !excluded.has(`${f.split('/')[0]}/**`);
      return !(excluded.has(f) || (/\.config\.ts$/.test(f) && excluded.has('*.config.ts')));
    });
    expect(uncovered).toEqual([]);
  });

  // Known limitation (biome-plugins/README.md): a rebinding of the global object and computed member
  // access are not tracked by the GritQL plugin. This pins the current behaviour; update it if the
  // rule ever gains data-flow support.
  it('does not report an aliased global object or computed fetch (documented limitation)', () => {
    expectClean(lintAs('known-limitation-global-alias', 'src/ui/x.ts'));
  });

  it('reports global fetch under src/background/x.ts', () => {
    const { status, output } = lintAs('fetch', 'src/background/x.ts');
    expect(output).toContain('restricted-egress');
    expect(status).not.toBe(0);
  });
});
