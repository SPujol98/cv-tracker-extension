# Extension Shell Specification

## Purpose

Defines the container the rest of the product runs in: the MV3 manifest and permission model, stable extension identity, entrypoints, service-worker lifecycle rules, packaging and release, CI gates, UI localization, licensing/docs, and the optional update check. Targets Chrome and Edge (Chromium, MV3). Everything is new (greenfield).

Conventions used across all `extension-v1` specs:
- Requirement IDs are stable (`SHELL-n`, `LLM-n`, `PROFILE-n`, `ANALYSIS-n`, `PORTAL-n`, `MANUAL-n`, `BEACON-n`, `TRACKER-n`, `PORT-n`, `PRIV-n`) so tasks and tests can reference them.
- "(default, pending owner confirmation: Qn)" marks a requirement that follows the proposal's recommended default for open question Qn.
- "(assumption)" marks a numeric value or behavior chosen by this spec because the proposal did not fix it; design may adjust it without changing the requirement's intent.
- "Spike Sx" marks a requirement whose feasibility is validated by that spike; a failed spike amends the requirement before the dependent sub-change starts.

## Requirements

### Requirement: SHELL-1 Manifest and minimal permissions

The built extension MUST be a Manifest V3 extension loadable in current stable Chrome and Edge. Its required `permissions` MUST be limited to the allowlist `storage`, `alarms`, `scripting`, `activeTab`, `sidePanel`. The manifest MUST declare no required `host_permissions`. Portal hosts, LLM provider hosts, and (when the update check exists) `api.github.com` MUST be declared only as optional host permissions and requested at runtime, each on a user gesture. `notifications` MUST be an optional permission requested when the user enables notifications. `webRequest` MAY be declared as an optional permission, requested on the user gesture that enables beacon scanning, and used only for non-blocking observation of the scan tab's main-frame response status; the optional API permission allowlist is exactly `notifications`, `webRequest` (if Spike S3 shows the status is unobservable or unnecessary, `webRequest` is removed). (amendment A1) No manifest entry MAY use a wildcard that matches all sites (`<all_urls>`, `*://*/*`). (amendment A21) The manifest's top-level keys MUST belong to an exact allowlist maintained with the permission test; any other key, including `web_accessible_resources` and `externally_connectable`, MUST fail the test.

#### Scenario: Built manifest matches the allowlist

- GIVEN a production build
- WHEN the generated manifest is parsed by the permission test
- THEN `manifest_version` is 3
- AND required permissions equal exactly the allowlist
- AND `host_permissions` is absent or empty
- AND optional host permissions contain only portal, provider, and release-check origins

#### Scenario: A new permission fails CI until the allowlist is updated

- GIVEN a change adds `tabs` to the manifest permissions
- WHEN the permission test runs
- THEN the test fails naming the unexpected permission

#### Scenario: An unexpected top-level manifest key fails (amendment A21)

- GIVEN a built manifest that gains `web_accessible_resources` or `externally_connectable`
- WHEN the manifest test runs
- THEN the test fails naming the unexpected key

#### Scenario: Optional host permission denied by the user

- GIVEN the user selects a provider whose host permission is not yet granted
- WHEN the browser prompt is denied
- THEN the extension does not call the provider
- AND the settings page shows that the permission is missing with a control to retry

### Requirement: SHELL-2 Stable extension identity

The manifest MUST contain a pinned public `key` so the extension ID is identical regardless of the folder the unpacked extension is loaded from and across versions. The matching private key MUST NOT exist in the repository. The expected ID MUST be documented and asserted by a test.

#### Scenario: Same ID from two folders (Spike S6)

- GIVEN the release zip extracted into folder A and, separately, into folder B
- WHEN the extension is loaded unpacked from each in the smoke environment
- THEN both runs report the same extension ID
- AND it equals the documented ID

#### Scenario: Missing key fails the build check

- GIVEN a manifest without `key`
- WHEN the manifest test runs
- THEN the test fails

### Requirement: SHELL-3 Entrypoints and on-demand reading code

