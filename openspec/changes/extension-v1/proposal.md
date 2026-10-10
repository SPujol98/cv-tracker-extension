# Proposal: extension-v1 — Public BYO-key MV3 job-offer analyzer and tracker

## Intent

**Build a public, local-only Chrome/Edge MV3 extension that finds job offers on portals using the user's own logged-in session, analyzes them against the user's profile with one LLM call on the user's own API key, and tracks applications. It must reach parity with the owner's private Python bot so he can retire the bot.**

- **Problem**: The owner's current pipeline has three parts: a vendored, unlicensed LinkedIn Beacons extension, a loopback bridge, and a Python bot (extraction, judge, Telegram, SQLite, xlsx). It cannot be published because the extension is third-party code and the bot hard-codes personal data. It needs a local server, Python, and Telegram. Other job seekers cannot use it.
- **Why now**: The extension still depends on unlicensed code. Public guest endpoints are walled (owner evidence, Aug–Sep 2026). Browser-session reading does work. A clean-room browser-native rewrite fixes both the licensing and the acquisition problems.
- **What success looks like**: The owner uses only the extension for his job search, with the agreed parity criteria met (see Success Criteria). Any user can install it from a GitHub Release zip, add their own key, build a profile, and analyze offers. No data leaves the browser except the LLM request to the provider the user picked.

## Owner Decisions (final, 2026-10-09)

| # | Topic | Decision |
|---|-------|----------|
| D1 | Offer acquisition | Clean-room, LinkedIn-Beacons-style. The extension opens portal pages (search results **and** the detail page of each new offer) in a browser tab with the user's own logged-in session and reads the DOM through **per-portal adapters**: LinkedIn first, InfoJobs next, more later. There is also a manual **"Analyze this page"** action for the offer the user is viewing. **No** guest/public endpoint fetching (robots.txt). The vendored LinkedIn Beacons code is **not** reused or integrated (no license). Only the idea of the owner-authored filter algorithm may be re-implemented, and **without** his term lists. |
| D2 | Beacons (scheduled scans) | Optional and **OFF by default**. Conservative default cadence, daily caps, rate-courtesy randomized pacing (note P5). |
| D3 | Scoring | **One structured LLM call** (extraction + match against profile + verdict), then deterministic post-validation (walls, apply-instruction warnings, language inference). This replaces the bot's two-step hybrid. |
| D4 | API key | Stored locally in extension storage, with a clear warning and advice to use a spend-limited key. |
| D5 | Providers | Anthropic + OpenAI in v1, behind an adapter boundary. More providers later. |
| D6 | Distribution and data | Public GitHub repo. Install via Load unpacked or a Release zip. Chrome + Edge MV3. No backend. All user data stays local. The owner is the first user, and his Python bot keeps running until parity. |

## Scope

### In Scope (v1)

1. **Foundation**:
   - Tooling: WXT + TypeScript strict + Vitest + fake-indexeddb + Playwright smoke, CI, lint/format.
   - Manifest: pinned `key` in the manifest, minimal permissions with optional host permissions.
   - Release: release-zip workflow.
   - Safeguards and docs: personal-data/clean-room scan, CONTRIBUTING/PRIVACY/README.
   - TDD: switch on strict TDD (`strict_tdd: true`, `test_command` set in `openspec/config.yaml`).
2. **Spikes S1–S7**: time-boxed, findings recorded before the design points that depend on them are frozen.
3. **Engine (pure TS)**:
   - Zod schemas and the URL → source/id/canonical registry.
   - Clean-room title/company filter algorithm (no default term lists).
   - Language inference (ES/EN/CA, extensible) and apply-instruction warnings.
   - Single-call analysis pipeline with deterministic post-validation: grounding substring, claim-id existence, placeholder text, walls, verdict derivation.
   - Content-hash cache, plus a token/cost meter with a daily budget hard stop.
4. **LLM providers**:
   - Adapter boundary with Anthropic and OpenAI implementations.
   - Structured output, streaming, and key validation.
   - Local key storage with a warning (D4).
