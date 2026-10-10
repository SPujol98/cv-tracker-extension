# Privacy Safeguards Specification

## Purpose

Defines the guarantees that make the product safe to publish and use: local-only data, no telemetry, secret hygiene, safe rendering of untrusted text, an explicit terms-of-service risk acknowledgement before portal scanning, and repository safeguards that keep personal data and third-party code out of the public codebase. Prompt-level safeguards against injected offer text (offer-as-data, no tools) are specified in `offer-analysis` ANALYSIS-2 and `llm-providers`; this spec covers the product-wide guarantees.

## Requirements

### Requirement: PRIV-1 Local-only data and network allowlist

All profile, PDF, tracker, cache, queue, and settings data MUST remain in the browser. The extension MAY make network requests only to: (a) the selected LLM provider's API host, (b) portal pages the user browses or that a scan navigates to in the scan tab, and (c) the GitHub Releases API when the opt-in update check is enabled (SHELL-10). Offer text and profile claims MAY leave the browser only inside the LLM request triggered by the user's configuration.

#### Scenario: Smoke-run network audit

- GIVEN the browser smoke run exercising onboarding, manual analysis, export, import, and a fixture scan against local servers
- WHEN all outgoing requests are recorded
- THEN every request targets the local fixture/mock hosts that stand in for allowed origins
- AND none targets any other origin

#### Scenario: Optional hosts bounded

- GIVEN the built manifest
- WHEN the optional host permissions are listed
- THEN each belongs to a portal, a provider adapter, or the release check

### Requirement: PRIV-2 No telemetry

The product MUST NOT include analytics, crash reporting, usage tracking, remote logging, or any outbound request not listed in PRIV-1. A CI check MUST fail if a dependency from a maintained denylist of analytics/telemetry packages is present or if source references a beacon/analytics call (for example `navigator.sendBeacon`) to a non-allowlisted origin.

#### Scenario: Denylisted dependency

- GIVEN a pull request adding a known analytics package
- WHEN the CI check runs
- THEN it fails naming the package

#### Scenario: Clean tree passes

- GIVEN the repository without such dependencies
- WHEN the check runs
- THEN it passes

### Requirement: PRIV-3 Secret hygiene

The API key MUST NOT appear in logs, console output, error messages, notifications, URLs, analysis results, cache entries, tracker records, exports, or backups (except an explicit opt-in backup, PORT-3). A central redaction utility MUST be applied to all error text produced from provider interactions.

#### Scenario: Redaction in errors

- GIVEN a provider error whose raw message echoes the key
- WHEN the error is converted for display and logging
- THEN the output does not contain the key value

#### Scenario: Persistence audit

- GIVEN a completed analysis and a saved record
- WHEN all IndexedDB stores and exports are searched for the key string
- THEN no occurrence is found

### Requirement: PRIV-4 Safe rendering of untrusted text

