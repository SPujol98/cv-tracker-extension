# Manual Analysis Specification

## Purpose

Defines the user-initiated "Analyze this page" flow: read the offer the user is viewing, run the analysis pipeline, show a review card in the side panel (or the popup fallback), and optionally save the result to the tracker. This is the lowest-risk acquisition path and is useful on its own. It never runs unless the user triggers it and never saves without an explicit action.

## Requirements

### Requirement: MANUAL-1 User-triggered entry point

An "Analyze this page" action MUST be available from the side panel and the popup for the active tab. The action MUST do nothing until invoked by the user. Invoking it MUST NOT start any scan, navigation, or background activity beyond reading the active tab and running one analysis.

#### Scenario: Idle by default

- GIVEN the user browses a supported offer page
- WHEN no action is invoked
- THEN no page read and no provider call occurs

#### Scenario: Action invoked

- GIVEN the user is on a supported offer page
- WHEN the user invokes "Analyze this page"
- THEN the active tab is read once and one analysis is requested

### Requirement: MANUAL-2 Supported-portal flow

When the active tab URL maps to a supported portal (PORTAL-1), the system MUST read it with that portal's adapter (PORTAL-4) and pass the result to the analysis pipeline. If the portal's host permission is not yet granted, the system MUST request it on the user's gesture before reading. If the page is classified as a wall (PORTAL-5), the system MUST show a message naming the condition (for example "log in to LinkedIn") and MUST NOT call the provider.

#### Scenario: Happy path

- GIVEN an active LinkedIn detail fixture tab, a complete profile, and a fake provider
- WHEN the user invokes the action
- THEN the review card shows score, verdict, fit, walls, apply warnings, language, recommended PDF, tokens and cost

#### Scenario: Permission requested on gesture

- GIVEN the portal host permission is not granted
- WHEN the user invokes the action
- THEN a permission request is made from that gesture
- AND the page is read only if granted

#### Scenario: Logged-out page

- GIVEN the active tab is classified `login`
- WHEN the user invokes the action
- THEN the card shows a "log in" message and the provider receives no call

### Requirement: MANUAL-3 Generic fallback for other pages (confirmed by owner 2026-10-10: Q12)

On a page that does not map to a supported portal, the system MUST offer a generic fallback using the `activeTab` grant (no additional host permission): extract the main-content text, show it to the user in an editable preview, and analyze only after the user confirms. The saved record MUST use source `generic` and an id derived from the SHA-256 of the canonicalized page URL.

#### Scenario: Preview before analysis

- GIVEN the active tab is an unsupported site
- WHEN the user invokes the action
- THEN an editable text preview is shown
- AND no provider call is made until the user confirms

#### Scenario: User edits the text

- GIVEN the preview text is edited to remove a paragraph
- WHEN the user confirms
- THEN the analyzed text is the edited text

#### Scenario: No extra permission

- GIVEN the fallback runs
- WHEN permissions are inspected before and after
- THEN no new host permission was granted

#### Scenario: Stable generic id

- GIVEN the same unsupported URL analyzed twice with different fragments
- WHEN ids are computed
- THEN both produce the same generic id

### Requirement: MANUAL-4 Review card contents

The review card MUST show: offer title and company; score and verdict; fit entries mapped to claims; walls with their evidence excerpts; apply-instruction warnings with their excerpts; inferred offer language; recommended branch; recommended PDF with open/download controls, or the reason none is recommended; token counts and cost of this analysis; and `cached` and `truncated` indicators when true. (amendment A12) A `skip` caused by a wall MUST be shown distinctly from a low-score `skip`, together with the wall.

#### Scenario: Wall skip shown distinctly (amendment A12)

- GIVEN a result with verdict `skip`, reason `wall`, and one accepted wall
- WHEN the card renders
- THEN the card shows a blocker-found skip with the wall and its evidence
- AND it is visually and textually distinct from a low-score skip

#### Scenario: PDF recommendation present

- GIVEN a result recommending the (Backend, es) PDF
- WHEN the card renders
- THEN the PDF name is shown with open and download controls

#### Scenario: No PDF available

- GIVEN a result with `pdf: null` and reason `no_pdf_for_language`
- WHEN the card renders
- THEN the reason text is shown and the available alternatives are listed

#### Scenario: Cached analysis indicated

- GIVEN a result with `cached: true`
- WHEN the card renders
- THEN a "cached, no cost" indicator is shown

### Requirement: MANUAL-5 States and failure UX

The card MUST display distinct states: `reading`, `analyzing` (with streamed progress indication), `done`, and failure states with actionable messages: page not readable (with an offer to use the generic fallback), no key or invalid key (link to settings), incomplete profile (link to onboarding), budget reached (link to raise the limit), rate limit or transient error (retry), invalid output (retry). No failure state MAY show a partial verdict.

#### Scenario: Unreadable page offers fallback

- GIVEN a supported-portal tab whose detail read returns `unreadable`
- WHEN the failure is displayed
- THEN the message says the page could not be read and offers the generic fallback

#### Scenario: Missing key

- GIVEN no stored key
- WHEN the user invokes the action
- THEN the card shows a link to key settings and no read or provider call occurs

#### Scenario: Budget reached

- GIVEN `budget_exceeded`
- WHEN the failure is displayed
- THEN the card offers a link to raise the daily limit

#### Scenario: Streaming progress

- GIVEN a fake provider streaming several chunks
- WHEN analysis runs
- THEN the card is in `analyzing` until the final validated result and then moves to `done`

### Requirement: MANUAL-6 Explicit save to tracker

The card MUST offer a "Save" action. Nothing MUST be saved unless the user invokes it. Saving MUST create a tracker record keyed by (source, id) with the offer snapshot and the analysis result (TRACKER-1). Saving an offer already in the tracker MUST update that record's analysis and MUST NOT create a duplicate.

#### Scenario: Not saved implicitly

- GIVEN an analysis completed
- WHEN the user closes the panel without saving
- THEN the tracker has no new record

#### Scenario: Save creates record

- GIVEN a completed analysis
- WHEN the user presses Save
- THEN one tracker record exists with the offer snapshot, analysis and status `new`

#### Scenario: Save twice

- GIVEN the offer is already saved
- WHEN the user analyzes and saves it again
- THEN the tracker still has exactly one record for that (source, id), with the newer analysis

### Requirement: MANUAL-7 Explicit re-analysis

If the result for the offer is served from cache, the card MUST offer "Re-analyze" which bypasses the cache and performs a new provider call after the user confirms the cost may be incurred.

#### Scenario: Re-analyze bypasses cache

- GIVEN a cached result displayed
- WHEN the user confirms Re-analyze
- THEN the provider receives one call
- AND the new validated result replaces the cached entry
