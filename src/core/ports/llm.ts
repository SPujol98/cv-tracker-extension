// The LLM port (ADR-01, Contract A). Core owns the interface; adapters in `src/providers`
// implement it. `ProviderId` and `ModelEntry` live in the catalog and are re-exported here.
import type { ModelEntry } from '../pricing/catalog.ts';

export type { ModelEntry, ProviderId } from '../pricing/catalog.ts';

export interface CompletionRequest {
  modelId: string;
  /** Stable, byte-identical per profile and prompt version (ANALYSIS-2). */
  prefix: string[];
  /** Offer data block or CV text. */
  variable: string;
  /** `offer_analysis_v2` or `profile_proposal_v1`. */
  schemaName: string;
  /** No length or numeric bounds and no recursion (LLM-2). */
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  estimated: boolean;
}

export type CompletionEvent =
  | { type: 'progress'; outputChars: number }
  | { type: 'final'; json: unknown; usage: Usage; model: string };

/** The closed error taxonomy of ADR-21. */
export const LLM_ERROR_CLASSES = [
  'auth',
  'permission_missing',
  'rate_limit',
  'transient',
  'invalid_request',
  'refusal',
  'invalid_output',
  'timeout',
  'cancelled',
  'budget_exceeded',
] as const;

export type LlmErrorClass = (typeof LLM_ERROR_CLASSES)[number];

export class ProviderError extends Error {
  readonly cls: LlmErrorClass;
  readonly retryAfterMs: number | undefined;
  readonly afterFirstChunk: boolean;

  constructor(cls: LlmErrorClass, message: string, retryAfterMs?: number, afterFirstChunk = false) {
    super(message);
    this.name = 'ProviderError';
    this.cls = cls;
    this.retryAfterMs = retryAfterMs;
    this.afterFirstChunk = afterFirstChunk;
  }
}

export type KeyCheck =
  | { result: 'valid' }
  | { result: 'invalid' }
  | { result: 'unverifiable'; reason: 'restricted' | 'provider_unavailable' | 'network' };

export interface LlmProvider {
  /** A `ProviderId` for production adapters; tests may use `'fake'`. */
  readonly id: string;
  readonly displayName: string;
  /** For example `https://api.anthropic.com`. */
  readonly origin: string;
  readonly models: readonly ModelEntry[];
  validateKey(key: string, signal: AbortSignal): Promise<KeyCheck>;
  complete(
    req: CompletionRequest,
    key: string,
    opts: { signal: AbortSignal },
  ): AsyncIterable<CompletionEvent>;
}
