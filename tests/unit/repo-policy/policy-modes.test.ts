import { createHash } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { cleanup, makeRepo, runPolicy, stage, write } from './helpers.ts';

afterAll(cleanup);

const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');

function repoWith(files: Record<string, string>): string {
  const repo = makeRepo();
  for (const [path, content] of Object.entries(files)) write(repo, path, content);
  stage(repo);
  return repo;
}

describe('hashed denylist (CI secret)', () => {
  const token = 'zzhashedtoken';

  it('fails without printing the token', () => {
    const repo = repoWith({ 'docs/x.md': `mentions ${token} here\n` });
    const result = runPolicy(repo, ['--all'], { PRIVACY_DENYLIST_SHA256: hashOf(token) });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('docs/x.md');
    expect(result.stderr).not.toContain(token);
  });

  it('passes for a different token and when the secret is absent', () => {
    const repo = repoWith({ 'docs/x.md': `mentions ${token} here\n` });
    expect(runPolicy(repo, ['--all'], { PRIVACY_DENYLIST_SHA256: hashOf('other') }).code).toBe(0);
    expect(runPolicy(repo, ['--all']).code).toBe(0);
  });

  it('prints a notice when the secret is missing in CI (forks)', () => {
    const repo = repoWith({ 'docs/x.md': 'clean\n' });
    const result = runPolicy(repo, ['--all'], { CI: 'true' });
    expect(result.code).toBe(0);
    expect(result.stderr).toContain('skipped');
  });
});

describe('vendored extension block (PRIV-7)', () => {
  it('fails a tracked extension/ directory', () => {
    const repo = repoWith({ 'extension/PROVENANCE.txt': 'origin note\n' });
    const result = runPolicy(repo, ['--all']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('extension/PROVENANCE.txt');
  });

  it('fails a tracked manifest.json outside build output and allows it inside', () => {
    expect(runPolicy(repoWith({ 'vendor/manifest.json': '{}\n' }), ['--all']).code).toBe(1);
    expect(
      runPolicy(repoWith({ '.output/chrome-mv3/manifest.json': '{}\n' }), ['--all']).code,
    ).toBe(0);
  });

  it('does not treat a repository name ending in -extension as a segment', () => {
    expect(runPolicy(repoWith({ 'docs/cv-tracker-extension.md': 'notes\n' }), ['--all']).code).toBe(
      0,
    );
  });
});

describe('usage', () => {
  it.each([[[]], [['--bogus']]])('rejects arguments %j with exit 2', (args) => {
    expect(runPolicy(repoWith({ 'a.txt': 'x\n' }), args).code).toBe(2);
  });
});