5. **Candidate profile**:
   - Onboarding from CV text: the LLM proposes claims and tags, the user reviews them.
   - Branches, each with its own title filters, rules, and dealbreakers.
   - Base CV PDFs stored per branch + language, with a recommended PDF per offer (open/download only, never auto-upload).
6. **Portal adapters**:
   - `PortalAdapter` boundary covering search-results reading, detail-page reading, and session/wall detection (login, authwall, checkpoint, rate-limit).
   - LinkedIn adapter first.
7. **Manual analysis**:
   - "Analyze this page" action on the current offer.
   - Side-panel review card: score, verdict, fit, walls, apply warnings, language, recommended PDF, tokens/cost. Save to the tracker.
8. **Application tracker**:
   - IndexedDB (Dexie) repository with a status workflow, list/search, and notes.
   - CSV/JSON export, plus full backup export/import (profile, PDFs, tracker, settings).
9. **Beacon scanning** (D1/D2):
   - Saved searches and a user-triggered "Scan now".
   - Optional schedule, **OFF by default**.
   - Tab-based search + detail reading through adapters.
   - Seen-id store with a first-run baseline.
   - Paced sequential queue that survives service-worker restarts.
   - Daily caps, active-hours window, jitter.
   - Wall stop with backoff (2h/6h/24h, then pause).
   - Notifications/badge.
10. **Parity extras needed for cutover**:
    - InfoJobs adapter (unless deferred, see Q6).
    - Generic CSV history importer.
    - Optional GitHub Releases update check (see Q9).
    - Owner side-by-side parity run.
11. **Privacy safeguards**:
    - No telemetry.
    - All LLM/offer text rendered as `textContent`.
    - Offer-as-data prompt wrapping with no tool use.
    - First-run acknowledgement of the portal ToS risk (see Q10).
    - Edge manual smoke test before each release.

### Out of Scope (v1)

- **Any reuse or integration of the vendored `extension/` code.** Copying the owner's term lists, company blocklist, judge calibration anchors, candidate facts, claims, synonyms, honest-gaps, CV masters, or CVs is also out.
- Guest/public endpoint fetching (`/jobs-guest/`, the `jobPosting/{id}` fragment) and service-worker `fetch` of portal HTML.
- The bot's two-step hybrid scorer (extraction + keyword scorer + judge). A later change can introduce a second scorer, extracting a strategy seam from the single analysis function when that second implementation exists, but it is not built (note P1).
- CV rendering/generation. v1 only picks the base PDF.
- Backend, accounts, sync servers, telemetry, Chrome Web Store / Edge Add-ons listing.
- Telegram notifications (recommended deferral, Q4), XLSX export and folder sync (Q5), providers beyond Anthropic/OpenAI (Q11), portals beyond LinkedIn/InfoJobs.
- Firefox/Safari, mobile.
- Automated E2E against real LinkedIn/InfoJobs. CI uses local sanitized fixtures only.

## Capabilities

> Contract for `sdd-spec`. `openspec/specs/` is empty (greenfield), so every capability is new.

### New Capabilities

| Capability | Covers |
|------------|--------|
| `extension-shell` | Manifest and permissions model (required vs optional host permissions, `activeTab`), pinned extension key, build/packaging/release zip, entrypoints (service worker, side panel, options, popup), service-worker lifecycle and alarm re-registration, optional update check |
| `llm-providers` | Provider adapter contract; Anthropic and OpenAI implementations; structured output; streaming; key entry, validation, and local storage with a warning; per-call token/cost metering; daily budget hard stop |
| `candidate-profile` | CV-text onboarding; LLM-proposed claims and tags with user review; branches; per-branch title filters, rules, and dealbreakers; base CV PDFs per branch + language; profile versioning for cache keys |
| `offer-analysis` | Single structured analysis call; offer-as-data wrapping; deterministic post-validation (grounding, claim ids, placeholders, walls, verdict derivation); language inference; apply-instruction warnings; recommended branch/PDF; content-hash cache |
| `portal-adapters` | `PortalAdapter` contract; URL → source/id/canonical registry; search-results and detail-page DOM reading; session-expiry and wall classification; LinkedIn adapter; InfoJobs adapter; fixture-based contract tests |
| `manual-analysis` | "Analyze this page" action; side-panel review card; save-to-tracker; extraction-failure UX |
| `beacon-scanning` | Saved searches; Scan now; opt-in schedule (off by default); clean-room title/company filter; seen ids and first-run baseline; resumable paced queue; caps, active hours, jitter; wall backoff/pause; notifications |
| `application-tracker` | Offer + analysis records; status workflow; list/search/notes; Dexie schema versioning/migrations |
| `data-portability` | CSV/JSON export; full backup export/import; generic CSV history import; backup reminders |
| `privacy-safeguards` | Local-only data guarantee; no telemetry; `textContent`-only rendering of untrusted text; first-run ToS-risk acknowledgement; repository personal-data/clean-room scan |

