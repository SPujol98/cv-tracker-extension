import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { checkSupplyChain } from './supply-chain.ts';

const clean = () => ({
  workspace: { allowBuilds: { '@swc/core': false, 'simple-git-hooks': false } } as Record<
    string,
    unknown
  >,
  npmrc: 'registry=https://registry.npmjs.org/\n',
  pkg: { scripts: { build: 'wxt build', prepare: 'simple-git-hooks' } } as Record<string, unknown>,
});

// SHELL-12, amendment A21: dependency build scripts stay off; the only install-time script is the git hook.
describe('install-time script policy (SHELL-12)', () => {
  it('accepts a clean configuration', () => {
    expect(checkSupplyChain(clean())).toEqual([]);
  });

  it.each([[true], ['true'], [1], [null]])(
    'fails an allowBuilds entry set to %j, naming the package',
    (value) => {
      const files = clean();
      files.workspace = { allowBuilds: { esbuild: value, 'simple-git-hooks': false } };
      expect(checkSupplyChain(files)).toContain('allowBuilds.esbuild must be false');
    },
  );

  it('fails dangerouslyAllowAllBuilds in pnpm-workspace.yaml', () => {
    const files = clean();
    files.workspace = { ...files.workspace, dangerouslyAllowAllBuilds: false };
    expect(checkSupplyChain(files)).toContain(
      'pnpm-workspace.yaml must not set dangerouslyAllowAllBuilds',
    );
  });

  it('fails dangerously-allow-all-builds in .npmrc', () => {
    const files = clean();
    files.npmrc = 'registry=https://registry.npmjs.org/\ndangerously-allow-all-builds=true\n';
    expect(checkSupplyChain(files)).toContain('.npmrc must not set dangerously-allow-all-builds');
  });

  it.each([
    'dangerously-allow-all-builds',
    'dangerously-allow-all-builds\n',
    '  dangerously-allow-all-builds  ',
  ])('fails a bare .npmrc key (%j)', (line) => {
    const files = clean();
    files.npmrc = `registry=https://registry.npmjs.org/\n${line}\n`;
    expect(checkSupplyChain(files)).toContain('.npmrc must not set dangerously-allow-all-builds');
  });

  it.each(['onlyBuiltDependencies', 'neverBuiltDependencies'])(
    'fails a top-level pnpm-workspace.yaml %s',
    (key) => {
      const files = clean();
      files.workspace = { ...files.workspace, [key]: ['esbuild'] };
      expect(checkSupplyChain(files)).toContain(`pnpm-workspace.yaml must not set ${key}`);
    },
  );

  it.each(['onlyBuiltDependencies', 'neverBuiltDependencies'])(
    'fails a package.json pnpm field with %s',
    (key) => {
      const files = clean();
      files.pkg = { ...files.pkg, pnpm: { [key]: ['esbuild'] } };
      expect(checkSupplyChain(files)).toContain(`package.json pnpm.${key} is not allowed`);
    },
  );

  it.each([
    'preinstall',
    'install',
    'postinstall',
    'preprepare',
    'postprepare',
    'prepublish',
    'prepack',
    'postpack',
  ])('fails the %s lifecycle script, naming the key', (key) => {
    const files = clean();
    files.pkg = { scripts: { prepare: 'simple-git-hooks', [key]: 'node x.js' } };
    expect(checkSupplyChain(files)).toContain(`install-time script is not allowed: ${key}`);
  });

  it('fails a prepare script other than exactly simple-git-hooks', () => {
    const files = clean();
    files.pkg = { scripts: { prepare: 'simple-git-hooks && node x.js' } };
    expect(checkSupplyChain(files)).toContain('prepare must equal simple-git-hooks');
  });
});

describe('repository files', () => {
  const root = resolve(import.meta.dirname, '../..');
  it('satisfy the policy', () => {
    const files = {
      workspace: parse(readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf8')) as Record<
        string,
        unknown
      >,
      npmrc: readFileSync(resolve(root, '.npmrc'), 'utf8'),
      pkg: JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as Record<
        string,
        unknown
      >,
    };
    expect(checkSupplyChain(files)).toEqual([]);
  });
});
