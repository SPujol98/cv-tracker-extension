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

// Threat Matrix, commit state: the staged check reads exactly what will be committed.
function repoWithDenylist(): string {
  const repo = makeRepo();
  write(repo, '.privacy-denylist.txt', `${TERM}\n`);
  return repo;
}

describe('staged mode reads the index', () => {
  it('a staged secret with a clean worktree fails', () => {
    const repo = repoWithDenylist();
    write(repo, 'docs/x.md', `has ${TERM}\n`);
    stage(repo, 'docs/x.md');
    write(repo, 'docs/x.md', 'clean again\n');
    expect(runPolicy(repo, ['--staged']).code).toBe(1);
  });

  it('a clean staged blob with a dirty worktree passes', () => {
    const repo = repoWithDenylist();
    write(repo, 'docs/x.md', 'clean\n');
    stage(repo, 'docs/x.md');
    write(repo, 'docs/x.md', `has ${TERM}\n`);
    expect(runPolicy(repo, ['--staged']).code).toBe(0);
  });

  it('the GIT_INDEX_FILE override is honored', () => {
    const repo = repoWithDenylist();
    write(repo, 'docs/x.md', `has ${TERM}\n`);
    const alternate = join(tempDir('policy-idx-'), 'index');
    git(repo, ['add', 'docs/x.md'], { GIT_INDEX_FILE: alternate });
    expect(runPolicy(repo, ['--staged']).code).toBe(0);
    expect(runPolicy(repo, ['--staged'], { GIT_INDEX_FILE: alternate }).code).toBe(1);
  });

  it('an empty index exits 0', () => {
    const repo = repoWithDenylist();
    write(repo, 'docs/untracked.md', `has ${TERM}\n`);
    expect(runPolicy(repo, ['--staged']).code).toBe(0);
  });

  it('renamed files are scanned', () => {
    const repo = makeRepo();
    write(repo, 'docs/old.md', `has ${TERM}\n`);
    stage(repo, 'docs/old.md');
    commit(repo);
    write(repo, '.privacy-denylist.txt', `${TERM}\n`);
    git(repo, ['mv', 'docs/old.md', 'docs/new.md']);
    const result = runPolicy(repo, ['--staged']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('docs/new.md');
  });
});
