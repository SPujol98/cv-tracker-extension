import { describe, expect, it } from 'vitest';
import { postValidate } from '../../../../src/core/analysis/postValidate.ts';
import { AUDIT_VERSION } from '../../../../src/core/analysis/rationaleAudit.ts';
import type { ValidatedOutput } from '../../../../src/core/schemas/analysis.ts';
import type { Profile } from '../../../../src/core/schemas/profile.ts';

const snapshot: Profile = {
  id: 'active',
  claims: [
    { id: 'c-1', statement: 'Writes TypeScript', tags: [] },
    { id: 'c-2', statement: 'Cut cloud costs by 20% at a previous job', tags: [] },
  ],
  branches: [
    {
      id: 'b-1',
      name: 'Backend',
      titleFilter: { includeGroups: [], excludeTerms: [] },
      rules: [],
      dealbreakers: ['no on-call'],
    },
  ],
  companyBlocklist: [],
  nextClaimSeq: 3,
  nextBranchSeq: 2,
};

const requestText =
  'We need five years of TypeScript. The team is 3 days on-site. Budget 50.000 EUR.';

const base = {
  requirements: [
    { text: 'TypeScript experience', evidence: 'five years of TypeScript', must_have: true },
  ],
  fit: [{ requirement: 'TypeScript experience', claim_ids: ['c-1'] }],
  walls: [] as unknown[],
  score: 60,
  branch_id: 'b-1',
  rationale: 'Overlaps with the stack.',
};

const run = (over: Record<string, unknown> = {}) =>
  postValidate({ ...base, ...over }, { requestText, snapshot });

const ok = (over: Record<string, unknown> = {}): ValidatedOutput => {
  const result = run(over);
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  return result.output;
};

describe('post-validation step 8b records the rationale audit (ANALYSIS-11; ADR-29)', () => {
  it('stores the audit in diagnostics.ungroundedClaims', () => {
    expect(
      ok({ rationale: 'Overlaps with the stack and 10 years of Go.' }).diagnostics,
    ).toMatchObject({
      ungroundedClaims: { count: 1, samples: ['10 years'], auditVersion: AUDIT_VERSION },
    });
  });

  it('records an empty audit when there is nothing to check', () => {
    expect(ok().diagnostics.ungroundedClaims).toEqual({
      count: 0,
      samples: [],
      auditVersion: AUDIT_VERSION,
    });
  });

  it('grounds a figure by the offer, a number word, another format and a claim', () => {
    const rationale =
      'Has 5 years of TypeScript, on-site 3 days, budget €50,000 and a 20% cost cut (c-2).';
    expect(ok({ rationale }).diagnostics.ungroundedClaims.count).toBe(0);
  });

  it('does not count the score or the digits of ids', () => {
    const rationale = 'Fit 60 out of 100: c-1 and c-2 support it, branch b-1, dealbreaker b-1/d0.';
    expect(ok({ rationale }).diagnostics.ungroundedClaims.count).toBe(0);
  });
});

describe('an ungrounded figure never changes anything but the diagnostics (ANALYSIS-11)', () => {
  it('is never invalid_output and leaves score, fit, walls, branch and requirements untouched', () => {
    const clean = ok();
    const figure = ok({ rationale: 'Overlaps with the stack and 10 years of Go, 99% sure.' });
    expect(figure.diagnostics.ungroundedClaims.count).toBe(2);
    const { diagnostics: cleanDiagnostics, rationale: _a, ...cleanRest } = clean;
    const { diagnostics: figureDiagnostics, rationale: _b, ...figureRest } = figure;
    expect(figureRest).toEqual(cleanRest);
    expect({ ...figureDiagnostics, ungroundedClaims: null }).toEqual({
      ...cleanDiagnostics,
      ungroundedClaims: null,
    });
    expect(figure.fit.every((entry) => !entry.unmatched)).toBe(true);
  });

  it('keeps an accepted wall and does not add one', () => {
    const wall = {
      text: 'No on-call',
      evidence: 'five years of TypeScript',
      basis: 'dealbreaker',
      ref: 'b-1/d0',
    };
    const withWall = ok({ walls: [wall], rationale: 'Wall holds; 12 years of Rust.' });
    expect(withWall.walls).toHaveLength(1);
    expect(withWall.diagnostics.ungroundedClaims.count).toBe(1);
    expect(ok({ rationale: 'Only 12 years of Rust.' }).walls).toEqual([]);
  });
});

describe('the audit sits after the branch step (Contract C)', () => {
  it('still reports a placeholder rationale as the earlier cause', () => {
    expect(run({ rationale: 'TBD' })).toMatchObject({ ok: false, reason: 'placeholder' });
    expect(run({ rationale: '{{10 years}}' })).toMatchObject({ ok: false, reason: 'placeholder' });
  });

  it('still reports ungrounded evidence as the earlier cause', () => {
    const requirements = [{ text: 'Rust', evidence: 'ten years of Rust', must_have: true }];
    expect(run({ requirements, rationale: 'Needs 10 years.' })).toMatchObject({
      ok: false,
      reason: 'no_grounded_requirement',
    });
  });

  it('still reports a score outside 0-100 as the earlier cause', () => {
    expect(run({ score: 101, rationale: '10 years' })).toMatchObject({
      ok: false,
      reason: 'score',
    });
  });
});
