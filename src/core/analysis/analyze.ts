// The single analysis function (ADR-06; ANALYSIS-1). It makes exactly one provider call, never
// retries, and lets the deterministic chain (post-validation, then `derive`) own every field of
// the result except the model's own judgment. The cache lookup and the usage records belong to the
// service that calls this function.
import { computeCost } from '../cost.ts';
import {
  type CompletionRequest,
  type LlmErrorClass,
  type LlmProvider,
  type ModelEntry,
  ProviderError,
  type Usage,
} from '../ports/llm.ts';
import type { AnalysisFailure, AnalysisOutcome } from '../schemas/analysis.ts';
import type { CvPdfMeta, Profile } from '../schemas/profile.ts';
import { capHeadTail, normalizeOfferText } from '../text.ts';
import { derive } from './derive.ts';
import { OFFER_ANALYSIS_SCHEMA_NAME, offerAnalysisJsonSchema } from './outputSchema.ts';
import { postValidate } from './postValidate.ts';
import { profileVersion } from './profileVersion.ts';
import { buildPrompt, type OfferMeta, PROMPT_VERSION } from './prompt.ts';

/** Ceiling for the structured output of one analysis (design constant, not a spec value). */
export const ANALYSIS_MAX_OUTPUT_TOKENS = 4_096;

export interface AnalyzeInput {
  /** The raw offer text; it is normalized here and capped only for the request (A16). */
  fullText: string;
  offer: OfferMeta;
  snapshot: Profile;
  pdfs: readonly CvPdfMeta[];
  model: ModelEntry;
  outputLanguage: string;
  /** Adapter version of the source portal when known (ANALYSIS-10). */
  adapterVersion: string | null;
  key: string;
  signal: AbortSignal;
}

export interface AnalyzeDeps {
  provider: LlmProvider;
  now(): number;
}

function failure(errorClass: LlmErrorClass, message: string, createdAt: number): AnalysisFailure {
  return { status: 'failed', errorClass, message, createdAt };
}

/** The final event of the one call, or a typed failure. Only a `ProviderError` is converted. */
async function runCall(
  provider: LlmProvider,
  request: CompletionRequest,
  input: AnalyzeInput,
): Promise<{ json: unknown; usage: Usage } | ProviderError | null> {
  try {
    for await (const event of provider.complete(request, input.key, { signal: input.signal })) {
      if (event.type === 'final') return { json: event.json, usage: event.usage };
    }
    return null;
  } catch (error) {
    if (error instanceof ProviderError) return error;
    throw error;
  }
}

export async function analyzeOffer(
  input: AnalyzeInput,
  deps: AnalyzeDeps,
): Promise<AnalysisOutcome> {
  const fullText = normalizeOfferText(input.fullText);
  const { text: requestText, truncated } = capHeadTail(fullText);
  const prompt = buildPrompt(input.snapshot, input.outputLanguage, requestText, input.offer);
  const request: CompletionRequest = {
    modelId: input.model.id,
    prefix: prompt.prefix,
    variable: prompt.variable,
    schemaName: OFFER_ANALYSIS_SCHEMA_NAME,
    jsonSchema: offerAnalysisJsonSchema,
    maxOutputTokens: ANALYSIS_MAX_OUTPUT_TOKENS,
  };

  const called = await runCall(deps.provider, request, input);
  if (called instanceof ProviderError) {
    return failure(called.cls, called.message, deps.now());
  }
  if (called === null) {
    return failure('invalid_output', 'The provider ended without a final result.', deps.now());
  }

  const validated = postValidate(called.json, { requestText, snapshot: input.snapshot });
  if (!validated.ok) {
    return failure('invalid_output', `Invalid output: ${validated.reason}.`, deps.now());
  }

  const { costUsd, estimated } = computeCost(called.usage, input.model.price);
  return derive(validated.output, {
    fullText,
    snapshot: input.snapshot,
    pdfs: input.pdfs,
    meta: {
      cached: false,
      truncated,
      usage: {
        inputTokens: called.usage.inputTokens,
        outputTokens: called.usage.outputTokens,
        cachedInputTokens: called.usage.cachedInputTokens,
        costUsd,
        estimated,
      },
      modelId: input.model.qualifiedId,
      promptVersion: PROMPT_VERSION,
      profileVersion: await profileVersion(input.snapshot, input.outputLanguage),
      adapterVersion: input.adapterVersion,
      outputLanguage: input.outputLanguage,
      createdAt: deps.now(),
    },
  });
}
