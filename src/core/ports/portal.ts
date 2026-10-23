// The portal port (Contract E; PORTAL-1..11). Pure and DOM-free: the page-side reader
// interface lives with the adapters in `src/portals/readers.ts`, never here. Reader results carry
// ids and text only; every URL is rebuilt by the system from `(source, id)` (PRIV-11; A19).

export type SourceId = 'linkedin' | 'infojobs';

/** What a loaded portal page turned out to be (PORTAL-5). */
export type PageState =
  | 'ok'
  | 'login'
  | 'authwall'
  | 'checkpoint'
  | 'rate_limit'
  | 'unreadable_shell';

export type ReadResult<T> =
  | { ok: true; data: T; strategy: string }
  /** No page text is included (PORTAL-4). */
  | { ok: false; failure: 'unreadable'; attempted: string[] }
  /** PORTAL-7. */
  | { ok: false; failure: 'permission_missing' };

/** Reader output for one search card: an id, never a URL (A19). */
export interface RawSearchItem {
  id: string;
  title: string;
  company: string;
  location?: string;
}

/** Worker-built: `canonicalUrl = canonicalFor(id)`. */
export interface SearchItem extends RawSearchItem {
  canonicalUrl: string;
}

/** Plain text only. */
export interface OfferDetail {
  title: string;
  company: string;
  location?: string;
  text: string;
}

/** MANUAL-3. The URL comes from the browser tab, never from the reader (A19). */
export interface GenericPreview {
  title: string;
  text: string;
}

/** The single host verdict (PORTAL-11; A20). */
export type HostClass =
  | { kind: 'portal'; source: SourceId; host: string }
  | { kind: 'known_ats'; host: string }
  | {
      kind: 'unverified';
      host: string | null;
      reason:
        | 'unparseable'
        | 'not_https'
        | 'userinfo'
        | 'port'
        | 'trailing_dot'
        | 'punycode'
        | 'unknown_host';
    };

export interface PageMarkers {
  loginForm: boolean;
  authwall: boolean;
  challenge: boolean;
  contentRoot: boolean;
  noResults: boolean;
}

/** Per-portal data consumed by the shared `classify` in `src/core/classify.ts`. */
export interface ClassifyTables {
  loginUrl: readonly RegExp[];
  authwallUrl: readonly RegExp[];
  checkpointUrl: readonly RegExp[];
  /** For example 429 and 999. */
  rateLimitStatuses: readonly number[];
}

export interface PortalAdapter {
  readonly id: SourceId;
  readonly version: string;
  readonly displayName: string;
  readonly beta: boolean;
  /** Subdomain wildcards, for example `https://*.linkedin.com/*`. */
  readonly hostPermissions: readonly string[];
  readonly classifyTables: ClassifyTables;
  matches(url: string): boolean;
  /** Anchored, for example `/^\d{1,20}$/` for LinkedIn (A19). */
  readonly idPattern: RegExp;
  /** `null` unless `idPattern` matches; the output passes `isAllowedNavigation`. */
  canonicalFor(id: string): string | null;
  normalizeSearchUrl(
    input: string,
  ):
    | { ok: true; url: string }
    | { ok: false; reason: 'host_mismatch' | 'forbidden_form' | 'not_search' };
  /** Delegates to the shared core `classify`. */
  classify(input: { url: string; status?: number; markers: PageMarkers }): PageState;
  readonly readerScript: `reader-${SourceId}`;
}
