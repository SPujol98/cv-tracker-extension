import { createHash } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { cleanup, makeRepo, runPolicy, runSecretlint, stage, TERM, write } from './helpers.ts';

afterAll(cleanup);

// Threat Matrix, documentation-like paths: no path is exempt from the scan (PRIV-7, PRIV-8, PRIV-9).
function repoWithDenylist(files: Record<string, string | Buffer>): string {
  const repo = makeRepo();
  write(repo, '.privacy-denylist.txt', `${TERM}\n`);
  for (const [path, content] of Object.entries(files)) write(repo, path, content);
  stage(repo, ...Object.keys(files));
  return repo;
}

describe('documentation-like paths are scanned', () => {
  it.each([
    ['docs/x.md', 'docs/x.md'],
    ['tests/fixtures/portals/x.html', 'tests/fixtures/portals/x.html'],
    ['an extensionless file', 'NOTES'],
  ])('a denylisted term in %s fails', (_name, path) => {
    const repo = repoWithDenylist({ [path]: `hello ${TERM.toUpperCase()} world\n` });
    const result = runPolicy(repo, ['--all']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(path);
    expect(result.stderr).not.toContain(TERM);
  });

  it('a clean document passes', () => {
    const repo = repoWithDenylist({ 'docs/x.md': 'nothing private here\n' });
    expect(runPolicy(repo, ['--all']).code).toBe(0);
  });

  it('a .pdf outside tests/fixtures/binary/ fails', () => {
    const repo = repoWithDenylist({ 'docs/x.pdf': Buffer.from([0x25, 0x50, 0x00, 0x01]) });
    const result = runPolicy(repo, ['--all']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('docs/x.pdf');
  });

  it('an allowlisted binary under tests/fixtures/binary/ passes', () => {
    const blob = Buffer.from([0x25, 0x50, 0x00, 0x02]);
    const hash = createHash('sha256').update(blob).digest('hex');
    const repo = repoWithDenylist({
      'tests/fixtures/binary/ALLOWLIST': `# synthetic fixture\n${hash}  sample.pdf\n`,
      'tests/fixtures/binary/sample.pdf': blob,
    });
    expect(runPolicy(repo, ['--all']).code).toBe(0);
  });

  it('a binary under tests/fixtures/binary/ with an unlisted hash fails', () => {
    const repo = repoWithDenylist({
      'tests/fixtures/binary/ALLOWLIST': '# empty\n',
      'tests/fixtures/binary/sample.pdf': Buffer.from([0x25, 0x00, 0x03]),
    });
    expect(runPolicy(repo, ['--all']).code).toBe(1);
  });
});

describe('personal data in documentation paths (secretlint)', () => {
  it('a real-looking email in docs/x.md fails secretlint', () => {
    const repo = makeRepo();
    // Assembled at runtime so this file carries no literal address.
    write(repo, 'docs/x.md', `contact ${['jane.doe', 'gmail.com'].join('@')}\n`);
    expect(runSecretlint(repo, 'docs/x.md').code).toBe(1);
  });
});