### Modified Capabilities

None (no existing specs).

## Approach

**Stack (justified per `rules.proposal`).**

| Choice | Why |
|--------|-----|
| **WXT** (Vite-based) | Active; builds cross-browser MV3 manifests; `wxt zip` produces the Release artifact; first-class `WxtVitest()` with fake-browser storage. Plasmo is in maintenance mode, and CRXJS is slower and fragile under MV3 HMR. Risk: pre-1.0 churn. Mitigation: pin the version and keep the core logic framework-free. |
| **TypeScript strict + Zod** | One schema source for storage records, LLM structured output, and backup files |
| **Dexie (IndexedDB)** | Tracker, profile, PDFs (Blobs), queue, cache. `chrome.storage.local` is capped at 10 MB and is reserved for settings/key. |
| **React** in extension pages | Largest contributor pool; low stakes |
| **Vitest + fake-indexeddb** | Unit/integration with strict TDD |
| **Playwright** (bundled Chromium, `--load-extension`) | Smoke/E2E against a local server serving sanitized portal-like fixtures. Never real portals in CI. |
| Package manager and lint/format tool | Decided in design (recommend pnpm and a single lint+format tool) |

**MV3 runtime shape.**
- The service worker runs as a **resumable queue runner**: state lives in IndexedDB, and an alarm tick plus event-driven steps process **one step per event**. This survives the 30 s idle / 5 min call / 30 s fetch-response limits.
- LLM calls are made **only from the service worker** and are **streamed**, so the first byte arrives fast (validated by S7).
- UI runs in extension pages: side panel for review, options for onboarding/settings, popup for status and fallback.

**Acquisition (D1).**
- Adapters run through `chrome.scripting` in a single reused scan tab that navigates the same URL forms a user would.
- Adapters MUST NOT use robots-disallowed paths/params such as `/jobs-guest/` or `runSearch`.
- Portal host permissions are optional and requested at runtime.
- Manual analysis uses the adapter for the current tab. Whether it also offers a generic `activeTab` fallback is Q12.

**Scoring (D3).**
- One provider call returns a flat JSON schema: requirements with literal evidence, fit with claim ids, walls, score, branch.
- Deterministic TS then validates and derives the verdict.
- Prompt layout puts a stable prefix first (rubric + claims) to benefit from provider prompt caching.
- Cache key: `sha256(normalized offer text + model + prompt version + profile version)`.

**API key (D4).**
- Plaintext in `chrome.storage.local`, with an explicit warning and spend-cap advice.
- The key is never sent anywhere except the chosen provider and never logged.
- Optional passphrase encryption (exploration D2) stays a later option, not v1.

**Delivery.** `extension-v1` is the umbrella change. Its spec and design cover all capabilities. `sdd-tasks` groups the work into the **chained sub-changes** below. Each sub-change is a segment of ≤400-line PR slices under `auto-chain`, has its own exit criteria, and is merged before the next starts.

### Phased roadmap (chained sub-changes)

