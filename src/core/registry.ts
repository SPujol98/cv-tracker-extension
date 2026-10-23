// Portal URL registry (PORTAL-1, PORTAL-3, MANUAL-3; Contract E). The host table below is the
// single source for URL recognition and for `hostPermissions`. Every portal URL the system
// navigates is rebuilt here from `(source, id)`; nothing read from a page is ever a target (A19).
// InfoJobs URL shapes are confirmed against S3 fixtures and join this table in sub-change 7.

import type { SourceId } from './ports/portal.ts';

interface PortalEntry {
  source: SourceId;
  /** Matches the apex itself and any subdomain of it. */
  apex: string;
  /** Anchored; the longest id a portal issues is 20 digits. */
  idPattern: RegExp;
  /** The one canonical detail URL for an id that already matches `idPattern`. */
  detailUrl(id: string): string;
}

/** LinkedIn job ids: 1 to 20 ASCII digits and nothing else (A19). */
export const LINKEDIN_ID_PATTERN = /^\d{1,20}$/;

const PORTALS: readonly PortalEntry[] = [
  {
    source: 'linkedin',
    apex: 'linkedin.com',
    idPattern: LINKEDIN_ID_PATTERN,
    detailUrl: (id) => `https://www.linkedin.com/jobs/view/${id}/`,
  },
];

const entryFor = (source: SourceId): PortalEntry | undefined =>
  PORTALS.find((portal) => portal.source === source);

const isOnApex = (hostname: string, apex: string): boolean =>
  hostname === apex || hostname.endsWith(`.${apex}`);

/** `/jobs/view/<id>` and `/jobs/view/<slug>-<id>`, with an optional trailing slash. */
const LINKEDIN_VIEW_PATH = /^\/jobs\/view\/(?:[^/]*-)?(\d{1,20})\/?$/;

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
 * Whether the URL is https on a registered portal host (apex or subdomain). The navigation guard
 * calls this so the registry stays the only place that compares hostnames.
 */
export function isRegistryUrl(raw: string): boolean {
  const url = parseHttps(raw);
  return url !== null && PORTALS.some((portal) => isOnApex(url.hostname, portal.apex));
}

/** Maps a supported job URL to `{ source, id, canonicalUrl }`, or `null` (PORTAL-1). */
export function mapUrl(raw: string): { source: SourceId; id: string; canonicalUrl: string } | null {
  const url = parseHttps(raw);
  const linkedin = entryFor('linkedin');
  if (!url || !linkedin || !isOnApex(url.hostname, linkedin.apex)) return null;
  const id = linkedinId(url);
  const canonicalUrl = id === null ? null : canonicalFor('linkedin', id);
  if (id === null || canonicalUrl === null) return null;
  return { source: 'linkedin', id, canonicalUrl };
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