The extension MUST provide a background service worker, a side panel, an options page, and a popup. The popup MUST show extension status and MUST act as the fallback surface for the review card when the side panel API is unavailable (Spike S5). The manifest MUST NOT register persistent `content_scripts` for portal hosts; page-reading code MUST be injected on demand through the scripting API into tabs the extension is authorized to read.

#### Scenario: Side panel unavailable

- GIVEN a browser where the side panel API is not available
- WHEN the user starts "Analyze this page"
- THEN the review card is shown in the popup instead
- AND no error is displayed to the user

#### Scenario: No install-time portal access

- GIVEN a fresh install
- WHEN the manifest is inspected
- THEN `content_scripts` has no entry matching `linkedin.com` or `infojobs.net`

### Requirement: SHELL-4 Service-worker lifecycle and resumability

Work that outlives a single event MUST be driven by persisted state, not in-memory state. On every service-worker start (install, update, browser start, wake-up) the extension MUST idempotently re-register exactly the alarms required by persisted settings, creating no duplicates and none when scheduled scanning is disabled. Each queue handler MUST perform one bounded step per event and persist its result before returning.

#### Scenario: Alarms re-registered after restart

- GIVEN scheduled scanning is enabled in persisted settings
- WHEN the service worker is terminated and started again
- THEN exactly one alarm per defined alarm name exists

#### Scenario: No alarms when scanning is off

- GIVEN a fresh install with default settings
- WHEN the service worker starts
- THEN no scan alarm is registered

#### Scenario: Step state survives termination (Spike S7)

- GIVEN a queue with three pending steps and a fake clock
- WHEN the worker is terminated after step one and restarted
- THEN the next event executes step two and not step one again

### Requirement: SHELL-5 No remote code

The extension MUST NOT load or execute remotely hosted code. The extension-pages content security policy MUST NOT include `unsafe-eval` or remote script sources. Source MUST NOT use `eval` or `new Function`; a lint rule MUST enforce this.

#### Scenario: CSP check

- GIVEN a production build
- WHEN the manifest CSP is parsed
- THEN no `script-src` source is a remote origin and `unsafe-eval` is absent

#### Scenario: Lint rejects dynamic code

- GIVEN a source file containing `eval("1+1")`
- WHEN lint runs
- THEN lint fails

### Requirement: SHELL-6 Build, packaging and release zip

A tagged release MUST produce a zip whose extraction yields an extension installable via Load unpacked. The manifest version, `package` version, and the release tag MUST be equal. The zip MUST contain only built extension output: no tests, fixtures, spike code, environment files, or maps of personal data. The release workflow MUST run the full CI gates (SHELL-7) before publishing.

#### Scenario: Version consistency

- GIVEN a tag `v1.2.3`
- WHEN the release workflow validates versions
- THEN it fails unless the manifest version and package version are both `1.2.3`

#### Scenario: Zip content

- GIVEN a built release zip
- WHEN its file list is inspected
- THEN it contains `manifest.json` at its root
- AND contains no path under `tests/`, `spikes/`, or `.env*`

### Requirement: SHELL-7 CI gates and strict TDD activation

CI MUST run on every pull request: strict type check, lint/format check, unit tests, fixture-based browser smoke tests, and the personal-data scan (PRIV-8). Any failing gate MUST block merge. CI MUST NOT contact real portals or real LLM providers and MUST NOT use real API keys. After the foundation sub-change, `openspec/config.yaml` MUST have a non-empty `test_command`, `strict_tdd: true`, and populated `testing.*` fields.

#### Scenario: Gate failure blocks merge

- GIVEN a pull request with a type error
- WHEN CI runs
- THEN the type-check job fails and the pull request is not mergeable

#### Scenario: No live network in CI

- GIVEN the CI smoke job
- WHEN network requests are recorded
- THEN every request targets localhost fixture servers

#### Scenario: TDD switched on

- GIVEN the foundation sub-change is merged
- WHEN `openspec/config.yaml` is read
- THEN `strict_tdd` is `true` and `test_command` is non-empty

### Requirement: SHELL-8 UI localization (confirmed by owner 2026-10-10: Q3)