| # | Sub-change | Content | Exit criteria | Depends on |
|---|-----------|---------|---------------|------------|
| 0 | `foundation` | WXT+TS strict skeleton, Vitest (+fake-browser, fake-indexeddb), Playwright smoke on a fixture server, CI, manifest with pinned `key` and minimal/optional permissions, release-zip workflow, personal-data/clean-room scan, LICENSE/README/PRIVACY/CONTRIBUTING; set `test_command` and flip `strict_tdd: true` | Green CI; release zip loads in Chrome; extension ID is stable across two folder locations; strict TDD on | — |
| 1 | `spikes` | S1–S7 (below). Findings go in `docs/spikes/Sx.md`; spike code stays on unmerged branches or an excluded `spikes/` dir | Each spike has a recorded verdict; design amended where an assumption failed | 0 |
| 2a | `engine-core` | (note P3) Schemas, source registry, language inference, apply-instruction warnings, single-call pipeline + post-validation + verdict + cache math + cost math (ES and EN content), core ports, portal classify/guard, synthetic fixtures | Pipeline passes golden synthetic fixtures with a fake provider | 1 (S1, S2, S7) |
| 2b | `providers` | (note P3) Provider adapters (Anthropic, OpenAI) with streaming, key validation, error taxonomy and retry, price catalog, shared contract suite, recorded fixtures | Provider contract tests pass on recorded fixtures | 2a |
| 3 | `profile` | Options-page onboarding (CV text → proposed claims/tags → review), branches with rules/dealbreakers, base PDFs per branch+language, key settings page with warning, budget gate, **full backup export/import and backup reminder (moved from 5, note P3)** | A fresh user completes a profile without editing JSON; backup round-trip restores profile data | 2b |
| 4 | `manual-analysis` | **Queue transitions and runner (moved here, note P3)**, LinkedIn detail adapter (content reading), "Analyze this page", side-panel card, re-analyze, cancel. Save to tracker is **not** here (moved to 5) | Owner analyzes a live LinkedIn offer end to end | 3 (S3, S5) |
| 5 | `tracker` | Dexie tracker repo, status workflow, list/search/notes, **Save to tracker (moved from 4)**, CSV/JSON export, backup round-trip extended to tracker tables | Backup round-trip restores identical data; owner can work his pipeline from it | 4 (S6) |
| 6 | `beacons` | **Clean-room title/company filter and beacon policy (moved here, note P3)**, saved searches, LinkedIn search adapter, Scan now, opt-in schedule, seen ids/baseline, paced queue, caps/active hours/jitter, wall backoff/pause, notifications/badge, first-run ToS acknowledgement | A scheduled run on fixtures surfaces only new, filtered offers, analyzed and paused correctly on a simulated wall; owner runs one live opt-in scan | 5 (S3, S7) |
| 7 | `parity-cutover` | InfoJobs adapter (search + detail), **Catalan language content, release pipeline with provenance, docs check (moved here, note P3)**, generic CSV history importer, update check (if accepted), Edge smoke, side-by-side parity run, v1.0 release | Success Criteria met; v1.0 tagged | 6 |

Post-v1 (separate changes): more providers, more portals, Telegram adapter, XLSX/folder sync, passphrase key encryption, a second scorer (two-step hybrid; strategy seam extracted when it exists, note P1), i18n beyond v1 languages.

### Spikes (early tasks, sub-change 1)

| ID | Question | Feeds |
|----|----------|-------|
| S1 | Anthropic call from the service worker: is `anthropic-dangerous-direct-browser-access` still required from the extension origin? Do structured output and streaming work? | `llm-providers` |
| S2 | OpenAI call from the service worker: strict json_schema plus streaming | `llm-providers` |
| S3 | **Re-scoped by D1**: tab-based reading of LinkedIn search results and detail pages (lazy-loaded description/"see more", virtualized lists, session-expiry markers, realistic pacing); InfoJobs challenge behavior in a session tab. **No** service-worker fetch variant. | `portal-adapters`, `beacon-scanning` |
| S4 | File System Access directory-handle persistence. **Conditional**: only if Q5 keeps folder sync in scope; otherwise skipped and recorded as N/A. | `data-portability` |
| S5 | Edge side-panel smoke (and popup fallback) | `extension-shell`, `manual-analysis` |
| S6 | Unpacked-ID stability with a pinned `key`; IndexedDB quota with stored PDFs | `extension-shell`, `data-portability` |
| S7 | Service-worker survival on a slow LLM call with streaming; queue resume after a forced restart | `extension-shell`, `offer-analysis`, `beacon-scanning` |

