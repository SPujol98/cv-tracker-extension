// Verdict derivation (ANALYSIS-5; amendments A12, A18; Contract D).

import type { VERDICT_REASONS, VERDICTS } from '../schemas/analysis.ts';

/** Score at or above which an offer is worth applying to (ANALYSIS-5, assumption). */
export const APPLY_THRESHOLD = 70;

/** Score at or above which an offer is worth a look (ANALYSIS-5, assumption). */
export const REVIEW_THRESHOLD = 40;

export type Verdict = (typeof VERDICTS)[number];
export type VerdictReason = (typeof VERDICT_REASONS)[number];

/**
 * The only inputs of the verdict. There is deliberately no rationale or other free-text field:
 * the audit count stands in for the rationale (ANALYSIS-5, review follow-up R3).
 */
export interface VerdictInput {
  score: number;
  acceptedWalls: readonly unknown[];
  injectionSuspected: boolean;
  /** Count produced by the deterministic rationale audit (ANALYSIS-11). */
  ungroundedClaims: number;
}

/**
 * A wall always skips. A score at or above the apply threshold applies unless injection signals
 * (recorded first) or ungrounded claims downgrade it to review. Downgrades never touch a review
 * or a skip, never upgrade and never add walls.
 */
export function deriveVerdict(input: VerdictInput): { verdict: Verdict; reason: VerdictReason } {
  if (input.acceptedWalls.length > 0) return { verdict: 'skip', reason: 'wall' };
  if (input.score >= APPLY_THRESHOLD) {
    if (input.injectionSuspected) return { verdict: 'review', reason: 'injection_downgrade' };
    if (input.ungroundedClaims > 0) return { verdict: 'review', reason: 'grounding_downgrade' };
    return { verdict: 'apply', reason: 'score' };
  }
  if (input.score >= REVIEW_THRESHOLD) return { verdict: 'review', reason: 'score' };
  return { verdict: 'skip', reason: 'score' };
}
