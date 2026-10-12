import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

// Plugin diagnostics are checked on real fixture files through the root biome.fixtures.json (plugin
// paths resolve against the config that is passed, so it must sit next to biome.json). It extends
// the repository config (and therefore its plugins) and re-includes the excluded fixture folders.
function lintFixture(name: string) {
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'biome',
      'lint',
      '--colors=off',
      '--config-path=biome.fixtures.json',
      `tests/lint-fixtures/gritql/${name}`,
    ],
    { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' },
  );
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('dynamic code and raw HTML sink plugins (SHELL-5, PRIV-4)', () => {
  it.each([
    ['new-function.positive.ts', 'no-new-function'],
    ['innerhtml.positive.ts', 'no-html-sinks'],
    ['outerhtml.positive.ts', 'no-html-sinks'],
    ['insert-adjacent-html.positive.ts', 'no-html-sinks'],
    ['document-write.positive.ts', 'no-html-sinks'],
  ])('rejects %s', (file, rule) => {
    const { status, output } = lintFixture(file);
    expect(output).not.toContain('during loading of plugins');
    expect(output).toContain(rule);
    expect(status).not.toBe(0);
  });

  it('accepts textContent reads and writes', () => {
    const { status, output } = lintFixture('text-content.negative.ts');
    expect(output).not.toContain('during loading of plugins');
    expect(output).not.toContain('no-html-sinks');
    expect(status).toBe(0);
  });
});