Design may proceed in parallel with assumptions tagged by spike ID. Any failed assumption triggers a design amendment before the dependent sub-change starts.

### Size forecast (assumption; replaces the earlier rough forecast, note P4)

| Sub-change | Authored changed lines (incl. tests/docs, excl. lockfiles/generated) | PR slices (≤400) |
|-----------|------|------|
| 0 foundation | 900–1,300 | 3–4 |
| 1 spikes (merged findings only) | 300–500 | 1–2 |
| 2a engine-core | 1,500–2,000 | 4–5 |
| 2b providers | 1,300–1,700 | 4–5 |
| 3 profile (+ backup) | 1,900–2,400 | 5–6 |
| 4 manual-analysis (+ queue) | 2,000–2,600 | 5–7 |
| 5 tracker | 1,300–1,700 | 4–5 |
| 6 beacons (+ filter, policy) | 2,300–3,000 | 6–8 |
| 7 parity-cutover | 1,600–2,300 | 4–6 |
| **Total** | **~13,100–17,500** | **~36–48** |

The earlier estimate (~6,000–8,300) counted production code optimistically; tests, fixtures, and docs under strict TDD roughly double it, and D1 adds tab-based search reading and two portal adapters to v1. Path to first usable capability (sub-changes 0 to 4): ~7,900–10,500 lines, ~22–29 slices. `400-line budget risk: High` for the umbrella; chaining is mandatory.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json`, `wxt.config.ts`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts` | New | Toolchain |
| `.github/workflows/` | New | CI (typecheck, lint, unit, smoke, personal-data scan) and release zip |
| `src/entrypoints/` (background, sidepanel, options, popup, content) | New | MV3 entrypoints |
| `src/core/` (schemas, filter, language, apply-instructions, analysis pipeline, verdict) | New | Framework-free engine |
| `src/providers/` | New | Anthropic and OpenAI adapters |
| `src/portals/` (`linkedin/`, `infojobs/`, registry) | New | Portal adapters |
| `src/storage/` (Dexie DB, settings, backup) | New | Persistence and portability |
| `tests/fixtures/` | New | Synthetic, sanitized fixtures only |
| `docs/` (`spikes/`, privacy, ToS-risk disclosure) | New | Spike findings, user-facing policy |
| `openspec/config.yaml` | Modified | Sub-change 0 sets `test_command`, `testing.*`, `strict_tdd: true` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **LinkedIn ToS 8.2 / account restriction from tab-based automated reading.** Risk is per user and is reputational for a public repo. | High (inherent) | Scheduled scans OFF by default. When on: sequential single reused tab, rate-courtesy randomized pacing (note P5), conservative cadence (several hours + jitter), first page only, daily caps, active-hours window. Detail pages load only for **new, title-filtered** offers. Hard stop on login/authwall/checkpoint/429/999 with 2h/6h/24h backoff, then pause. No guest endpoints and no robots-disallowed URL forms. First-run acknowledgement and README disclaimer. Manual analysis remains the lowest-risk path. |
| DOM fragility (portal markup changes) | High | Adapter boundary with multiple selector strategies; sanitized fixtures plus contract tests; explicit "could not read this page" UX; adapters versioned independently |
| Prompt injection via offer text | Medium | Offer wrapped as delimited data; no tools; constrained structured output; deterministic post-validation (grounding substrings, claim-id existence); all output rendered with `textContent`; no remote code (MV3 CSP) |
| Data loss when the unpacked extension ID changes (re-extract to another folder) or on uninstall | Medium | Pinned manifest `key` (verified in S6); full backup export/import; periodic backup reminder; restore round-trip test |
| Clean-room breach / personal data in public repo | Medium | Vendored code never copied into the repo. Filter re-implemented from a written behavior spec with freshly authored test vectors. CI scan for generic PII patterns. Local pre-commit hook against a **gitignored** personal denylist (the denylist itself must never be committed; an optional CI secret holding hashed tokens). PR checklist attestation. |
| API key at rest in plaintext | Medium | Clear warning, spend-limited dedicated key advice, key sent only to the selected provider host, never logged or exported in backups by default, minimal host permissions |
| Service-worker termination mid-analysis or mid-scan | Medium | Resumable IndexedDB queue, one step per event, streaming responses, alarms re-registered on startup (S7) |
| Score divergence from the bot (single call vs hybrid) | Medium | Owner-labeled calibration set and side-by-side parity run; A later change can introduce a second scorer, extracting a strategy seam from the single analysis function when that second implementation exists (note P1) |
| Cost surprise on the user's key | Low–Med | Title prefilter before any LLM call, content-hash cache, cheap default model, per-analysis cost display, daily budget hard stop |
| WXT pre-1.0 churn | Low–Med | Pin version; engine stays framework-free |
| Edge differences (side panel) | Low–Med | S5 smoke; popup fallback; manual Edge smoke per release |
| Scope (~6–8k lines) stalls before parity | Medium | Strict sub-change order with exit criteria; bot keeps running until parity; manual analysis is useful on its own after sub-change 4 |

