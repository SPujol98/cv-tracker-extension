import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  cleanEnv,
  cleanup,
  git,
  makeRepo,
  projectRoot,
  stage,
  write,
} from './repo-policy/helpers.ts';

afterAll(cleanup);

const read = (path: string) => readFileSync(join(projectRoot, path), 'utf8');
const pkg = JSON.parse(read('package.json'));

describe('pre-commit hook configuration (PRIV-9)', () => {
  it('runs lint-staged then the staged policy check', () => {
    expect(pkg['simple-git-hooks']['pre-commit']).toBe(
      'pnpm lint-staged && pnpm check:repo-policy --staged',
    );
  });

  it('installs the hook on prepare', () => {
    expect(pkg.scripts.prepare).toBe('simple-git-hooks');
  });

  it('lint-staged runs secretlint on every file and Biome on source files', () => {
    const config = JSON.parse(read('.lintstagedrc.json')) as Record<string, string | string[]>;
    const commands = Object.values(config).flat();
    expect(commands.some((c) => c.startsWith('secretlint'))).toBe(true);
    expect(commands.some((c) => c.startsWith('biome check'))).toBe(true);
    expect(Object.keys(config)).toContain('*');
  });
});

describe('pull request template (PRIV-10)', () => {
  const template = () => read('.github/pull_request_template.md');

  it('has the clean-room and no-personal-data attestation checkboxes', () => {
    expect(template()).toMatch(/- \[ \] .*clean[- ]room/i);
    expect(template()).toMatch(/- \[ \] .*no personal data/i);
  });

  it('has a filter-authorship line', () => {
    expect(template()).toMatch(/authorship/i);
    expect(template()).toMatch(/BEACON-3/);
  });
});

describe('a real commit with a staged synthetic secret', () => {
  function hookedRepo(): string {
    const repo = makeRepo();
    for (const file of ['.lintstagedrc.json', '.secretlintrc.json', '.secretlintignore']) {
      copyFileSync(join(projectRoot, file), join(repo, file));
    }
    const bin = join(projectRoot, 'node_modules/.bin');
    const hook = [
      '#!/bin/sh',
      `export PATH="${bin}:$PATH"`,
      'lint-staged || exit 1',
      `node "${join(projectRoot, 'scripts/check-repo-policy.ts')}" --staged`,
      '',
    ].join('\n');
    write(repo, '.git/hooks/pre-commit', hook);
    chmodSync(join(repo, '.git/hooks/pre-commit'), 0o755);
    return repo;
  }

  function tryCommit(repo: string) {
    return spawnSync('git', ['commit', '-q', '-m', 'test'], {
      cwd: repo,
      env: cleanEnv(),
      encoding: 'utf8',
    });
  }

  it('is blocked', () => {
    const repo = hookedRepo();
    const secret = ['sk', 'proj', 'A1b2C3d4E5f6G7h8I9j0'].join('-');
    write(repo, 'notes.md', `key: ${secret}\n`);
    stage(repo, 'notes.md');
    const result = tryCommit(repo);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
    expect(git(repo, ['rev-list', '--all', '--count']).trim()).toBe('0');
  });

  it('lets a clean change through', () => {
    const repo = hookedRepo();
    write(repo, 'notes.md', 'candidate@example.com wrote this\n');
    stage(repo, 'notes.md');
    expect(tryCommit(repo).status).toBe(0);
  });
});
