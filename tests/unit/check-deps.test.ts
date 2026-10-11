import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const script = join(root, '../scripts/check-deps.ts');
const fixtures = join(root, 'fixtures/check-deps');

function run(args: string[]) {
  const result = spawnSync('node', [script, ...args], { encoding: 'utf8' });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

// PRIV-2: a maintained denylist of analytics and telemetry packages.
describe('telemetry dependency check', () => {
  it('fails on a direct denylisted dependency and names the package', () => {
    const result = run(['--root', join(fixtures, 'direct')]);
    expect(result.code).toBe(1);
    expect(result.out).toContain('mixpanel-browser');
  });

  it('fails on a transitive denylisted dependency found in the lockfile', () => {
    const result = run(['--root', join(fixtures, 'transitive')]);
    expect(result.code).toBe(1);
    expect(result.out).toContain('@sentry/browser');
  });

  it('passes a clean tree', () => {
    expect(run(['--root', join(fixtures, 'clean')]).code).toBe(0);
  });

  it('fails when the root has no package.json', () => {
    expect(run(['--root', join(fixtures, 'missing')]).code).toBe(2);
  });

  it('passes on this repository', () => {
    expect(run([]).code).toBe(0);
  });
});
