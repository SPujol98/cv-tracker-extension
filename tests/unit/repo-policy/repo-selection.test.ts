import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  cleanup,
  commit,
  git,
  makeRepo,
  runPolicy,
  stage,
  TERM,
  tempDir,
  write,
} from './helpers.ts';

afterAll(cleanup);

// Threat Matrix, git repository selection: the root comes from git, never from the cwd.
describe('repository selection', () => {
  it('running from src/ scans the whole staged set', () => {
    const repo = makeRepo();
    write(repo, '.privacy-denylist.txt', `${TERM}\n`);
    write(repo, 'docs/x.md', `has ${TERM}\n`);
    write(repo, 'src/a.ts', 'export {};\n');
    stage(repo, 'docs/x.md', 'src/a.ts');
    const result = runPolicy(join(repo, 'src'), ['--staged']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('docs/x.md');
  });

  it('a linked worktree uses its own index', () => {
    const repo = makeRepo();
    write(repo, '.privacy-denylist.txt', `${TERM}\n`);
    write(repo, 'README.md', 'clean\n');
    stage(repo, 'README.md');
    commit(repo);
    const worktree = join(tempDir('policy-wt-'), 'wt');
    git(repo, ['worktree', 'add', '-q', '-b', 'other', worktree]);
    write(worktree, '.privacy-denylist.txt', `${TERM}\n`);
    write(worktree, 'docs/x.md', `has ${TERM}\n`);
    stage(worktree, 'docs/x.md');
    expect(runPolicy(worktree, ['--staged']).code).toBe(1);
    expect(runPolicy(repo, ['--staged']).code).toBe(0);
  });

  it('a missing denylist passes locally', () => {
    const repo = makeRepo();
    write(repo, 'docs/x.md', `has ${TERM}\n`);
    stage(repo, 'docs/x.md');
    expect(runPolicy(repo, ['--staged']).code).toBe(0);
    expect(runPolicy(repo, ['--all']).code).toBe(0);
  });

  it.each([['--staged'], ['--all']])('a tracked or staged denylist fails with %s', (mode) => {
    const repo = makeRepo();
    write(repo, '.privacy-denylist.txt', `${TERM}\n`);
    stage(repo, '.privacy-denylist.txt');
    const result = runPolicy(repo, [mode]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('.privacy-denylist.txt');
  });
});
