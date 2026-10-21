// Install-time script policy (SHELL-12, amendment A21) as a pure function over parsed repository files.

export interface SupplyChainFiles {
  workspace: Record<string, unknown>;
  npmrc: string;
  pkg: Record<string, unknown>;
}

const FORBIDDEN_LIFECYCLE = [
  'preinstall',
  'install',
  'postinstall',
  'preprepare',
  'postprepare',
  'prepublish',
  'prepack',
  'postpack',
];
const FORBIDDEN_PNPM_FIELDS = ['onlyBuiltDependencies', 'neverBuiltDependencies'];

export function checkSupplyChain({ workspace, npmrc, pkg }: SupplyChainFiles): string[] {
  const problems: string[] = [];

  const allowBuilds = (workspace.allowBuilds as Record<string, unknown> | undefined) ?? {};
  for (const [name, value] of Object.entries(allowBuilds)) {
    if (value !== false) problems.push(`allowBuilds.${name} must be false`);
  }
  if ('dangerouslyAllowAllBuilds' in workspace) {
    problems.push('pnpm-workspace.yaml must not set dangerouslyAllowAllBuilds');
  }
  if (/^\s*dangerously-allow-all-builds\s*=/m.test(npmrc)) {
    problems.push('.npmrc must not set dangerously-allow-all-builds');
  }

  const pnpm = (pkg.pnpm as Record<string, unknown> | undefined) ?? {};
  for (const field of FORBIDDEN_PNPM_FIELDS) {
    if (field in pnpm) problems.push(`package.json pnpm.${field} is not allowed`);
  }

  const scripts = (pkg.scripts as Record<string, string> | undefined) ?? {};
  for (const key of FORBIDDEN_LIFECYCLE) {
    if (key in scripts) problems.push(`install-time script is not allowed: ${key}`);
  }
  if ('prepare' in scripts && scripts.prepare !== 'simple-git-hooks') {
    problems.push('prepare must equal simple-git-hooks');
  }
  return problems;
}
