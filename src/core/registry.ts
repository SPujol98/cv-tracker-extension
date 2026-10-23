// Portal URL registry (PORTAL-1, PORTAL-3, MANUAL-3; Contract E). The host table below is the
// single source for URL recognition and for `hostPermissions`. Every portal URL the system
// navigates is rebuilt here from `(source, id)`; nothing read from a page is ever a target (A19).
// InfoJobs URL shapes are confirmed against S3 fixtures and join this table in sub-change 7.

import type { HostClass, SourceId } from './ports/portal.ts';

interface PortalEntry {
  source: SourceId;
  /** Matches the apex itself and any subdomain of it. */
  apex: string;
  /** Anchored, and the one place that bounds an id of that portal. */
  idPattern: RegExp;
  /** The one canonical detail URL for an id that already matches `idPattern`. */
  detailUrl(id: string): string;
}

/** LinkedIn job ids are 1 to 20 ASCII digits (A19); this is the only place the limit is stated. */
const LINKEDIN_ID_DIGITS = String.raw`\d{1,20}`;

/** A LinkedIn job id and nothing else. */
export const LINKEDIN_ID_PATTERN = new RegExp(`^${LINKEDIN_ID_DIGITS}$`);

const LINKEDIN_APEX = 'linkedin.com';

const PORTALS: readonly PortalEntry[] = [
  {
    source: 'linkedin',
    apex: LINKEDIN_APEX,
    idPattern: LINKEDIN_ID_PATTERN,
    detailUrl: (id) => `https://www.linkedin.com/jobs/view/${id}/`,
  },
];

const entryFor = (source: SourceId): PortalEntry | undefined =>
  PORTALS.find((portal) => portal.source === source);

const isOnApex = (hostname: string, apex: string): boolean =>
  hostname === apex || hostname.endsWith(`.${apex}`);

/**
 * Every portal apex `classifyHost` recognizes (PORTAL-11). InfoJobs is classified here before its
 * URL shapes join `PORTALS` in sub-change 7, so a host check never lags an adapter.
 */
const PORTAL_APEXES: readonly { source: SourceId; apex: string }[] = [
  { source: 'linkedin', apex: LINKEDIN_APEX },
  { source: 'infojobs', apex: 'infojobs.net' },
];

/**
 * Widely used applicant-tracking hosts, authored fresh as data only (A20). A match is
 * informational: it never allows navigation or reading, so an incomplete list only shows the
 * unverified-source chip more often. Extended by PR.
 */
export const KNOWN_ATS_APEXES: readonly string[] = [
  'greenhouse.io',
  'lever.co',
  'ashbyhq.com',
  'workable.com',
  'smartrecruiters.com',
  'myworkdayjobs.com',
  'bamboohr.com',
  'recruitee.com',
  'teamtailor.com',
  'personio.com',
  'jobvite.com',
  'icims.com',
];

const unverified = (
  host: string | null,
  reason: Extract<HostClass, { kind: 'unverified' }>['reason'],
): HostClass => ({
  kind: 'unverified',
  host,
  reason,
});

/**
 * The single host verdict (PORTAL-11; A20). It parses with WHATWG and fails closed, without any
 * normalization, on: an unparseable URL, a scheme other than https, user information, a
 * non-default port (WHATWG already drops `:443`), a trailing dot and a punycode label (WHATWG
 * turns Unicode hosts into punycode, so homographs land here). A host then matches an apex only
 * when it equals it or ends with `.` plus the apex; portals are checked before the ATS table.
 * No other `src/core` module compares hostnames.
 */
export function classifyHost(raw: string): HostClass {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return unverified(null, 'unparseable');
  }
  const host = url.hostname === '' ? null : url.hostname;
  if (url.protocol !== 'https:') return unverified(host, 'not_https');
  if (url.username !== '' || url.password !== '') return unverified(host, 'userinfo');
  if (url.port !== '') return unverified(host, 'port');
  if (url.hostname.endsWith('.')) return unverified(host, 'trailing_dot');
  if (url.hostname.split('.').some((label) => label.startsWith('xn--'))) {
    return unverified(host, 'punycode');
  }
  const portal = PORTAL_APEXES.find(({ apex }) => isOnApex(url.hostname, apex));
  if (portal) return { kind: 'portal', source: portal.source, host: url.hostname };
  if (KNOWN_ATS_APEXES.some((apex) => isOnApex(url.hostname, apex))) {
    return { kind: 'known_ats', host: url.hostname };
  }
  return unverified(host, 'unknown_host');
}

/** `/jobs/view/<id>` and `/jobs/view/<slug>-<id>`, with an optional trailing slash. */
const LINKEDIN_VIEW_PATH = new RegExp(`^/jobs/view/(?:[^/]*-)?(${LINKEDIN_ID_DIGITS})/?$`);

/** Search and collection pages, where the open job is carried in `currentJobId`. */
const LINKEDIN_LIST_PATH = /^\/jobs\/(?:search(?:-results)?|collections(?:\/[^/]+)?)\/?$/;

/** The canonical detail URL, only for an id that matches the portal's id pattern (A19). */
export function canonicalFor(source: SourceId, id: string): string | null {
  const entry = entryFor(source);
  if (!entry?.idPattern.test(id)) return null;
  return entry.detailUrl(id);
}

/** Optional host permission patterns, derived from the host table (Contract L). */
export function hostPermissions(source: SourceId): readonly string[] {
  const entry = entryFor(source);
  return entry ? [`https://*.${entry.apex}/*`] : [];
}

function linkedinId(url: URL): string | null {
  const view = LINKEDIN_VIEW_PATH.exec(url.pathname);
  if (view) return view[1] ?? null;
  if (!LINKEDIN_LIST_PATH.test(url.pathname)) return null;
  const current = url.searchParams.get('currentJobId');
  return current !== null && LINKEDIN_ID_PATTERN.test(current) ? current : null;
}

function parseHttps(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * The parsed URL when it is https on a registered portal host (apex or subdomain), else `null`.
 * The navigation guard calls this so the registry stays the only place that compares hostnames,
 * and the guard reuses the parse instead of repeating it.
 */
export function parseRegistryUrl(raw: string): URL | null {
  const url = parseHttps(raw);
  return url !== null && PORTALS.some((portal) => isOnApex(url.hostname, portal.apex)) ? url : null;
}

/** Whether the URL is https on a registered portal host. */
export const isRegistryUrl = (raw: string): boolean => parseRegistryUrl(raw) !== null;

/** Maps a supported job URL to `{ source, id, canonicalUrl }`, or `null` (PORTAL-1). */
export function mapUrl(raw: string): { source: SourceId; id: string; canonicalUrl: string } | null {
  const url = parseHttps(raw);
  const linkedin = entryFor('linkedin');
  if (!url || !linkedin || !isOnApex(url.hostname, linkedin.apex)) return null;
  const id = linkedinId(url);
  if (id === null) return null;
  const canonicalUrl = canonicalFor('linkedin', id);
  return canonicalUrl === null ? null : { source: 'linkedin', id, canonicalUrl };
}

/**
 * Canonical form of a generic page URL (MANUAL-3): lowercase host and default port come from the
 * WHATWG parse, the fragment and `utm_*` parameters are removed. The record id is the hash of
 * this value. Input that does not parse is returned unchanged.
 */
export function canonicalizeGenericUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
  }
  return url.toString();
}
