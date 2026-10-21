// Offer text normalization, folding and the head-and-tail cap (ANALYSIS-3; amendments A2, A3, A16).

/** The offer cap used for the request, the cache key and grounding (ANALYSIS-3). */
export const MAX_OFFER_CHARS = 11_000;

/** Characters kept from the beginning when the cap applies (A16). */
export const HEAD_CHARS = 8_000;

/** Joins the kept head and tail when text is truncated (A16). */
export const ELISION_MARKER = ' […] ';

/**
 * Zero-width and invisible format characters (A2). The Unicode `Cf` category covers the
 * U+200B-U+200D, U+2060, U+FEFF and U+00AD set of the spec, bidirectional controls, and tag
 * characters that could otherwise hide injected text.
 */
const INVISIBLE_FORMAT = /\p{Cf}/gu;

const TYPOGRAPHIC_SINGLE_QUOTES = /[‘’‚‛′]/g;
const TYPOGRAPHIC_DOUBLE_QUOTES = /[“”„‟″]/g;
const TYPOGRAPHIC_DASHES = /[‐-―−]/g;
const WORD = /[\p{L}\p{N}]+/gu;
const WHITESPACE = /\s/u;

/** Invisible format characters removed, then NFC (so a Cf char cannot block composition), whitespace collapsed to one space, trimmed. No cap. */
export function normalizeOfferText(raw: string): string {
  return raw.replace(INVISIBLE_FORMAT, '').normalize('NFC').replace(/\s+/gu, ' ').trim();
}

/** Normalizes, lowercases and maps typographic quotes, apostrophes and dashes to ASCII (A3). */
export function fold(text: string): string {
  return normalizeOfferText(text)
    .toLowerCase()
    .replace(TYPOGRAPHIC_SINGLE_QUOTES, "'")
    .replace(TYPOGRAPHIC_DOUBLE_QUOTES, '"')
    .replace(TYPOGRAPHIC_DASHES, '-');
}

/** Word tokens: maximal runs of letters and digits. */
export function words(text: string): string[] {
  return text.match(WORD) ?? [];
}

function cutHead(text: string, limit: number): string {
  if (text.length <= limit) return text;
  if (WHITESPACE.test(text.charAt(limit))) return text.slice(0, limit).trimEnd();
  for (let i = limit - 1; i > 0; i--) {
    if (WHITESPACE.test(text.charAt(i))) return text.slice(0, i).trimEnd();
  }
  return text.slice(0, limit);
}

function cutTail(text: string, limit: number): string {
  if (limit <= 0) return '';
  if (text.length <= limit) return text;
  const start = text.length - limit;
  if (WHITESPACE.test(text.charAt(start - 1))) return text.slice(start).trimStart();
  for (let i = start; i < text.length; i++) {
    if (WHITESPACE.test(text.charAt(i))) return text.slice(i + 1).trimStart();
  }
  return text.slice(start);
}

/**
 * Caps text at `maxChars` by keeping the beginning and the end, joined by the elision marker
 * (A16). The head is the first `HEAD_CHARS` characters and the tail fills the rest of the budget
 * minus the marker; both are cut at whitespace when there is any to cut at. The result never
 * exceeds `maxChars`: when the budget cannot hold the head, the marker and a tail, it degrades to
 * a plain head truncation of at most `maxChars` (no marker).
 */
export function capHeadTail(
  fullText: string,
  maxChars: number = MAX_OFFER_CHARS,
): { text: string; truncated: boolean } {
  if (fullText.length <= maxChars) return { text: fullText, truncated: false };
  const tailBudget = maxChars - HEAD_CHARS - ELISION_MARKER.length;
  if (tailBudget <= 0) return { text: cutHead(fullText, Math.max(0, maxChars)), truncated: true };
  const head = cutHead(fullText, HEAD_CHARS);
  const tail = cutTail(fullText, tailBudget);
  return { text: `${head}${ELISION_MARKER}${tail}`, truncated: true };
}