## Rollback Plan

- **Owner continuity**: the Python bot stays the system of record until parity is accepted. At any point, rollback means going back to the bot. No migration is destructive to the bot's data.
- **Per slice**: every PR slice is a self-contained work unit and is reverted with `git revert`. Sub-changes merge in order, so reverting a later sub-change leaves earlier ones working. (note P2) A sub-change that bumps the Dexie version cannot be rolled back by a plain revert once released: installed databases are already upgraded and the older build refuses to open them. Before release, `git revert` is safe. After release, roll forward: keep the version declaration and its tables, remove or disable the code paths, or ask users to restore a pre-upgrade backup.
- **Per release**: users reinstall the previous Release zip **into the same folder**. The pinned `key` keeps the ID, so IndexedDB survives.
- **Schema changes**: Dexie migrations are forward-only, so a downgrade across a schema version requires restoring from a backup export taken before the upgrade. The release notes for any schema bump must say so. A released schema bump is rolled back by rolling forward (see "Per slice", note P2), never by a revert that lowers the schema version.
- **Risky features**: beacons ship disabled by default and can be turned off instantly from settings. A wall pauses scanning automatically. Portal host permissions can be revoked by the user.

## Dependencies

- Owner's own Anthropic and/or OpenAI API key for S1/S2 and live checks. Never in CI.
- Owner's logged-in LinkedIn (and InfoJobs) session for S3 and live smoke. Manual and local only.
- Chrome (latest stable) and Edge for S5/smoke; Node LTS for tooling.
- An owner-labeled calibration set of offers kept **outside** the repo for the parity run.

## Success Criteria

Engineering:
- [ ] CI green on every merged slice (typecheck, lint, unit, fixture smoke, personal-data scan); strict TDD active from sub-change 0 onward.
- [ ] Release zip installs via Load unpacked on Chrome and Edge; extension ID is stable across folder locations.
- [ ] A new user goes from install to first analyzed offer (key + profile + "Analyze this page") without editing any file.
- [ ] No network request leaves the browser except to the selected LLM provider and the portals the user browses or scans (plus GitHub Releases if Q9 is accepted).