All user-visible strings MUST be resolved through i18n keys with complete English and Spanish catalogs. The two catalogs MUST have identical key sets, enforced by a test. The UI language setting MUST default to the browser UI language when it is English or Spanish, otherwise English. A missing key at runtime MUST fall back to English.

#### Scenario: Catalog parity

- GIVEN the English and Spanish catalogs
- WHEN the parity test runs
- THEN it fails if either catalog has a key absent from the other

#### Scenario: Default language

- GIVEN a browser UI language of `ca`
- WHEN the extension first renders
- THEN the UI language is English

#### Scenario: Language switch

- GIVEN the UI language is changed to Spanish in settings
- WHEN the options page re-renders
- THEN visible labels come from the Spanish catalog without a reload of the extension

### Requirement: SHELL-9 License and public documentation (confirmed by owner 2026-10-10: Q7)

The repository MUST include an MIT `LICENSE`, a `README` (install via Load unpacked and via Release zip for Chrome and Edge, first-run steps, and the portal terms-of-service risk disclaimer), `PRIVACY` (what data is stored and what leaves the browser), and `CONTRIBUTING` (clean-room rules, TDD, Conventional Commits).

#### Scenario: Docs exist with required sections

- GIVEN the repository root
- WHEN the docs check runs
- THEN `LICENSE`, `README`, `PRIVACY`, `CONTRIBUTING` exist
- AND the README contains install steps for Chrome and Edge and a section on portal terms-of-service risk

### Requirement: SHELL-10 Opt-in update check (confirmed by owner 2026-10-10: Q9)

An update check against the GitHub Releases API MUST be disabled by default. When enabled it MUST make at most one request per 24 hours, MUST send no cookies, credentials, or user-identifying data, and MUST require the optional `api.github.com` host permission. A newer release MUST only produce an informational notice with a link; the extension MUST NOT download or install anything.

#### Scenario: Default off

- GIVEN a fresh install
- WHEN 48 hours pass with the browser running
- THEN no request to `api.github.com` is made

#### Scenario: Daily limit

- GIVEN the check is enabled and succeeded 3 hours ago
- WHEN the check trigger fires again
- THEN no request is made

#### Scenario: Newer version notice

- GIVEN the installed version is `1.0.0` and the latest release is `1.1.0`
- WHEN the check completes
- THEN the options page shows a notice with the release URL
- AND nothing is downloaded

#### Scenario: Offline

- GIVEN the check is enabled and the network is unavailable
- WHEN the check runs
- THEN a "check failed" state is recorded and no retry occurs before the next 24-hour window

### Requirement: SHELL-11 Edge smoke before release

Each release MUST be preceded by a manual Edge smoke test covering install from the release zip, opening the review surface (side panel or popup fallback), and one fixture-based analysis. The release notes template MUST include a field recording the result.

#### Scenario: Release notes carry the result

- GIVEN the release notes template
- WHEN a release is prepared
- THEN the template contains an "Edge smoke" field that must be filled before the release is published

### Requirement: SHELL-12 Install-time script policy (amendment A21)

Installing dependencies MUST NOT run dependency build scripts unless each one is explicitly reviewed. Every per-package build-script approval in the package-manager configuration MUST be `false`, and no setting that approves all build scripts MAY be present. The root package MUST declare no install-time lifecycle script other than `prepare`, and `prepare` MUST only install the git hooks. A test run in CI MUST enforce these rules and fail naming the offending package, setting, or script.

#### Scenario: Approved build script fails

- GIVEN the package-manager configuration approves the build script of a package
- WHEN the policy test runs
- THEN it fails naming the package

#### Scenario: Allow-all switch fails

- GIVEN a setting that approves all dependency build scripts
- WHEN the policy test runs
- THEN it fails

#### Scenario: Extra install-time script fails

- GIVEN the root package declares a `postinstall` script, or `prepare` runs another command
- WHEN the policy test runs
- THEN it fails naming the script

#### Scenario: Current repository passes

- GIVEN the repository as configured by the foundation sub-change
- WHEN the policy test runs
- THEN it passes
