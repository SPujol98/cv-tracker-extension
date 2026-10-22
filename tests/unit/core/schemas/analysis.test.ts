import { describe, expect, it } from 'vitest';
import {
  type AnalysisResult,
  analysisFailureSchema,
  analysisOutcomeSchema,
  analysisResultSchema,
  diagnosticsSchema,
  offerAnalysisOutputSchema,
  validatedOutputSchema,
} from '../../../../src/core/schemas/analysis.ts';

const validOutput = {
  requirements: [
    { text: 'Five years of TypeScript', evidence: '5+ years TypeScript', must_have: true },
  ],
  fit: [{ requirement: 'Five years of TypeScript', claim_ids: ['c-1'] }],
  walls: [
    {
      text: 'On-site only',
      evidence: 'on-site five days',
      basis: 'dealbreaker' as const,
      ref: 'b-1/d0',
    },
  ],
  score: 72,
  branch_id: 'b-1',
  rationale: 'Strong overlap with the listed stack.',
};

const diagnostics = {
  droppedRequirements: 0,
  droppedWalls: { ungrounded: 0, weakEvidence: 0, uncited: 0 },
  removedClaimIds: 0,
  unmatchedFit: 0,
  ungroundedClaims: { count: 0, samples: [] as string[], auditVersion: 'audit-1' },
};

const pdf = {
  id: 'pdf-1',
  branchId: 'b-1',
  language: 'en',
  fileName: 'cv-en.pdf',
  size: 1024,
  sha256: 'a'.repeat(64),
  addedAt: 1_700_000_000_000,
};

const validResult: AnalysisResult = {
  status: 'ok',
  score: 72,
  verdict: 'apply',
  verdictReason: 'score',
  requirements: [
    { text: 'Five years of TypeScript', evidence: '5+ years TypeScript', mustHave: true },
  ],
  fit: [{ requirement: 'Five years of TypeScript', claimIds: ['c-1'], unmatched: false }],
  walls: [],
  rationale: 'Strong overlap with the listed stack.',
  language: 'en',
  applyWarnings: [{ category: 'cover_letter', excerpt: 'Please attach a cover letter.' }],
  branchId: 'b-1',
  branchName: 'Backend',
  pdf,
  pdfReason: null,
  pdfAlternatives: [],
  truncated: false,
  cached: false,
  usage: {
    inputTokens: 1000,
    outputTokens: 200,
    cachedInputTokens: 0,
    costUsd: 0.002,
    estimated: false,
  },
  modelId: 'anthropic/test-model',
  promptVersion: 'analysis-2',
  profileVersion: 'f'.repeat(64),
  adapterVersion: 'linkedin-1',
  outputLanguage: 'en',
  diagnostics,
  flags: { injectionSuspected: false, injectionMatches: [] },
  createdAt: 1_700_000_000_000,
};

describe('OfferAnalysisOutput (ANALYSIS-1)', () => {
  it('accepts a complete output', () => {
    expect(offerAnalysisOutputSchema.safeParse(validOutput).success).toBe(true);
  });

  it.each(Object.keys(validOutput))('requires the top-level field %s', (key) => {
    const { [key as keyof typeof validOutput]: _removed, ...rest } = validOutput;
    expect(offerAnalysisOutputSchema.safeParse(rest).success).toBe(false);
  });

  it.each(['basis', 'ref', 'text', 'evidence'])('requires walls[].%s', (key) => {
    const wall = { ...validOutput.walls[0] } as Record<string, unknown>;
    delete wall[key];
    expect(offerAnalysisOutputSchema.safeParse({ ...validOutput, walls: [wall] }).success).toBe(
      false,
    );
  });

  it('rejects a wall basis outside the closed set', () => {
    const walls = [{ ...validOutput.walls[0], basis: 'gut_feeling' }];
    expect(offerAnalysisOutputSchema.safeParse({ ...validOutput, walls }).success).toBe(false);
  });

  it('fails on an extra top-level key', () => {
    expect(offerAnalysisOutputSchema.safeParse({ ...validOutput, extra: 1 }).success).toBe(false);
  });

  it('fails on an extra key inside a nested entry', () => {
    const requirements = [{ ...validOutput.requirements[0], extra: true }];
    expect(offerAnalysisOutputSchema.safeParse({ ...validOutput, requirements }).success).toBe(
      false,
    );
    const walls = [{ ...validOutput.walls[0], extra: true }];
    expect(offerAnalysisOutputSchema.safeParse({ ...validOutput, walls }).success).toBe(false);
  });

  it('leaves score bounds to post-validation (any number parses)', () => {
    expect(offerAnalysisOutputSchema.safeParse({ ...validOutput, score: 101.5 }).success).toBe(
      true,
    );
    expect(offerAnalysisOutputSchema.safeParse({ ...validOutput, score: '72' }).success).toBe(
      false,
    );
  });

  it('allows an empty branch_id', () => {
    expect(offerAnalysisOutputSchema.safeParse({ ...validOutput, branch_id: '' }).success).toBe(
      true,
    );
  });
});

