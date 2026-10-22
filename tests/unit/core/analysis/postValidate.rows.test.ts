import { describe, expect, it } from 'vitest';
import { postValidate } from '../../../../src/core/analysis/postValidate.ts';
import type { ValidatedOutput } from '../../../../src/core/schemas/analysis.ts';
import type { Profile } from '../../../../src/core/schemas/profile.ts';

const snapshot: Profile = {
  id: 'active',
  claims: [
    { id: 'c-1', statement: 'Writes TypeScript', tags: [] },
    { id: 'c-2', statement: 'Runs Postgres', tags: [] },
  ],
  branches: [
    {
      id: 'b-1',
      name: 'Backend',
      titleFilter: { includeGroups: [], excludeTerms: [] },
      rules: [],
      dealbreakers: ['no on-site work', 'no on-call'],
    },
  ],
  companyBlocklist: [],
  nextClaimSeq: 3,
  nextBranchSeq: 2,
};

const requestText =
  'Strong   Knowledge of\nPostgreSQL. We need five years of TypeScript. ' +
  'The team works “on-site” five days a week — no remote. Weekend on-call duty is required. ' +
  'Fluent Java skills. Java Internationalization';

const req = (text: string, evidence: string, must_have = true) => ({ text, evidence, must_have });

const strongReq = req('TypeScript experience', 'five years of TypeScript');

const base = {
  requirements: [strongReq],
  fit: [{ requirement: 'TypeScript experience', claim_ids: ['c-1'] }],
  walls: [] as unknown[],
  score: 60,
  branch_id: 'b-1',
  rationale: 'Overlaps with the stack.',
};

const ctx = { requestText, snapshot };
const ok = (over: Record<string, unknown> = {}): ValidatedOutput => {
  const result = postValidate({ ...base, ...over }, ctx);
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  return result.output;
};
const failure = (over: Record<string, unknown>) => postValidate({ ...base, ...over }, ctx);

describe('step 4: grounding', () => {
  it('drops an ungrounded requirement and counts it', () => {
    const out = ok({
      requirements: [
        strongReq,
        req('Rust', 'ten years of Rust'),
        req('Go', 'ten years of Go'),
        req('Kafka', 'Kafka streaming'),
      ],
    });
    expect(out.requirements.map((r) => r.text)).toEqual(['TypeScript experience']);
    expect(out.diagnostics.droppedRequirements).toBe(3);
  });

  it('keeps three of four when only one is ungrounded', () => {
    const out = ok({
      requirements: [
        strongReq,
        req('Postgres', 'strong knowledge of postgresql'),
        req('Java', 'Fluent Java skills'),
        req('Rust', 'ten years of Rust'),
      ],
    });
    expect(out.requirements).toHaveLength(3);
    expect(out.diagnostics.droppedRequirements).toBe(1);
  });

  it('tolerates whitespace, case, typographic quotes and dashes', () => {
    const out = ok({
      requirements: [
        strongReq,
        req('Postgres', 'strong knowledge of postgresql'),
        req('Site', 'works "on-site" five days'),
        req('Remote', 'a week - no remote'),
      ],
    });
    expect(out.requirements).toHaveLength(4);
    expect(out.diagnostics.droppedRequirements).toBe(0);
  });

  it('requires at least 3 characters of evidence', () => {
    const out = ok({ requirements: [strongReq, req('On', ' ON ')] });
    expect(out.requirements).toHaveLength(1);
    expect(out.diagnostics.droppedRequirements).toBe(1);
  });
});

describe('step 5: something grounded and strong', () => {
  it('is invalid_output when nothing is grounded', () => {
    expect(failure({ requirements: [req('Rust', 'ten years of Rust')] })).toMatchObject({
      ok: false,
      errorClass: 'invalid_output',
      reason: 'no_grounded_requirement',
    });
  });

  it('is invalid_output when there are no requirements at all', () => {
    expect(failure({ requirements: [] })).toMatchObject({ reason: 'no_grounded_requirement' });
  });

  it('is invalid_output when no kept requirement has strong evidence', () => {
    expect(failure({ requirements: [req('Java', 'Java')] })).toMatchObject({
      reason: 'no_strong_requirement',
    });
    // 2 words but only 10 folded characters, and 11 characters
    expect(failure({ requirements: [req('Java', 'java skill')] })).toMatchObject({
      reason: 'no_strong_requirement',
    });
    // one word of 20 characters
    expect(failure({ requirements: [req('I18n', 'internationalization')] })).toMatchObject({
      reason: 'no_strong_requirement',
    });
    expect(failure({ requirements: [req('Duty', 'on-call dut')] })).toMatchObject({
      reason: 'no_strong_requirement',
    });
  });

  it('accepts evidence of exactly 2 words and 12 characters', () => {
    expect(ok({ requirements: [req('Duty', ' on-call duty ')] }).requirements).toHaveLength(1);
  });

  it('is satisfied by one strong requirement next to weak ones', () => {
    const out = ok({ requirements: [req('Java', 'Java'), strongReq] });
    expect(out.requirements).toHaveLength(2);
  });
});

