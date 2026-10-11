// Repository policy check (PRIV-7, PRIV-8, PRIV-9, ADR-23). Product-specific rules that no
// maintained tool covers: the clean-room denylist, the vendored-extension block and the binary
// policy. It never exempts a path by name: every tracked file is scanned unless it is binary.
//
// Usage: node scripts/check-repo-policy.ts --all | --staged
//   --all     every tracked file (CI)
//   --staged  the blobs in the index, i.e. exactly what the commit will contain (pre-commit)
// Exit codes: 0 clean, 1 violations, 2 usage or environment error.
import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

const DENYLIST_FILE = '.privacy-denylist.txt';
const BINARY_DIR = 'tests/fixtures/binary/';
const ALLOWLIST_PATH = `${BINARY_DIR}ALLOWLIST`;
const BINARY_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.zip'];
const BUILD_OUTPUT = /^(\.output|\.wxt)\//;
const NUL_SCAN_BYTES = 8192;

const mode = process.argv[2];
if ((mode !== '--all' && mode !== '--staged') || process.argv.length !== 3) {
  console.error('usage: check-repo-policy.ts --all | --staged');
  process.exit(2);
}

// A relative GIT_INDEX_FILE is relative to the directory the hook started in, not to the root.
const env = { ...process.env };
if (env.GIT_INDEX_FILE && !isAbsolute(env.GIT_INDEX_FILE)) {
  env.GIT_INDEX_FILE = resolve(process.cwd(), env.GIT_INDEX_FILE);
}

function run(args: string[], cwd: string): SpawnSyncReturns<Buffer> {
  return spawnSync('git', args, { cwd, env, maxBuffer: 256 * 1024 * 1024 });
}

const top = run(['rev-parse', '--show-toplevel'], process.cwd());
if (top.status !== 0) {
  console.error('check-repo-policy: not inside a git repository');
  process.exit(2);
}
const root = top.stdout.toString().trim();

function gitList(args: string[]): string[] {
  const result = run(args, root);
  if (result.status !== 0) {
    console.error(`check-repo-policy: git ${args.join(' ')} failed`);
    process.exit(2);
  }
  return result.stdout.toString('utf8').split('\0').filter(Boolean);
}

function readBlob(path: string): Buffer | undefined {
  const result = run(['show', `:${path}`], root);
  return result.status === 0 ? result.stdout : undefined;
}

const tracked = gitList(['ls-files', '-z']);
const paths =
  mode === '--all'
    ? tracked
    : gitList(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']);

const violations: string[] = [];
const fail = (path: string, reason: string) => violations.push(`${path}: ${reason}`);

// The denylist file must never be tracked or staged; it is read only from <root>/<DENYLIST_FILE>.
for (const path of tracked) {
  if (path.split('/').pop() === DENYLIST_FILE) {
    fail(path, 'the denylist file must never be tracked or staged');
  }
}

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

function readLocalTerms(): string[] {
  try {
    return readFileSync(resolve(root, DENYLIST_FILE), 'utf8')
      .split('\n')
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line !== '' && !line.startsWith('#'));
  } catch {
    return []; // No denylist: the check passes cleanly (PRIV-9).
  }
}
const localTerms = readLocalTerms();

const hashedTokens = new Set(
  (env.PRIVACY_DENYLIST_SHA256 ?? '')
    .split(/[\s,]+/)
    .map((token) => token.toLowerCase())
    .filter(Boolean),
);
if (mode === '--all' && hashedTokens.size === 0 && env.CI) {
  console.error(
    'check-repo-policy: PRIVACY_DENYLIST_SHA256 is not set; hashed denylist check skipped',
  );
}

// Reports the matching entry by position, never by value, so the output cannot leak the term.
function scanText(path: string, text: string): void {
  const lower = text.toLowerCase();
  const index = localTerms.findIndex((term) => lower.includes(term));
  if (index >= 0) fail(path, `matches local denylist entry #${index + 1}`);
  if (hashedTokens.size > 0) {
    const words = lower.match(/[\p{L}\p{N}_@.+-]+/gu) ?? [];
    if (words.some((word) => hashedTokens.has(sha256(word)))) {
      fail(path, 'matches a hashed denylist token');
    }
  }
}

const allowlist = new Set(
  (readBlob(ALLOWLIST_PATH)?.toString('utf8') ?? '')
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[0]?.toLowerCase() ?? '')
    .filter((token) => /^[0-9a-f]{64}$/.test(token)),
);

for (const path of paths) {
  const segments = path.split('/');
  if (segments.some((segment) => segment.toLowerCase() === 'extension')) {
    fail(path, 'vendored extension paths are not allowed');
  }
  if (segments.at(-1) === 'manifest.json' && !BUILD_OUTPUT.test(path)) {
    fail(path, 'manifest.json outside build output looks like a vendored extension');
  }

  const blob = readBlob(path);
  if (!blob) continue;

  if (BINARY_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext))) {
    if (!path.startsWith(BINARY_DIR))
      fail(path, `binary documents are only allowed under ${BINARY_DIR}`);
    else if (!allowlist.has(sha256(blob)))
      fail(path, `binary hash is not listed in ${ALLOWLIST_PATH}`);
    continue;
  }

  scanText(path, path);
  if (!blob.subarray(0, NUL_SCAN_BYTES).includes(0)) scanText(path, blob.toString('utf8'));
}

if (violations.length > 0) {
  console.error(`check-repo-policy: ${violations.length} violation(s)`);
  for (const line of violations) console.error(`  ${line}`);
  process.exit(1);
}
