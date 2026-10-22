// Page classification (PORTAL-5; amendment A13): one shared precedence, driven by each portal's
// `ClassifyTables`. Rate limit wins, then login, authwall and checkpoint, then a missing content
// root (an unreadable shell, which is not a wall), and otherwise the page is ok.

import type { ClassifyTables, PageMarkers, PageState } from './ports/portal.ts';

// `search` ignores `lastIndex`, so a table entry carrying `g` or `y` cannot make a result depend
// on an earlier call.
const matchesAny = (patterns: readonly RegExp[], url: string): boolean =>
  patterns.some((pattern) => url.search(pattern) >= 0);

export function classify(
  tables: ClassifyTables,
  input: { url: string; status?: number; markers: PageMarkers },
): PageState {
  const { url, status, markers } = input;
  if (status !== undefined && tables.rateLimitStatuses.includes(status)) return 'rate_limit';
  if (markers.loginForm || matchesAny(tables.loginUrl, url)) return 'login';
  if (markers.authwall || matchesAny(tables.authwallUrl, url)) return 'authwall';
  if (markers.challenge || matchesAny(tables.checkpointUrl, url)) return 'checkpoint';
  if (!markers.contentRoot) return 'unreadable_shell';
  return 'ok';
}
