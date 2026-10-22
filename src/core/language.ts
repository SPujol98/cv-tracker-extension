// Deterministic offer-language inference (ANALYSIS-6, PROFILE-5; amendment A16). Runs on the full
// normalized text, never the capped request, and never calls a provider.

import { LANGUAGES, type LanguageCode, type LanguageEntry } from './languages.ts';
import { fold, words } from './text.ts';

/** Fewer word tokens than this gives `unknown`. */
export const LANG_MIN_TOKENS = 20;

/** The best language must score at least this. */
export const LANG_MIN_SCORE = 3;

/** The best language must score at least this many times the runner-up. */
export const LANG_LEAD_RATIO = 1.5;

/** score(language) = stopword hits + 2 * marker hits, counted per token occurrence. */
function score(tokens: readonly string[], entry: LanguageEntry): number {
  const stopwords = new Set(entry.stopwords);
  const markers = new Set(entry.markers);
  let total = 0;
  for (const token of tokens) {
    if (markers.has(token)) total += 2;
    else if (stopwords.has(token)) total += 1;
  }
  return total;
}

/**
 * Infers the language of `text` from the table, precision-first: `unknown` for short text, a weak
 * best score, or a best that does not lead the runner-up by `LANG_LEAD_RATIO`.
 */
export function inferLanguage(
  text: string,
  table: readonly LanguageEntry[] = LANGUAGES,
): LanguageCode | 'unknown' {
  const tokens = words(fold(text));
  if (tokens.length < LANG_MIN_TOKENS) return 'unknown';
  const ranked = table
    .map((entry) => ({ code: entry.code, score: score(tokens, entry) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best) return 'unknown';
  const second = ranked[1]?.score ?? 0;
  if (best.score < LANG_MIN_SCORE || best.score < LANG_LEAD_RATIO * second) return 'unknown';
  return best.code;
}
