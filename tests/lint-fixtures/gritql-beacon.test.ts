import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

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

describe('navigator.sendBeacon ban (PRIV-2)', () => {
  it.each(['sendbeacon.positive.ts', 'sendbeacon-global.positive.ts'])('rejects %s', (file) => {
    const { status, output } = lintFixture(file);
    expect(output).not.toContain('during loading of plugins');
    expect(output).toContain('no-send-beacon');
    expect(status).not.toBe(0);
  });

  it('accepts code that only mentions the word', () => {
    const { status, output } = lintFixture('sendbeacon.negative.ts');
    expect(output).not.toContain('during loading of plugins');
    expect(output).not.toContain('no-send-beacon');
    expect(status).toBe(0);
  });
});
