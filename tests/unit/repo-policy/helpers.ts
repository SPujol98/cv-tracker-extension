import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const projectRoot = resolve(import.meta.dirname, '../../..');
export const policyScript = join(projectRoot, 'scripts/check-repo-policy.ts');

// Synthetic denylist entry. It is not a real name, address or key.
export const TERM = 'zzprivatetoken';

const created: string[] = [];

/** A git-free environment: no inherited GIT_* variables (a hook run sets GIT_INDEX_FILE) and no user config. */
export function cleanEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('GIT_') && key !== 'PRIVACY_DENYLIST_SHA256') env[key] = value;
  }
  return {
    ...env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
    ...extra,
  };
}

export function git(cwd: string, args: string[], env: Record<string, string> = {}): string {
  const result = spawnSync('git', args, { cwd, env: cleanEnv(env), encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}

export function tempDir(prefix = 'policy-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  created.push(dir);
  return dir;
}

export function cleanup(): void {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
}

export function makeRepo(): string {
  const repo = tempDir();
  git(repo, ['init', '-q', '-b', 'main']);
  return repo;
}

export function write(repo: string, path: string, content: string | Buffer): void {
  const full = join(repo, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

export function stage(repo: string, ...paths: string[]): void {
  git(repo, ['add', '--', ...(paths.length > 0 ? paths : ['.'])]);
}

export function commit(repo: string, message = 'test commit'): void {
  git(repo, ['commit', '-q', '-m', message]);
}

export type Run = { code: number | null; stdout: string; stderr: string };

export function runPolicy(cwd: string, args: string[], env: Record<string, string> = {}): Run {
  const result: SpawnSyncReturns<string> = spawnSync('node', [policyScript, ...args], {
    cwd,
    env: cleanEnv(env),
    encoding: 'utf8',
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

export const secretlintConfig = join(projectRoot, '.secretlintrc.json');

/** Runs the repository secretlint configuration over one file in a throwaway directory. */
export function runSecretlint(dir: string, file: string): Run {
  const result = spawnSync(
    'pnpm',
    [
      '--dir',
      projectRoot,
      'exec',
      'secretlint',
      '--no-color',
      '--secretlintrc',
      secretlintConfig,
      '--no-gitignore',
      join(dir, file),
    ],
    { cwd: dir, env: cleanEnv(), encoding: 'utf8' },
  );
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}
