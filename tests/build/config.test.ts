import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface OpenSpecConfig {
  strict_tdd: boolean;
  tdd_intent: boolean;
  testing: Record<string, unknown>;
  rules: {
    apply: Record<string, unknown>;
    verify: Record<string, unknown>;
  };
}

const root = resolve(import.meta.dirname, '../..');
const config = parse(readFileSync(resolve(root, 'openspec/config.yaml'), 'utf8')) as OpenSpecConfig;
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

// SHELL-7: after the foundation sub-change, strict TDD is on and `testing.*` is populated.
describe('openspec/config.yaml strict TDD activation (SHELL-7)', () => {
  it('turns strict TDD on and keeps the intent flag', () => {
    expect(config).toMatchObject({ strict_tdd: true, tdd_intent: true });
  });

  it('records the active test toolchain', () => {
    expect(config.testing).toMatchObject({
      status: 'active',
      runner: 'vitest',
      test_command: 'pnpm test',
      coverage: true,
      linter: 'biome',
      type_checker: 'tsc',
      formatter: 'biome',
    });
    expect(config.testing.layers).toEqual({ unit: true, integration: true, e2e: true });
  });

  it('points the apply and verify rules at the same commands', () => {
    expect(config.rules.apply).toMatchObject({ tdd: true, test_command: 'pnpm test' });
    expect(config.rules.verify).toMatchObject({
      test_command: 'pnpm test && pnpm e2e',
      build_command: 'pnpm build',
    });
  });

  it('resolves the test script to vitest run', () => {
    expect(pkg.scripts.test).toBe('vitest run');
  });
});
