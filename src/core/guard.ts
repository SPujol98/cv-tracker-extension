// Navigation guard (PORTAL-6; owner decision D1). Every navigation the scan performs passes here.
// The forbidden path forms below are robots-disallowed and exist only in this file and its test
// (the no-forbidden-portal-strings lint plugin enforces that). Host checks belong to the registry.

import { parseRegistryUrl } from './registry.ts';

/**
 * Matched case-insensitively against the path and the query. A form matches as a whole segment:
 * it may be followed by `/`, a query or fragment delimiter, or the end, but not by more name text
 * (`jobs-guestbook` is another segment).
 */
const FORBIDDEN_FORMS: readonly RegExp[] = [
  /\/jobs-guest(?![\w-])/i,
  /\/job-apply(?![\w-])/i,
  /runSearch/i,
];

/** Percent-decoding rounds applied after the raw text; a value still changing after them is refused. */
const MAX_DECODE_ROUNDS = 3;

function decodeOnce(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    // A malformed escape cannot hide a form: the text is treated as already decoded.
    return text;
  }
}

/**
 * The raw text and each successive decoding until it is stable (nested encodings such as `%252F`
 * unwrap one layer per round). Returns `null` when the text is still changing after
 * MAX_DECODE_ROUNDS, which the guard treats as a refusal: deeper nesting has no legitimate use.
 */
function decodedForms(text: string): string[] | null {
  const forms = [text];
  let current = text;
  for (let round = 0; round < MAX_DECODE_ROUNDS; round += 1) {
    const next = decodeOnce(current);
    if (next === current) return forms;
    forms.push(next);
    current = next;
  }
  return decodeOnce(current) === current ? forms : null;
}

function hasForbiddenForm(url: URL): boolean {
  return [url.pathname, url.search].some((target) => {
    const forms = decodedForms(target);
    return forms === null || forms.some((text) => FORBIDDEN_FORMS.some((form) => form.test(text)));
  });
}

/** True only for https on a registry host that carries no disallowed access form. */
export function isAllowedNavigation(raw: string): boolean {
  const url = parseRegistryUrl(raw);
  return url !== null && !hasForbiddenForm(url);
}
