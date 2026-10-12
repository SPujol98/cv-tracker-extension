import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

function biome(command: string, ...args: string[]) {
  const result = spawnSync('pnpm', ['exec', 'biome', command, '--colors=off', ...args], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

// biome.json excludes each fixture directory from the normal run (add a line per new fixture
// directory), so fixtures are linted through the root biome.fixtures.json, which extends the real
// config and re-includes them.
function lintFixture(name: string) {
  return biome('lint', '--config-path=biome.fixtures.json', `tests/lint-fixtures/biome/${name}`);
}

describe('Biome base rules (SHELL-5, PRIV-4)', () => {
  it('rejects eval through noGlobalEval', () => {
    const { status, output } = lintFixture('eval.positive.ts');
    expect(status).not.toBe(0);
    expect(output).toContain('lint/security/noGlobalEval');
  });

  it('rejects React raw HTML through noDangerouslySetInnerHtml', () => {
    const { status, output } = lintFixture('innerhtml-react.positive.tsx');
    expect(status).not.toBe(0);
    expect(output).toContain('lint/security/noDangerouslySetInnerHtml');
  });

  it('pins both rules to error so a Biome default change cannot drop them', () => {
    const biomeConfig = JSON.parse(readFileSync(resolve(root, 'biome.json'), 'utf8')) as {
      linter: { rules: { security: Record<string, string> } };
    };
    expect(biomeConfig.linter.rules.security).toMatchObject({
      noGlobalEval: 'error',
      noDangerouslySetInnerHtml: 'error',
    });
  });

  it('accepts clean code', () => {
    const { status, output } = lintFixture('clean.negative.ts');
    expect(output).not.toContain('lint/');
    expect(status).toBe(0);
  });

  it('keeps the fixtures out of the normal lint run', () => {
    const { output } = biome('lint', '.');
    expect(output).not.toContain('tests/lint-fixtures/biome/');
  });
});