describe('Diagnostics (ANALYSIS-4, ANALYSIS-11; A18)', () => {
  it('accepts the audit-free default', () => {
    expect(diagnosticsSchema.safeParse(diagnostics).success).toBe(true);
  });

  it('requires ungroundedClaims', () => {
    const { ungroundedClaims: _removed, ...rest } = diagnostics;
    expect(diagnosticsSchema.safeParse(rest).success).toBe(false);
  });

  it('accepts five samples of exactly 40 characters', () => {
    const samples = Array.from({ length: 5 }, () => 'x'.repeat(40));
    const parsed = diagnosticsSchema.safeParse({
      ...diagnostics,
      ungroundedClaims: { count: 7, samples, auditVersion: 'audit-1' },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a sixth sample', () => {
    const samples = Array.from({ length: 6 }, () => 'x');
    const parsed = diagnosticsSchema.safeParse({
      ...diagnostics,
      ungroundedClaims: { count: 6, samples, auditVersion: 'audit-1' },
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a sample longer than 40 characters', () => {
    const parsed = diagnosticsSchema.safeParse({
      ...diagnostics,
      ungroundedClaims: { count: 1, samples: ['x'.repeat(41)], auditVersion: 'audit-1' },
    });
    expect(parsed.success).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['missing', undefined],
  ])('rejects an %s auditVersion', (_name, auditVersion) => {
    const parsed = diagnosticsSchema.safeParse({
      ...diagnostics,
      ungroundedClaims: { count: 0, samples: [], auditVersion },
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a negative or fractional count', () => {
    for (const count of [-1, 1.5]) {
      const parsed = diagnosticsSchema.safeParse({
        ...diagnostics,
        ungroundedClaims: { count, samples: [], auditVersion: 'audit-1' },
      });
      expect(parsed.success).toBe(false);
    }
  });

  it('requires every drop counter', () => {
    const { removedClaimIds: _a, ...withoutRemoved } = diagnostics;
    expect(diagnosticsSchema.safeParse(withoutRemoved).success).toBe(false);
    const droppedWalls = { ungrounded: 0, weakEvidence: 0 };
    expect(diagnosticsSchema.safeParse({ ...diagnostics, droppedWalls }).success).toBe(false);
  });
});

describe('ValidatedOutput (Contract C)', () => {
  const validated = {
    requirements: validResult.requirements,
    fit: validResult.fit,
    walls: validResult.walls,
    score: 72,
    branchId: null,
    rationale: 'Fine.',
    diagnostics,
  };

  it('carries the validated fields and diagnostics', () => {
    expect(validatedOutputSchema.parse(validated)).toEqual(validated);
  });

  it('requires diagnostics', () => {
    const { diagnostics: _removed, ...rest } = validated;
    expect(validatedOutputSchema.safeParse(rest).success).toBe(false);
  });
});

describe('AnalysisResult (ANALYSIS-10)', () => {
  it('round-trips through JSON serialization unchanged', () => {
    const revived = analysisResultSchema.parse(JSON.parse(JSON.stringify(validResult)));
    expect(revived).toEqual(validResult);
  });

  it('exposes every ANALYSIS-10 field', () => {
    const fields = [
      'score',
      'verdict',
      'verdictReason',
      'fit',
      'walls',
      'requirements',
      'language',
      'applyWarnings',
      'branchId',
      'branchName',
      'pdf',
      'pdfReason',
      'pdfAlternatives',
      'truncated',
      'cached',
      'usage',
      'modelId',
      'promptVersion',
      'profileVersion',
      'adapterVersion',
      'outputLanguage',
      'diagnostics',
      'flags',
      'createdAt',
    ];
    const parsed = analysisResultSchema.parse(validResult) as Record<string, unknown>;
    for (const field of fields) expect(parsed).toHaveProperty(field);
    for (const field of fields) {
      const { [field as keyof AnalysisResult]: _removed, ...rest } = validResult;
      expect(analysisResultSchema.safeParse(rest).success, field).toBe(false);
    }
  });

  it('accepts a result with no recommended PDF and a reason instead', () => {
    const withoutPdf = {
      ...validResult,
      pdf: null,
      pdfReason: 'no_pdf_for_language',
      pdfAlternatives: [pdf],
      adapterVersion: null,
      branchId: null,
      branchName: null,
    };
    expect(analysisResultSchema.safeParse(withoutPdf).success).toBe(true);
  });

  it('requires diagnostics with ungroundedClaims on every success', () => {
    const { ungroundedClaims: _removed, ...partial } = diagnostics;
    expect(analysisResultSchema.safeParse({ ...validResult, diagnostics: partial }).success).toBe(
      false,
    );
  });

  it('rejects a verdict outside the closed set and a failure status', () => {
    expect(analysisResultSchema.safeParse({ ...validResult, verdict: 'maybe' }).success).toBe(
      false,
    );
    expect(analysisResultSchema.safeParse({ ...validResult, status: 'failed' }).success).toBe(
      false,
    );
  });

  it('accepts every verdict reason including grounding_downgrade', () => {
    for (const verdictReason of ['wall', 'score', 'injection_downgrade', 'grounding_downgrade']) {
      expect(analysisResultSchema.safeParse({ ...validResult, verdictReason }).success).toBe(true);
    }
  });
});

describe('AnalysisFailure', () => {
  const failure = {
    status: 'failed',
    errorClass: 'invalid_output',
    message: 'The model returned no usable evidence.',
    createdAt: 1_700_000_000_000,
  };

  it('parses a failure', () => {
    expect(analysisFailureSchema.parse(failure)).toEqual(failure);
  });

  it('has no verdict: a verdict key fails parsing', () => {
    expect(analysisFailureSchema.safeParse({ ...failure, verdict: 'skip' }).success).toBe(false);
  });

  it('only accepts error classes of the closed taxonomy', () => {
    expect(analysisFailureSchema.safeParse({ ...failure, errorClass: 'oops' }).success).toBe(false);
  });

  it('is told apart from a success by status', () => {
    expect(analysisOutcomeSchema.parse(failure).status).toBe('failed');
    expect(analysisOutcomeSchema.parse(validResult).status).toBe('ok');
    expect(analysisOutcomeSchema.safeParse({ ...failure, status: 'ok' }).success).toBe(false);
  });
});
