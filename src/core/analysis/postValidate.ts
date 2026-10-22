// Deterministic post-validation chain, steps 1-3 (Contract C; ANALYSIS-4; amendments A3, A10).
// Pure: no clamping, no retries, no provider call. Steps 4-8 follow in the next sub-slice and
// step 8b (rationale audit) lands in 2a-7.

import {
  type OfferAnalysisOutput,
  offerAnalysisOutputSchema,
  type ValidatedOutput,
} from '../schemas/analysis.ts';
import type { Profile } from '../schemas/profile.ts';

/** Replaced by `AUDIT_VERSION` when step 8b lands (2a.27). */
const PENDING_AUDIT_VERSION = 'audit-1';

export interface PostValidateContext {
  /** The capped, normalized offer text (ANALYSIS-3); evidence is grounded against it. */
  requestText: string;
  snapshot: Profile;
}

/** Why an output was rejected; each value names the first step that failed. */
export type InvalidReason = 'shape' | 'score' | 'placeholder';

export type PostValidateResult =
  | { ok: true; output: ValidatedOutput }
  | { ok: false; errorClass: 'invalid_output'; reason: InvalidReason };

const WHOLE_STRING_PLACEHOLDERS = new Set([
  'tbd',
  'todo',
  'n/a',
  '...',
  '…',
  'string',
  'number',
  'integer',
  'boolean',
  'array',
  'object',
  'null',
]);
const ANGLE_TEMPLATE = /^<[^<>]*>$/;
const MUSTACHE_TEMPLATE = /\{\{.*?\}\}/s;

function isPlaceholder(text: string): boolean {
  const value = text.trim().toLowerCase();
  return (
    value === '' ||
    WHOLE_STRING_PLACEHOLDERS.has(value) ||
    ANGLE_TEMPLATE.test(value) ||
    value.includes('lorem ipsum') ||
    MUSTACHE_TEMPLATE.test(value)
  );
}

function hasPlaceholder(output: OfferAnalysisOutput): boolean {
  return [
    output.rationale,
    ...output.requirements.map((r) => r.text),
    ...output.walls.map((w) => w.text),
  ].some(isPlaceholder);
}

const invalid = (reason: InvalidReason): PostValidateResult => ({
  ok: false,
  errorClass: 'invalid_output',
  reason,
});

export function postValidate(raw: unknown, _context: PostValidateContext): PostValidateResult {
  const parsed = offerAnalysisOutputSchema.safeParse(raw);
  if (!parsed.success) return invalid('shape');
  const output = parsed.data;
  if (!Number.isInteger(output.score) || output.score < 0 || output.score > 100) {
    return invalid('score');
  }
  if (hasPlaceholder(output)) return invalid('placeholder');
  return {
    ok: true,
    output: {
      requirements: output.requirements.map((r) => ({
        text: r.text,
        evidence: r.evidence,
        mustHave: r.must_have,
      })),
      fit: output.fit.map((f) => ({
        requirement: f.requirement,
        claimIds: f.claim_ids,
        unmatched: false,
      })),
      walls: output.walls,
      score: output.score,
      branchId: output.branch_id === '' ? null : output.branch_id,
      rationale: output.rationale,
      diagnostics: {
        droppedRequirements: 0,
        droppedWalls: { ungrounded: 0, weakEvidence: 0, uncited: 0 },
        removedClaimIds: 0,
        unmatchedFit: 0,
        ungroundedClaims: { count: 0, samples: [], auditVersion: PENDING_AUDIT_VERSION },
      },
    },
  };
}
