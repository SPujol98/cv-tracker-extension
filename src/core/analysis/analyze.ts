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

const CANCELLED_MESSAGE = 'The analysis was cancelled.';

function failure(
  errorClass: LlmErrorClass,
  message: string,
  createdAt: number,
  usage?: AnalysisFailure['usage'],
): AnalysisFailure {
  return usage
    ? { status: 'failed', errorClass, message, usage, createdAt }
    : { status: 'failed', errorClass, message, createdAt };
}

/** The usage of one call priced with the model's catalog price (success and discarded results). */
function billedUsage(usage: Usage, model: ModelEntry): NonNullable<AnalysisFailure['usage']> {
  const { costUsd, estimated } = computeCost(usage, model.price);
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    costUsd,
    estimated,
  };
}

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

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
    // A transport that was aborted may surface a raw AbortError; the abort is the cause (ADR-21).
    // Any other error (a TypeError, say) is a programming bug and surfaces even when aborted.
    if (input.signal.aborted && isAbortError(error)) {
      return new ProviderError('cancelled', CANCELLED_MESSAGE);
    }
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

  // Cancelled before the call: no provider call is made and nothing is derived (ADR-21).
  if (input.signal.aborted) return failure('cancelled', CANCELLED_MESSAGE, deps.now());

  const called = await runCall(deps.provider, request, input);
  // Once the signal is aborted the abort is the cause, whatever class the transport reported
  // (ADR-21). A result that lands after the abort is discarded, so the caller never caches or saves
  // it; the provider already billed that call, so its usage stays on the failure (R4-001).
  if (input.signal.aborted) {
    const usage =
      called && !(called instanceof ProviderError) && billedUsage(called.usage, input.model);
    return failure('cancelled', CANCELLED_MESSAGE, deps.now(), usage || undefined);
  }
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

  return derive(validated.output, {
    fullText,
    requestText,
    snapshot: input.snapshot,
    pdfs: input.pdfs,
    meta: {
      cached: false,
      truncated,
      usage: billedUsage(called.usage, input.model),
      modelId: input.model.qualifiedId,
      promptVersion: PROMPT_VERSION,
      profileVersion: await profileVersion(input.snapshot, input.outputLanguage),
      adapterVersion: input.adapterVersion,
      outputLanguage: input.outputLanguage,
      createdAt: deps.now(),
    },
  });
}
