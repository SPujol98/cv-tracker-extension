// Deterministic post-validation chain, steps 1-8b (Contract C; ANALYSIS-4, ANALYSIS-11; amendments
// A3, A10, A18). Pure: no clamping, no retries, no provider call.

import {
  type OfferAnalysisOutput,
  offerAnalysisOutputSchema,
  type ValidatedOutput,
} from '../schemas/analysis.ts';
import type { Profile } from '../schemas/profile.ts';
import { fold, words } from '../text.ts';
import { dealbreakerRefs } from './profileVersion.ts';
import { auditOutput } from './rationaleAudit.ts';

export interface PostValidateContext {
  /** The capped, normalized offer text (ANALYSIS-3); evidence is grounded against it. */
  requestText: string;
  snapshot: Profile;
}

/** Why an output was rejected; each value names the first step that failed. */
export type InvalidReason =
  | 'shape'
  | 'score'
  | 'placeholder'
  | 'no_grounded_requirement'
  | 'no_strong_requirement';

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

/** Evidence floor for walls and for "at least one strong requirement" (A10). */
const MIN_EVIDENCE_CHARS = 3;
const STRONG_WORDS = 2;
const STRONG_CHARS = 12;

/** Evidence is grounded when its folded form is a substring of the folded offer text (A3). */
function makeGrounding(requestText: string) {
  const haystack = fold(requestText);
  const isGrounded = (evidence: string): boolean => {
    const folded = fold(evidence);
    return folded.length >= MIN_EVIDENCE_CHARS && haystack.includes(folded);
  };
  const isStrong = (evidence: string): boolean => {
    const folded = fold(evidence);
    return (
      isGrounded(evidence) && words(folded).length >= STRONG_WORDS && folded.length >= STRONG_CHARS
    );
  };
  return { isGrounded, isStrong };
}

type Wall = ValidatedOutput['walls'][number];
type Diagnostics = ValidatedOutput['diagnostics'];

export function postValidate(raw: unknown, context: PostValidateContext): PostValidateResult {
  // Steps 1-3: shape, score, placeholders. Placeholders run before grounding on purpose.
  const parsed = offerAnalysisOutputSchema.safeParse(raw);
  if (!parsed.success) return invalid('shape');
  const output = parsed.data;
  if (!Number.isInteger(output.score) || output.score < 0 || output.score > 100) {
    return invalid('score');
  }
  if (hasPlaceholder(output)) return invalid('placeholder');

  const { isGrounded, isStrong } = makeGrounding(context.requestText);

  // Steps 4-5: grounding, then at least one kept requirement with strong evidence.
  const requirements = output.requirements
    .filter((r) => isGrounded(r.evidence))
    .map((r) => ({ text: r.text, evidence: r.evidence, mustHave: r.must_have }));
  if (requirements.length === 0) return invalid('no_grounded_requirement');
  if (!requirements.some((r) => isStrong(r.evidence))) return invalid('no_strong_requirement');

  // Step 6: claim ids absent from the snapshot are removed; an entry left empty is unmatched.
  const knownClaimIds = new Set(context.snapshot.claims.map((c) => c.id));
  let removedClaimIds = 0;
  const fit = output.fit.map((entry) => {
    const claimIds = entry.claim_ids.filter((id) => knownClaimIds.has(id));
    removedClaimIds += entry.claim_ids.length - claimIds.length;
    return { requirement: entry.requirement, claimIds, unmatched: claimIds.length === 0 };
  });

  // Step 7: walls need strong evidence and a citation that resolves.
  const refs = dealbreakerRefs(context.snapshot);
  const unmetMustHaves = new Set(
    requirements
      .filter((r) => r.mustHave)
      .filter((r) => !fit.some((f) => !f.unmatched && fold(f.requirement) === fold(r.text)))
      .map((r) => fold(r.text)),
  );
  const droppedWalls = { ungrounded: 0, weakEvidence: 0, uncited: 0 };
  const walls: Wall[] = [];
  for (const wall of output.walls) {
    if (!isGrounded(wall.evidence)) droppedWalls.ungrounded++;
    else if (!isStrong(wall.evidence)) droppedWalls.weakEvidence++;
    else if (
      wall.basis === 'dealbreaker' ? !refs.has(wall.ref) : !unmetMustHaves.has(fold(wall.ref))
    ) {
      droppedWalls.uncited++;
    } else walls.push(wall);
  }

  // Step 8: an unknown or empty branch id becomes null.
  const branchId = context.snapshot.branches.some((b) => b.id === output.branch_id)
    ? output.branch_id
    : null;

  const diagnostics: Diagnostics = {
    droppedRequirements: output.requirements.length - requirements.length,
    droppedWalls,
    removedClaimIds,
    unmatchedFit: fit.filter((f) => f.unmatched).length,
    // Step 8b: recorded only. It never rejects, rescores, marks fit unmatched or adds a wall, and
    // derived step 9b recomputes it on every result, so this stored value is never trusted.
    ungroundedClaims: auditOutput({
      rationale: output.rationale,
      score: output.score,
      requestText: context.requestText,
      snapshot: context.snapshot,
    }),
  };
  return {
    ok: true,
    output: {
      requirements,
      fit,
      walls,
      score: output.score,
      branchId,
      rationale: output.rationale,
      diagnostics,
    },
  };
}
