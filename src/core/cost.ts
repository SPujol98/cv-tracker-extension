import type { Usage } from './ports/llm.ts';
import type { ModelEntry } from './pricing/catalog.ts';

const TOKENS_PER_MTOK = 1_000_000;

/** Characters per token used whenever a provider omits usage (design constant). */
const CHARS_PER_TOKEN = 4;

/** Token estimate for a character count: `ceil(chars / 4)`. */
export function estimateTokens(chars: number): number {
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

/**
 * Cost of one call (LLM-8). `inputTokens` is the total prompt size and includes the cached
 * tokens, which are priced at the cached rate; the remainder is priced at the input rate.
 */
export function computeCost(
  usage: Usage,
  price: ModelEntry['price'],
): { costUsd: number; estimated: boolean } {
  const cached = usage.cachedInputTokens;
  const uncached = Math.max(0, usage.inputTokens - cached);
  const costUsd =
    (uncached * price.inputPerMTok +
      cached * price.cachedInputPerMTok +
      usage.outputTokens * price.outputPerMTok) /
    TOKENS_PER_MTOK;
  return { costUsd, estimated: usage.estimated };
}
