// Fails when package.json or pnpm-lock.yaml references a telemetry package (PRIV-2, ADR-23).
// Usage: node scripts/check-deps.ts [--root <dir>]
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseAllDocuments } from 'yaml';

type Denylist = { scopes: string[]; packages: string[] };

const args = process.argv.slice(2);
const rootFlag = args.indexOf('--root');
const root = resolve(rootFlag >= 0 ? (args[rootFlag + 1] ?? '.') : '.');
const denylist: Denylist = JSON.parse(
  readFileSync(join(import.meta.dirname, 'telemetry-denylist.json'), 'utf8'),
);

function isDenied(name: string): boolean {
  return denylist.packages.includes(name) || denylist.scopes.some((s) => name.startsWith(`${s}/`));
}

/** `@scope/name@1.0.0(peer@2)` and `name@1.0.0` both yield the bare package name. */
function nameOf(key: string): string {
  const at = key.indexOf('@', 1);
  return (at === -1 ? key : key.slice(0, at)).replace(/^\//, '');
}

function declared(manifest: Record<string, unknown>): string[] {
  const fields = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
  return fields.flatMap((f) => Object.keys((manifest[f] as object | undefined) ?? {}));
}

function locked(documents: Record<string, unknown>[]): string[] {
  const sections = ['packages', 'snapshots'];
  return documents.flatMap((doc) =>
    sections.flatMap((s) => Object.keys((doc[s] as object | undefined) ?? {}).map(nameOf)),
  );
}

/** pnpm 12 can write several YAML documents (the env lockfile comes first); read them all. */
function readLockfile(path: string): Record<string, unknown>[] {
  return parseAllDocuments(readFileSync(path, 'utf8')).map((d) => d.toJS() ?? {});
}

const manifestPath = join(root, 'package.json');
if (!existsSync(manifestPath)) {
  console.error(`check-deps: no package.json in ${root}`);
  process.exit(2);
}

const found = new Map<string, string>();
for (const name of declared(JSON.parse(readFileSync(manifestPath, 'utf8')))) {
  if (isDenied(name)) found.set(name, 'package.json');
}
const lockPath = join(root, 'pnpm-lock.yaml');
if (existsSync(lockPath)) {
  for (const name of locked(readLockfile(lockPath))) {
    if (isDenied(name) && !found.has(name)) found.set(name, 'pnpm-lock.yaml');
  }
}

if (found.size > 0) {
  for (const [name, where] of found)
    console.error(`check-deps: telemetry package ${name} (${where})`);
  process.exit(1);
}
console.log('check-deps: no telemetry packages found');
