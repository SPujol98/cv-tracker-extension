// Analysis schemas (ANALYSIS-1, ANALYSIS-10, ANALYSIS-11; amendment A18). Zod is the single source
// of truth for the types below (`z.infer`).
import { z } from 'zod';
import { LLM_ERROR_CLASSES } from '../ports/llm.ts';
import { cvPdfMetaSchema } from './profile.ts';

/** Most samples and longest sample kept for the ungrounded-claim diagnostics (A18). */
export const MAX_UNGROUNDED_SAMPLES = 5;
export const MAX_UNGROUNDED_SAMPLE_CHARS = 40;

const count = z.number().int().nonnegative();

/**
 * The flat structured output requested from the model (`offer_analysis_v2`). Every field is
 * required and unknown keys fail. The score is any number here; the integer and 0..100 checks
 * belong to post-validation because the provider schema cannot bound it.
 */
export const offerAnalysisOutputSchema = z
  .object({
    requirements: z.array(
      z.object({ text: z.string(), evidence: z.string(), must_have: z.boolean() }).strict(),
    ),
    fit: z.array(z.object({ requirement: z.string(), claim_ids: z.array(z.string()) }).strict()),
    walls: z.array(
      z
        .object({
          text: z.string(),
          evidence: z.string(),
          basis: z.enum(['dealbreaker', 'unmet_must_have']),
          /** A dealbreaker reference (`b-2/d1`) or the text of an unmet must-have requirement. */
          ref: z.string(),
        })
        .strict(),
    ),
    score: z.number(),
    /** The empty string is allowed and becomes `null` in post-validation. */
    branch_id: z.string(),
    rationale: z.string(),
  })
  .strict();

export type OfferAnalysisOutput = z.infer<typeof offerAnalysisOutputSchema>;

/** What the deterministic post-validation counted while cleaning the output (Contract C). */
export const diagnosticsSchema = z.object({
  droppedRequirements: count,
  droppedWalls: z.object({ ungrounded: count, weakEvidence: count, uncited: count }),
  removedClaimIds: count,
  unmatchedFit: count,
  /**
   * Quantitative rationale claims not found in the evidence corpus (A18). An audit-free result
   * has `count: 0` and `samples: []`; `auditVersion` names the audit that produced the value.
   */
  ungroundedClaims: z.object({
    count,
    samples: z.array(z.string().max(MAX_UNGROUNDED_SAMPLE_CHARS)).max(MAX_UNGROUNDED_SAMPLES),
    auditVersion: z.string().min(1),
  }),
});

export type Diagnostics = z.infer<typeof diagnosticsSchema>;

const requirementSchema = z.object({
  text: z.string(),
  evidence: z.string(),
  mustHave: z.boolean(),
});

const fitSchema = z.object({
  requirement: z.string(),
  claimIds: z.array(z.string()),
  unmatched: z.boolean(),
});

const wallSchema = z.object({
  text: z.string(),
  evidence: z.string(),
  basis: z.enum(['dealbreaker', 'unmet_must_have']),
  ref: z.string(),
});

/** The output of post-validation steps 1-8b: what the analysis cache stores (Contract D). */
export const validatedOutputSchema = z.object({
  requirements: z.array(requirementSchema),
  fit: z.array(fitSchema),
  walls: z.array(wallSchema),
  score: z.number(),
  branchId: z.string().nullable(),
  rationale: z.string(),
  diagnostics: diagnosticsSchema,
});

export type ValidatedOutput = z.infer<typeof validatedOutputSchema>;

export const VERDICTS = ['apply', 'review', 'skip'] as const;
export const VERDICT_REASONS = [
  'wall',
  'score',
  'injection_downgrade',
  'grounding_downgrade',
] as const;
export const WARNING_CATEGORIES = [
  'email',
  'phone',
  'external_site',
  'cover_letter',
  'salary_expectation',
  'start_date',
  'reference',
  'portfolio',
] as const;
export const PDF_REASONS = ['no_branch', 'language_unknown', 'no_pdf_for_language'] as const;

/** A successful analysis with every field of ANALYSIS-10. */
export const analysisResultSchema = z.object({
  status: z.literal('ok'),
  score: z.number(),
  verdict: z.enum(VERDICTS),
  verdictReason: z.enum(VERDICT_REASONS),
  requirements: z.array(requirementSchema),
  fit: z.array(fitSchema),
  walls: z.array(wallSchema),
  rationale: z.string(),
  /** A language code from the language table, or `unknown`. */
  language: z.string(),
  applyWarnings: z.array(z.object({ category: z.enum(WARNING_CATEGORIES), excerpt: z.string() })),
  branchId: z.string().nullable(),
  branchName: z.string().nullable(),
  pdf: cvPdfMetaSchema.nullable(),
  pdfReason: z.enum(PDF_REASONS).nullable(),
  pdfAlternatives: z.array(cvPdfMetaSchema),
  truncated: z.boolean(),
  cached: z.boolean(),
  usage: z.object({
    inputTokens: count,
    outputTokens: count,
    cachedInputTokens: count,
    costUsd: z.number().nonnegative(),
    estimated: z.boolean(),
  }),
  modelId: z.string(),
  promptVersion: z.string(),
  profileVersion: z.string(),
  adapterVersion: z.string().nullable(),
  outputLanguage: z.string(),
  diagnostics: diagnosticsSchema,
  flags: z.object({ injectionSuspected: z.boolean(), injectionMatches: z.array(z.string()) }),
  createdAt: z.number(),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

/** A failed analysis. It never carries a verdict, so an unknown `verdict` key fails parsing. */
export const analysisFailureSchema = z
  .object({
    status: z.literal('failed'),
    errorClass: z.enum(LLM_ERROR_CLASSES),
    message: z.string(),
    createdAt: z.number(),
  })
  .strict();

export type AnalysisFailure = z.infer<typeof analysisFailureSchema>;

export const analysisOutcomeSchema = z.discriminatedUnion('status', [
  analysisResultSchema,
  analysisFailureSchema,
]);

export type AnalysisOutcome = z.infer<typeof analysisOutcomeSchema>;
