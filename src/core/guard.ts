// Navigation guard (PORTAL-6; owner decision D1). Every navigation the scan performs passes here.
// The forbidden path forms below are robots-disallowed and exist only in this file and its test
// (the no-forbidden-portal-strings lint plugin enforces that). Host checks belong to the registry.

import { isRegistryUrl } from './registry.ts';

/** Matched case-insensitively against the path and the query, raw and percent-decoded. */
const FORBIDDEN_FORMS: readonly RegExp[] = [/\/jobs-guest\//i, /\/job-apply\//i, /runSearch/i];

function decoded(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    // A malformed escape cannot hide a form: the raw text is still checked.
    return text;
  }
}

function hasForbiddenForm(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return true;
  }
  const targets = [url.pathname, url.search];
  return targets.some((target) =>
    [target, decoded(target)].some((text) => FORBIDDEN_FORMS.some((form) => form.test(text))),
  );
}

/** True only for https on a registry host that carries no disallowed access form. */
export function isAllowedNavigation(url: string): boolean {
  return isRegistryUrl(url) && !hasForbiddenForm(url);
}
