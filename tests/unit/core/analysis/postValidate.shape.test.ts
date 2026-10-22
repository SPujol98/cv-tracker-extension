import { describe, expect, it } from 'vitest';
import { postValidate } from '../../../../src/core/analysis/postValidate.ts';
import type { Profile } from '../../../../src/core/schemas/profile.ts';

const snapshot: Profile = {
  id: 'active',
  claims: [{ id: 'c-1', statement: 'Writes TypeScript', tags: [] }],
  branches: [],
  companyBlocklist: [],
  nextClaimSeq: 2,
  nextBranchSeq: 1,
};

const requestText = 'We need five years of TypeScript experience. Remote friendly team.';

const goodOutput = {
  requirements: [
    { text: 'TypeScript experience', evidence: 'five years of TypeScript', must_have: true },
  ],
  fit: [{ requirement: 'TypeScript experience', claim_ids: ['c-1'] }],
  walls: [],
  score: 72,
  branch_id: '',
  rationale: 'Good overlap with the stack.',
};

const run = (over: Record<string, unknown>) =>
  postValidate({ ...goodOutput, ...over }, { requestText, snapshot });

describe('steps 1-3: shape, score, placeholders (ANALYSIS-4 rules 1 and 4)', () => {
  it('accepts a well-formed output', () => {
    expect(run({}).ok).toBe(true);
  });

  it('rejects a shape violation as invalid_output (step 1)', () => {
    const missing = postValidate({ requirements: [] }, { requestText, snapshot });
    expect(missing).toMatchObject({ ok: false, errorClass: 'invalid_output', reason: 'shape' });
    expect(run({ extra: 1 })).toMatchObject({ ok: false, reason: 'shape' });
  });

  it.each([
    ['non-integer', 72.5],
    ['below zero', -1],
    ['above one hundred', 101],
  ])('rejects a %s score and never clamps it (step 2)', (_name, score) => {
    expect(run({ score })).toMatchObject({
      ok: false,
      errorClass: 'invalid_output',
      reason: 'score',
    });
  });

  it.each([0, 100])('accepts the boundary score %i', (score) => {
    const result = run({ score });
    expect(result.ok && result.output.score).toBe(score);
  });

  it.each([
    'TBD',
    ' todo ',
    'N/A',
    '...',
    '…',
    '<word>',
    '<your rationale here>',
    'String',
    'number',
    'integer',
    'boolean',
    'array',
    'object',
    'null',
    '   ',
    '',
    'Intro Lorem Ipsum dolor',
    'see {{rationale}} here',
  ])('rejects placeholder rationale %j (step 3)', (rationale) => {
    expect(run({ rationale })).toMatchObject({
      ok: false,
      errorClass: 'invalid_output',
      reason: 'placeholder',
    });
  });

  it('checks requirement text and wall text as well as the rationale', () => {
    const requirement = { text: 'tbd', evidence: 'five years of TypeScript', must_have: true };
    expect(run({ requirements: [requirement] })).toMatchObject({ reason: 'placeholder' });
    const wall = {
      text: '<text>',
      evidence: 'Remote friendly team',
      basis: 'dealbreaker' as const,
      ref: 'b-1/d0',
    };
    expect(run({ walls: [wall] })).toMatchObject({ reason: 'placeholder' });
  });

  it('keeps a longer legitimate phrase that merely contains a type word', () => {
    expect(run({ rationale: 'string theory background is a plus' }).ok).toBe(true);
    expect(run({ rationale: 'Mentions an object-oriented design test' }).ok).toBe(true);
  });

  it('runs placeholders before grounding, so a placeholder in an ungrounded requirement still fails', () => {
    const requirement = { text: 'n/a', evidence: 'not in the offer at all', must_have: false };
    const result = run({ requirements: [goodOutput.requirements[0], requirement] });
    expect(result).toMatchObject({ ok: false, reason: 'placeholder' });
  });

  it('reports the earliest failing step: a bad score beats a placeholder', () => {
    expect(run({ score: 150, rationale: 'tbd' })).toMatchObject({ ok: false, reason: 'score' });
  });
});
