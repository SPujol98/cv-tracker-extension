# Portal Adapters Specification

## Purpose

Defines how the extension recognizes job URLs and reads portal pages through the user's own logged-in browser session (owner decision D1). A `PortalAdapter` boundary hides portal-specific DOM details; LinkedIn is implemented first and InfoJobs next. Adapters read what the user's browser renders in a tab; they never call guest or public endpoints and never fetch portal HTML from the service worker.

## Requirements

### Requirement: PORTAL-1 URL registry

A pure function MUST map a URL to `{ source, id, canonicalUrl }` or `null`. Supported sources: `linkedin` and `infojobs`. For LinkedIn it MUST recognize job view URLs (with or without a title slug) and search/collection URLs that carry a current-job id; the canonical form MUST be the job view URL for that id without tracking parameters. For InfoJobs it MUST recognize offer detail URLs and extract the offer identifier; exact URL shapes MUST be confirmed against fixtures (Spike S3). Canonicalization MUST be idempotent. Unknown hosts and non-job pages MUST return `null`.

#### Scenario: LinkedIn view URL with tracking parameters

- GIVEN a LinkedIn job view URL with an id and tracking query parameters
- WHEN mapped
- THEN `source` is `linkedin`, `id` is the numeric id, and `canonicalUrl` has no tracking parameters

#### Scenario: Search page with current job

- GIVEN a LinkedIn search results URL with `currentJobId=<id>`
- WHEN mapped
- THEN the same `id` and canonical view URL as the direct view URL are returned

#### Scenario: Idempotent

- GIVEN any supported URL
- WHEN `canonicalUrl` is mapped again
- THEN the output equals its input

#### Scenario: Unsupported

- GIVEN `https://example.com/jobs/1` and a LinkedIn profile page URL
- WHEN mapped
- THEN both return `null`

### Requirement: PORTAL-2 Adapter contract

Each adapter MUST implement: `matches(url)`, search-results reading, detail-page reading, and page classification. Operations MUST return a discriminated result: success with data, or a typed failure. Extracted text MUST be plain text (no markup). Each adapter MUST declare a version string recorded with data it produces. A shared contract test suite MUST run against every adapter using only sanitized synthetic fixtures.

#### Scenario: Shared contract suite

- GIVEN the LinkedIn and InfoJobs adapters
- WHEN the shared contract suite runs against their fixtures
- THEN both pass the same set of assertions for search reading, detail reading and classification

#### Scenario: Plain text only

- GIVEN a detail fixture whose description contains markup and `<script>` text
- WHEN read
- THEN the returned description contains no HTML tags that were part of the DOM structure
- AND script text is not executed or included as markup

### Requirement: PORTAL-3 Search-results reading

Search reading MUST return, for the first page of results only, a de-duplicated list of `{ id, canonicalUrl, title, company, location? }`. (amendment A19) The reading code in the page MUST return only `{ id, title, company, location? }`; the system MUST discard items whose id does not match the adapter's identifier pattern and MUST build `canonicalUrl` from the id with the adapter's canonical form (PORTAL-1), never from a link or URL found in the page (PRIV-11). It MUST handle lazily rendered or virtualized lists by reading only what the page has rendered and MUST NOT navigate to subsequent pages. A page that renders zero recognizable items MUST be reported as a typed failure `unreadable` rather than an empty success, unless the portal's explicit "no results" marker is present, in which case it is an empty success.

#### Scenario: Results with duplicates

- GIVEN a fixture page containing 25 result cards, 2 of which repeat an id
- WHEN read
- THEN 23 unique items are returned

#### Scenario: No results marker

- GIVEN a fixture with the portal's "no results" state
- WHEN read
- THEN an empty success is returned

#### Scenario: Unrecognized markup

- GIVEN a fixture with a changed structure and no recognizable items or marker
- WHEN read
- THEN the result is failure `unreadable`

#### Scenario: Canonical URL rebuilt from the id (amendment A19)

- GIVEN a result card with id `123` whose link points to `https://evil.example/jobs/view/123/`
- WHEN read and processed
- THEN the item's `canonicalUrl` is the LinkedIn canonical view URL for id `123`

#### Scenario: Malformed id discarded (amendment A19)

- GIVEN a result card whose extracted id is `123/../../x`
- WHEN read and processed
- THEN that item is not returned

### Requirement: PORTAL-4 Detail-page reading

Detail reading MUST return `{ title, company, location?, text }` where `text` is the full description. The adapter MUST expand collapsed descriptions ("see more" style controls) before reading and MUST wait for lazily loaded content up to a bounded timeout. If the description cannot be obtained, it MUST return failure `unreadable` and MUST NOT return an empty or partial text as success. Adapters MUST try multiple selector strategies in order; the failure result MUST record which strategies were attempted without including page text.

#### Scenario: Collapsed description

- GIVEN a fixture whose description is truncated behind an expand control
- WHEN read
- THEN the text contains the content hidden behind the control

#### Scenario: Fallback strategy

- GIVEN a fixture where the primary selector strategy fails and the second succeeds
- WHEN read
- THEN the result is a success

#### Scenario: Description never appears

- GIVEN a fixture whose description container stays empty
- WHEN the bounded wait elapses
- THEN the result is failure `unreadable` with the attempted strategy names

### Requirement: PORTAL-5 Session and wall classification