All text originating from offers, LLM output, user notes, imported files, and portal pages MUST be rendered as text (text nodes or `textContent`). Source MUST NOT use `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, or framework raw-HTML injection with such text; a lint rule MUST enforce this. Rendering MUST NOT create elements, attributes, or event handlers from untrusted strings.

#### Scenario: Markup in an offer title

- GIVEN a title `<img src=x onerror=alert(1)>` returned by a fixture
- WHEN the review card and tracker list render it
- THEN the literal text is displayed
- AND no `img` element exists in the DOM

#### Scenario: LLM rationale with markup

- GIVEN a rationale containing `<script>`
- WHEN the card renders it
- THEN it appears as text and no script element exists

#### Scenario: Lint rejects raw HTML

- GIVEN a source file assigning to `innerHTML`
- WHEN lint runs
- THEN lint fails

### Requirement: PRIV-5 First-run terms-of-service risk acknowledgement (confirmed by owner 2026-10-10: Q10)

Before any portal scan can run (scheduled or Scan now), the user MUST accept a mandatory acknowledgement screen stating that automated reading of portal pages may violate a portal's terms and may lead to account restrictions, that the risk is the user's, that scanning is optional and off by default, and that manual analysis is the lowest-risk path. The acceptance MUST be stored with a timestamp and the text version; a new text version MUST require re-acceptance. The user MUST be able to revoke the acceptance, which disables scheduled scanning. Manual analysis MUST NOT be gated by this screen.

#### Scenario: Gate before first scan

- GIVEN no stored acceptance
- WHEN any scan is requested
- THEN the screen is shown and no scan tab is opened

#### Scenario: Version bump

- GIVEN an acceptance of text version 1 and a build with text version 2
- WHEN a scan is requested
- THEN the screen is shown again

#### Scenario: Revoke

- GIVEN scheduled scanning is on
- WHEN the user revokes the acceptance
- THEN scheduled scanning is turned off and alarms are removed

#### Scenario: Manual analysis ungated

- GIVEN no acceptance stored
- WHEN the user invokes "Analyze this page"
- THEN the flow proceeds without the screen

### Requirement: PRIV-6 Data-flow documentation

`PRIVACY` and the README MUST state what is stored locally, what is sent to which party and when, that the key is stored unencrypted locally, that no telemetry exists, and the portal terms-of-service risk disclaimer for manual analysis.

#### Scenario: Required statements present

- GIVEN the docs check
- WHEN `PRIVACY` and the README are read
- THEN each statement above appears under a clearly titled section

### Requirement: PRIV-7 Clean-room rule and no reference data

The repository MUST NOT contain code, assets, or text copied from the vendored LinkedIn Beacons extension, and MUST NOT contain the owner's term lists, company blocklist, judge calibration anchors, candidate facts, claims, synonyms, honest-gaps, CV masters, CVs, or tracker data. Vendored third-party extension directories MUST NOT exist in the repository. Tests and fixtures MUST use freshly authored synthetic data.

#### Scenario: Vendored directory blocked

- GIVEN a pull request adding a directory named `extension/` containing a provenance file
- WHEN the scan runs
- THEN it fails

### Requirement: PRIV-8 Personal-data and clean-room scan in CI

CI MUST run a scan over all tracked files that fails the build when it finds: email addresses outside reserved example domains, phone numbers outside reserved test ranges, national-ID-like patterns, long hex or token-like strings resembling API keys (including common provider key prefixes), and, when configured, hashed denylist tokens supplied through an optional CI secret. The scan MUST ship with unit tests using synthetic positive and negative samples. The scan output MUST NOT print matched secret values in full.

#### Scenario: Real-looking email

- GIVEN a tracked file containing `jane.doe@gmail.com`
- WHEN the scan runs
- THEN it fails and reports file and line

#### Scenario: Reserved domain allowed

- GIVEN a fixture containing `candidate@example.com`
- WHEN the scan runs
- THEN it passes

#### Scenario: Key-like token

- GIVEN a tracked file containing a string with a common provider key prefix followed by 40 random characters
- WHEN the scan runs
- THEN it fails
- AND the report shows at most a truncated form of the match

#### Scenario: Hashed denylist

- GIVEN the CI secret holds the hash of the token "zzprivatetoken" and a file contains that token
- WHEN the scan runs
- THEN it fails without printing the token

### Requirement: PRIV-9 Local denylist pre-commit hook

The repository MUST provide a pre-commit hook that checks staged content against a personal denylist file stored at a gitignored path. The denylist file MUST never be committed: the scan and the hook MUST fail if it is tracked or staged. The hook MUST pass cleanly when the denylist file does not exist.

#### Scenario: Denylisted term staged

- GIVEN a local denylist containing "zzprivatetoken" and a staged file containing it
- WHEN the hook runs
- THEN the commit is blocked

#### Scenario: Denylist staged

- GIVEN the denylist file is staged
- WHEN the hook runs
- THEN the commit is blocked

#### Scenario: No denylist

- GIVEN no denylist file exists
- WHEN the hook runs on a clean staged change
- THEN the commit proceeds

### Requirement: PRIV-10 Contribution attestation and filter authorship (confirmed by owner 2026-10-10: Q15)

The pull request template MUST include a clean-room and no-personal-data attestation checklist. The pull request implementing the title/company filter (BEACON-3) MUST contain the owner's written confirmation of authorship of the reference filter algorithm in its description, and the implementation MUST be derived from the written behavior in BEACON-3, not from the reference source.

#### Scenario: Template checklist

- GIVEN the repository's pull request template
- WHEN it is read
- THEN it contains the clean-room and no-personal-data checkboxes

#### Scenario: Filter PR evidence

- GIVEN the pull request that introduces the filter
- WHEN reviewed against the checklist
- THEN the description includes the authorship confirmation before merge