describe('step 6: claim ids', () => {
  it('removes unknown ids and counts them', () => {
    const out = ok({ fit: [{ requirement: 'TypeScript experience', claim_ids: ['c-1', 'c-99'] }] });
    expect(out.fit).toEqual([
      { requirement: 'TypeScript experience', claimIds: ['c-1'], unmatched: false },
    ]);
    expect(out.diagnostics.removedClaimIds).toBe(1);
    expect(out.diagnostics.unmatchedFit).toBe(0);
  });

  it('keeps an entry left with no ids as unmatched', () => {
    const out = ok({ fit: [{ requirement: 'TypeScript experience', claim_ids: ['c-99'] }] });
    expect(out.fit).toEqual([
      { requirement: 'TypeScript experience', claimIds: [], unmatched: true },
    ]);
    expect(out.diagnostics.removedClaimIds).toBe(1);
    expect(out.diagnostics.unmatchedFit).toBe(1);
  });

  it('marks an entry that arrived without ids as unmatched too', () => {
    const out = ok({ fit: [{ requirement: 'TypeScript experience', claim_ids: [] }] });
    expect(out.fit[0]).toMatchObject({ claimIds: [], unmatched: true });
    expect(out.diagnostics.removedClaimIds).toBe(0);
  });
});

const wall = (over: Record<string, unknown> = {}) => ({
  text: 'Works on-site',
  evidence: 'five days a week',
  basis: 'dealbreaker',
  ref: 'b-1/d0',
  ...over,
});

describe('step 7: walls', () => {
  it('keeps a strong, grounded wall that cites an existing dealbreaker', () => {
    const out = ok({ walls: [wall()] });
    expect(out.walls).toEqual([wall()]);
    expect(out.diagnostics.droppedWalls).toEqual({ ungrounded: 0, weakEvidence: 0, uncited: 0 });
  });

  it('drops a wall with weak evidence such as "on site"', () => {
    const out = ok({ walls: [wall({ evidence: 'on-site' })] });
    expect(out.walls).toEqual([]);
    expect(out.diagnostics.droppedWalls).toEqual({ ungrounded: 0, weakEvidence: 1, uncited: 0 });
  });

  it('drops a wall citing an unknown dealbreaker ref as uncited', () => {
    const out = ok({ walls: [wall({ ref: 'b-1/d9' })] });
    expect(out.walls).toEqual([]);
    expect(out.diagnostics.droppedWalls).toEqual({ ungrounded: 0, weakEvidence: 0, uncited: 1 });
  });

  it('drops a wall whose evidence is not in the offer as ungrounded', () => {
    const out = ok({ walls: [wall({ evidence: 'relocation to Berlin is mandatory' })] });
    expect(out.walls).toEqual([]);
    expect(out.diagnostics.droppedWalls).toEqual({ ungrounded: 1, weakEvidence: 0, uncited: 0 });
  });

  const unmet = (ref: string) =>
    wall({
      text: 'Needs Java',
      evidence: 'Fluent Java skills',
      basis: 'unmet_must_have',
      ref,
    });
  const javaReq = req('Java skills', 'Fluent Java skills');

  it('keeps an unmet_must_have wall whose ref fold-equals a kept must-have with no claim', () => {
    const out = ok({
      requirements: [strongReq, javaReq],
      fit: [{ requirement: 'Java skills', claim_ids: ['c-99'] }],
      walls: [unmet('  JAVA Skills ')],
    });
    expect(out.walls).toHaveLength(1);
  });

  it('keeps it when the requirement has no fit entry at all', () => {
    const out = ok({ requirements: [strongReq, javaReq], walls: [unmet('Java skills')] });
    expect(out.walls).toHaveLength(1);
  });

  it('drops it when the requirement has a matching claim', () => {
    const out = ok({
      requirements: [strongReq, javaReq],
      fit: [{ requirement: 'Java skills', claim_ids: ['c-1'] }],
      walls: [unmet('Java skills')],
    });
    expect(out.walls).toEqual([]);
    expect(out.diagnostics.droppedWalls.uncited).toBe(1);
  });

  it('drops it when the ref matches a nice-to-have or a dropped requirement', () => {
    const niceToHave = req('Java skills', 'Fluent Java skills', false);
    expect(
      ok({ requirements: [strongReq, niceToHave], walls: [unmet('Java skills')] }).walls,
    ).toEqual([]);
    const dropped = req('Rust skills', 'ten years of Rust');
    expect(ok({ requirements: [strongReq, dropped], walls: [unmet('Rust skills')] }).walls).toEqual(
      [],
    );
  });
});

describe('step 8: branch', () => {
  it('keeps an existing branch id', () => {
    expect(ok({ branch_id: 'b-1' }).branchId).toBe('b-1');
  });

  it('turns an unknown branch id into null', () => {
    expect(ok({ branch_id: 'b-42' }).branchId).toBeNull();
  });

  it('turns the empty string into null', () => {
    expect(ok({ branch_id: '' }).branchId).toBeNull();
  });
});

describe('result shape', () => {
  it('carries score and rationale untouched and a zeroed audit diagnostic', () => {
    const out = ok({ score: 88, rationale: 'Because.' });
    expect(out.score).toBe(88);
    expect(out.rationale).toBe('Because.');
    expect(out.diagnostics.ungroundedClaims.count).toBe(0);
    expect(out.diagnostics.ungroundedClaims.samples).toEqual([]);
  });
});