A classifier MUST map `(url, optional HTTP status, page markers)` to exactly one of `ok`, `login`, `authwall`, `checkpoint`, `rate_limit`, `unreadable_shell`. A portal anti-bot challenge page MUST be classified `checkpoint`. HTTP status 429 and 999 MUST be classified `rate_limit`. (amendment A13) `login`, `authwall`, `checkpoint`, and `rate_limit` MUST be treated as walls for scanning purposes (BEACON-8); `unreadable_shell` follows BEACON-8's layout-failure rule. (Previously: anything other than `ok` was treated as a wall.)

#### Scenario: Classification table

- GIVEN fixtures for a login URL, an authwall URL, a checkpoint URL, a status-999 navigation, and a normal page
- WHEN classified
- THEN results are `login`, `authwall`, `checkpoint`, `rate_limit`, `ok`

#### Scenario: Challenge page

- GIVEN an InfoJobs-style challenge fixture
- WHEN classified
- THEN the result is `checkpoint`

### Requirement: PORTAL-6 Disallowed access forms (owner decision D1)

The system MUST NOT fetch portal HTML or JSON from the service worker, MUST NOT use guest/public endpoints, and MUST NOT navigate to robots-disallowed URL forms including `/jobs-guest/`, `/job-apply/`, and URLs containing `runSearch`. All navigations performed for scanning MUST pass through a guard that rejects such forms. A CI static check MUST fail if source contains these forbidden path strings outside the guard's denylist and its tests.

#### Scenario: Guard rejects

- GIVEN candidate URLs containing `/jobs-guest/`, `/job-apply/`, `runSearch`
- WHEN passed to the navigation guard
- THEN each is rejected

#### Scenario: Guard accepts normal forms

- GIVEN a standard LinkedIn job view URL
- WHEN passed to the guard
- THEN it is accepted

#### Scenario: Static check

- GIVEN a source file that builds a `/jobs-guest/` URL
- WHEN the CI static check runs
- THEN it fails

### Requirement: PORTAL-7 Permission-gated reading

An adapter MUST NOT inject reading code into a tab unless the extension holds the portal's optional host permission or the user invoked a gesture that grants `activeTab` for that tab. Otherwise the operation MUST return failure `permission_missing` without side effects.

#### Scenario: No permission

- GIVEN no host permission for the portal and no `activeTab` grant
- WHEN a detail read is requested
- THEN the result is `permission_missing` and nothing is injected

### Requirement: PORTAL-8 LinkedIn adapter

The LinkedIn adapter MUST implement PORTAL-1 to PORTAL-5 for LinkedIn job search results and job detail pages as rendered in a logged-in tab, using sanitized fixtures for each case: results page, detail page, collapsed description, virtualized list, login redirect, authwall, checkpoint, and rate limit.

#### Scenario: Fixture coverage

- GIVEN the LinkedIn fixture set
- WHEN the contract suite runs
- THEN every fixture case above has at least one passing assertion

### Requirement: PORTAL-9 InfoJobs adapter (confirmed by owner 2026-10-10: Q6)

The InfoJobs adapter MUST implement the same contract for InfoJobs search results and offer detail pages, including detection of its anti-bot challenge as `checkpoint`. It MUST be labeled "beta" in the UI and docs for v1.

#### Scenario: InfoJobs fixtures pass the shared suite

- GIVEN the InfoJobs fixture set including a challenge page
- WHEN the contract suite runs
- THEN all assertions pass

#### Scenario: Beta label

- GIVEN the portal list in settings
- WHEN InfoJobs is displayed
- THEN a "beta" label is shown

### Requirement: PORTAL-10 Fixture hygiene

Fixtures MUST be synthetic or sanitized: they MUST NOT contain real people, real company contact data, or real offer text taken from the owner's data. Fixtures MUST be reachable by CI only through local servers.

#### Scenario: Fixture scan

- GIVEN the fixtures directory
- WHEN the personal-data scan (PRIV-8) runs
- THEN it finds no email domain other than reserved example domains and no phone number outside reserved test ranges

### Requirement: PORTAL-11 Source-host verification (amendment A20)

A single pure function MUST classify a URL's host as `portal` (with its source), `known_ats`, or `unverified`, and every host decision (URL registry, navigation guard, generic fallback) MUST use it. It MUST parse with the WHATWG URL standard and MUST classify as `unverified`, failing closed without normalization: an unparseable URL, any scheme other than `https:`, a URL with user information, a URL with a non-default port, a hostname ending in a dot, and a hostname containing a punycode (`xn--`) label. Otherwise a host matches an apex domain only if it equals the apex or ends with `.` followed by the apex. Portal apexes are checked first, then a table of known applicant-tracking hosts; anything else is `unverified`. Reading and navigation MUST require `portal`. `known_ats` and `unverified` are informational only.

#### Scenario: Spoofing vectors rejected

- GIVEN the URLs `https://linkedin.com@evil.example/jobs/view/1/`, `https://linkedin.com.evil.com/`, `https://evil-linkedin.com/`, `https://www.linkedin.com./jobs/view/1/`, a punycode look-alike of `linkedin.com`, `http://www.linkedin.com/jobs/view/1/`, and `https://www.linkedin.com:8443/jobs/view/1/`
- WHEN each is classified
- THEN none is classified `portal`
- AND the navigation guard rejects each

#### Scenario: Genuine portal hosts accepted

- GIVEN `https://linkedin.com/jobs/view/1/`, `https://www.linkedin.com/jobs/view/1/`, and a LinkedIn country subdomain URL
- WHEN each is classified
- THEN each is `portal` with source `linkedin`

#### Scenario: Known applicant-tracking host

- GIVEN an https URL on a subdomain of an apex listed in the known applicant-tracking table
- WHEN classified
- THEN the result is `known_ats`
