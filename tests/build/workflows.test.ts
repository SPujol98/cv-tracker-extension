import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const WORKFLOWS = '.github/workflows';

type Step = { name?: string; uses?: string; run?: string; with?: Record<string, unknown> };
type Workflow = {
  on: Record<string, unknown>;
  permissions?: Record<string, string>;
  jobs: Record<string, { permissions?: Record<string, string>; steps: Step[] }>;
};

function load(file: string): Workflow {
  return parse(readFileSync(path.join(WORKFLOWS, file), 'utf8')) as Workflow;
}

function steps(workflow: Workflow): Step[] {
  return Object.values(workflow.jobs).flatMap((job) => job.steps);
}

const files = readdirSync(WORKFLOWS).filter((file) => file.endsWith('.yml'));

describe('workflow hygiene (ADR-27)', () => {
  it('has the expected workflow files', () => {
    expect(files).toEqual(expect.arrayContaining(['ci.yml', 'codeql.yml']));
  });

  it.each(files)('%s pins every action to a 40-hex commit SHA', (file) => {
    const uses = steps(load(file)).flatMap((step) => (step.uses ? [step.uses] : []));
    expect(uses.length).toBeGreaterThan(0);
    for (const reference of uses)
      expect(reference).toMatch(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}(\s|$)/);
  });

  it.each(files)('%s never uses pull_request_target', (file) => {
    expect(Object.keys(load(file).on)).not.toContain('pull_request_target');
    expect(readFileSync(path.join(WORKFLOWS, file), 'utf8')).not.toContain('pull_request_target');
  });
});

describe('ci.yml (SHELL-7)', () => {
  const ci = load('ci.yml');

  it('runs on pull requests and pushes to main with read-only permissions', () => {
    expect(Object.keys(ci.on)).toEqual(expect.arrayContaining(['pull_request', 'push']));
    expect(ci.permissions).toEqual({ contents: 'read' });
  });

  it('uses the Node version file and a frozen install', () => {
    const all = steps(ci);
    const node = all.find((step) => step.uses?.startsWith('actions/setup-node@'));
    expect(node?.with?.['node-version-file']).toBe('.nvmrc');
    expect(all.some((step) => step.run === 'pnpm install --frozen-lockfile')).toBe(true);
  });

  it('runs the gates in the documented order', () => {
    const runs = steps(ci).flatMap((step) => (step.run ? [step.run] : []));
    const order = [
      'pnpm install --frozen-lockfile',
      'pnpm typecheck',
      'pnpm lint',
      'pnpm depcruise',
      'pnpm check:deps',
      'pnpm check:repo-policy --all',
      'pnpm secretlint',
      'pnpm audit --prod --audit-level high',
      'pnpm test --coverage',
      'pnpm build',
      'pnpm vitest run tests/build',
      'pnpm e2e',
    ];
    const positions = order.map((command) => runs.indexOf(command));
    expect(positions).not.toContain(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('installs the Playwright browser before the e2e step', () => {
    const runs = steps(ci).flatMap((step) => (step.run ? [step.run] : []));
    const install = runs.findIndex((run) => run.includes('playwright install'));
    expect(install).toBeGreaterThan(-1);
    expect(install).toBeLessThan(runs.indexOf('pnpm e2e'));
  });

  it('does not use real provider credentials', () => {
    expect(readFileSync(path.join(WORKFLOWS, 'ci.yml'), 'utf8')).not.toMatch(/secrets\./);
  });
});

describe('codeql.yml', () => {
  const codeql = load('codeql.yml');

  it('can write security events and runs weekly and on pull requests', () => {
    const job = Object.values(codeql.jobs)[0];
    expect(job?.permissions).toMatchObject({ 'security-events': 'write', contents: 'read' });
    expect(codeql.on).toHaveProperty('pull_request');
    const schedule = codeql.on.schedule as { cron: string }[];
    expect(schedule).toHaveLength(1);
    expect(schedule[0]?.cron).toMatch(/^\S+ \S+ \S+ \S+ [0-6]$/);
  });

  it('analyzes javascript-typescript', () => {
    const init = steps(codeql).find((step) => step.uses?.includes('codeql-action/init'));
    expect(init?.with?.languages).toBe('javascript-typescript');
  });
});

describe('dependabot.yml', () => {
  const config = parse(readFileSync('.github/dependabot.yml', 'utf8')) as {
    updates: {
      'package-ecosystem': string;
      schedule: { interval: string };
      groups: Record<string, { 'update-types': string[] }>;
    }[];
  };

  it.each(['npm', 'github-actions'])(
    'covers %s weekly with minor and patch grouped',
    (ecosystem) => {
      const entry = config.updates.find((update) => update['package-ecosystem'] === ecosystem);
      expect(entry?.schedule.interval).toBe('weekly');
      const grouped = Object.values(entry?.groups ?? {}).flatMap((group) => group['update-types']);
      expect(grouped).toEqual(expect.arrayContaining(['minor', 'patch']));
    },
  );
});

describe('Node version pin', () => {
  it('requires a Node release with native TypeScript type stripping', () => {
    const nvmrc = readFileSync('.nvmrc', 'utf8').trim();
    expect(Number(nvmrc.split('.')[0])).toBeGreaterThanOrEqual(22);
    const engines = JSON.parse(readFileSync('package.json', 'utf8')).engines.node as string;
    expect(engines).toBe('>=22.18');
  });
});