**Parity to retire the bot.** These are recommended defaults; the owner must confirm the thresholds (Q13).
- [ ] **Side-by-side run** for 14 consecutive days with the bot and the extension on equivalent LinkedIn saved searches (and InfoJobs if Q6 = v1).
- [ ] **Coverage**: the extension surfaces at least 95% of the new title-filtered offers the bot surfaced in the same window. Each miss is explained.
- [ ] **Verdict agreement**: at least 85% agreement on an owner-labeled calibration set of ~40 offers, and **zero** offers the owner labels "apply" are rejected by the extension.
- [ ] **Deterministic parity**: apply-instruction warnings and language inference match the bot on that calibration set (precision-first; no new false positives).
- [ ] **CV pick**: the recommended base PDF (branch + language) matches the owner's choice on at least 90% of the calibration set.
- [ ] **Tracker**: the owner's existing tracker history imports through the generic CSV importer, and he manages applications only in the extension.
- [ ] **Stability**: 7 consecutive days with no lost data, no stuck queue, and a verified backup restore round-trip.
- [ ] **Cost**: average cost per analyzed offer is no higher than the bot's on the same model class.
- [ ] Owner explicitly accepts that mobile notifications (Telegram) are not available after cutover, or Q4 is revisited.

## Open Questions (do not block spec/design; recommended defaults in bold)

| # | Question | Recommended default | Blocks |
|---|----------|---------------------|--------|
| Q1 | Profile onboarding input: paste CV text vs local PDF text extraction (pdf.js) | **Paste text in v1**; local pdf.js extraction as a later enhancement (never send the PDF to the provider) | Sub-change 3 detail only |
| Q2 | CV branches fixed vs user-defined; supported languages | **User-defined branches**; offer/CV languages **ES/EN/CA** with an extensible inference table | Sub-change 3 |
| Q3 | UI language(s) | **English + Spanish** UI via i18n keys; LLM rationale in the user's chosen language | Sub-change 3/4 UI copy |
| Q4 | Telegram in v1 | **No** (post-v1 optional adapter); owner confirms cutover without mobile push | Parity criterion |
| Q5 | Export: CSV/JSON vs XLSX (and folder sync) | **CSV/JSON + full JSON backup in v1**; XLSX/folder sync post-v1. If folder sync stays, S4 runs. | Sub-change 5, S4 |
| Q6 | InfoJobs in v1 vs v1.1 | **v1 (sub-change 7)**, because the owner needs it for parity; the public build can ship it marked "beta" | Sub-change 7 scope |
| Q7 | License | **MIT** | Sub-change 0 |
| Q8 | Tracker state set | **Simplified ~8 English enum states** with i18n labels, plus a mapping from the bot's 13 states for import | Sub-change 5 |
| Q9 | Update check via the GitHub Releases API | **Yes, opt-in**, one request at most per day, no telemetry; adds the `api.github.com` host permission as optional | Sub-change 7 |
| Q10 | First-run ToS acknowledgement | **Yes**, mandatory before enabling any portal scan; manual analysis needs only the README disclaimer | Sub-change 6 |
| Q11 | Provider order after OpenAI | **Gemini, then OpenRouter, then local Ollama** (optional localhost permission) | Post-v1 |
| Q12 | (New) "Analyze this page" on **any** site or only supported portals | **Supported portals + a generic `activeTab` fallback** (main-content text with user confirmation), with no extra host permission | Sub-change 4 |
| Q13 | (New) Parity thresholds above (14 days, 95% coverage, 85% agreement, ~40 labeled offers) | **Accept as written** | Sub-change 7 exit |
| Q14 | (New, process) Umbrella change vs one SDD change per sub-change | **Keep `extension-v1` as umbrella** for spec/design; `sdd-tasks` emits phase-grouped tasks per sub-change | Orchestrator routing |
| Q15 | (New) Confirm owner authorship of `extension/filter.js` before re-implementing its algorithm idea | **Owner confirms in writing in the PR description**; re-implement from a behavior spec, not from the file | Sub-change 2 filter task |

## Privacy Constraints (per `rules.proposal`)

- The user's own API key is stored only locally and sent only to the chosen provider.
- All profile, PDF, tracker, cache, and queue data stays in browser storage. No backend, accounts, or telemetry.
- Offer text leaves the browser only inside the LLM request the user's configuration triggers.
- Nothing personal from the private reference project enters this repo: no term lists, blocklists, rubric anchors, facts, claims, synonyms, CVs, or tracker data. Fixtures are synthetic.
