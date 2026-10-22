# Tasks: extension-v1 - Public BYO-key MV3 job-offer analyzer and tracker

Umbrella change. Sub-changes are the task groups below (0 foundation, 1 spikes, 2a engine-core, 2b providers, 3 profile + backup, 4 manual-analysis + queue, 5 tracker, 6 beacons + filter/policy, 7 parity-cutover). Inputs: `proposal.md`, `specs/*/spec.md` (amendments A1-A21 applied; A18-A21 slotted by the tasks amendment of 2026-10-18, see "Amendment slotting A18-A21" below), `design.md`, `judgment-day-r1.md` (approved; suspects that were not adopted are notes only, see Notes).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~18,400-21,900 authored (additions + deletions; tests, fixtures and docs included; lockfile and generated files excluded). Point estimate ~20,400 (was ~18,800 before amendments A18-A21, which add ~1,600) |
| 400-line budget risk | High (umbrella). Every slice below is planned at or under 400 lines; 2a-5 and 2a-3 sit at the budget, with no headroom |
| Chained PRs recommended | Yes (mandatory) |
| Suggested split | 64 chained PR slices: 0a-0f, 1a-1b, 2a-1..2a-9, 2b-1..2b-4, 3-1..3-8, 4-1..4-8 (plus 4-4a, 4-5a, 4-6a), 5-1..5-5, 6-1..6-11 (plus 6-6a), 7-1..7-7. Execution order of the inserted slices is given in "Dependencies and parallelism" |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main (owner, 2026-10-10) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Notes on the forecast:

- The design forecast was 13,100-17,500 lines in 36-48 slices. This breakdown is higher for three reasons: explicit RED test tasks (Threat Matrix, post-validation rows), the forced split of 2a (6 slices), 3 (8 slices) and 6 (10 slices) to stay under 400 lines, and a few helper files the design implies (shared provider HTTP helper). No scope was added.
- Path to the first usable capability (sub-changes 0 to 4): about 12,600 lines in 38 slices (11,300-14,000; was 11,200 in 30 slices before A18-A21).
- Amendments A18-A21 (2026-10-18) add 24 tasks and 10 slices, about 1,600 authored lines (range 1,400-1,900). The design estimated 700-950; the difference is the explicit RED tables and negative vectors that strict TDD requires (host-spoofing vectors, assertion classes, the install-time script table), plus the splitting overhead of keeping every slice at or under 400. Every slice that was already at 350-400 lines was split into a new slice instead of inflated; only edits of 35 lines or less were made in place (2a-1, 2a-2, 2a-4, 2a-5, 2a-6, 4-5, 6-5), each re-forecast below.
- `Decision needed before apply` is `No` because the strategy is `auto-chain`. The one open input is the chain strategy (`stacked-to-main` or `feature-branch-chain`); the orchestrator must obtain it once before the first PR is opened. Recommendation: `stacked-to-main` (each slice is independently green under CI, the repository is greenfield, and branch protection applies from slice 0a). With `feature-branch-chain`, PR 0a targets the tracker branch and each later PR targets the immediately previous PR branch.
- If sub-change 7 runs over its forecast, slice 7-4 (update check) is the first candidate to move post-v1 (owner decision Q9).

### Per-sub-change forecast

| Sub-change | Slices | Estimated lines |
|---|---|---|
| 0 foundation | 6 (0a-0f) | ~1,840 (+240, A21 and the A19 egress lint plugin) |
| 1 spikes | 2 (1a-1b) | ~550 |
| 2a engine-core | 9 (2a-1..2a-9) | ~2,940 (+710: A18 in 2a-1/2a-2/2a-4/2a-5 and new 2a-7; A19 in 2a-6 and new 2a-9; A20 in 2a-6 and new 2a-8) |
| 2b providers | 4 | ~1,510 |
| 3 profile + backup | 8 | ~2,710 |
| 4 manual-analysis + queue | 11 (4-1..4-8, 4-4a, 4-5a, 4-6a) | ~3,040 (+460: A19 in 4-4a, 4-5, 4-5a, 4-8; A18 and A20 chips in 4-6a) |
| 5 tracker | 5 | ~1,680 |
| 6 beacons + filter/policy | 12 (6-1..6-11, 6-6a) | ~3,730 (+210: A19 in 6-5, 6-6a, 6-11) |
| 7 parity-cutover | 7 | ~2,410 |

### Amendment slotting A18-A21 (slice forecasts after re-check against the 400-line budget)

| Slice | Status | New forecast | Change |
|---|---|---|---|
| PR 0f | new | ~240 | A21 top-level key allowlist, install-time script policy, A19 egress lint plugin |
| PR 2a-1 | edited in place | ~360 (was ~350) | `Diagnostics.ungroundedClaims` in the schema (2a.4) |
| PR 2a-2 | edited in place | ~390 (was ~380) | rubric sentence in the prefix (2a.6) |
| PR 2a-4 | edited in place | ~370 (was ~350) | `grounding_downgrade` in `deriveVerdict` (2a.11) |
| PR 2a-5 | edited in place | ~400 (was ~400) | `derive` passes `diagnostics.ungroundedClaims.count` (one line, 2a.17); at the budget |
| PR 2a-6 | edited in place | ~385 (was ~350) | `RawSearchItem`, `SearchItem`, `HostClass`, `idPattern`, `canonicalFor` types (2a.20) and registry `canonicalFor` (2a.21) |
| PR 2a-7 | new | ~260 | A18 step 8b `auditRationale` and its wiring |
| PR 2a-8 | new | ~220 | A20 `classifyHost`, `KNOWN_ATS_APEXES`, `mapUrl` and guard delegation |
| PR 2a-9 | new | ~150 | A19 strict reader result schemas |
| PR 4-4a | new | ~90 | A19 LinkedIn adapter `idPattern` and `canonicalFor` plus contract cases |
| PR 4-5 | edited in place | ~350 (was ~300) | A19 strict parse of the activeTab reader result (4.11) |
| PR 4-5a | new | ~120 | A19 generic URL from `tabs.get`, `previewId`, `confirmGeneric` payload; A20 host class in the preview |
| PR 4-6a | new | ~110 | A18 "Unverified figures" chip, A20 "Unverified source" chip |
| PR 4-8 | new | ~90 | A19 page-content canary E2E (manual flow) |
| PR 6-5 | edited in place | ~380 (was ~350) | A19 search reader returns ids only (6.12, 6.13) |
| PR 6-6a | new | ~100 | A19 scan driver navigates only rebuilt URLs |
| PR 6-11 | new | ~80 | A19 page-content canary E2E (scan flow) |

Slices 4-4 (~400), 4-6 (~400), 6-6 (~400), 6-7 (~400) and 2a-3 (~400) were already at the budget and are untouched. The A19 canary for the manual flow did not fit 4-7 (~330) and got its own slice 4-8; the scan canary did not fit 6-10 (~330) and became 6-11.

### Suggested Work Units

Focused test command is `pnpm vitest run <path>` unless stated; the full gate for every slice is `pnpm typecheck && pnpm lint && pnpm depcruise && pnpm test` (plus `pnpm build && pnpm vitest run tests/build` from 0d). "Base" for `feature-branch-chain` is the immediately previous slice; for `stacked-to-main` it is main after the previous slice merges. Rollback for slices that bump the Dexie version (4-1, 5-1, 6-2, and 3-1 for v1) is plain `git revert` only before a release; after a release it is roll-forward (proposal note P2).

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 0a | Runner, strict TDD flip, Biome base | PR 0a | `pnpm vitest run tests/build/config.test.ts tests/lint-fixtures/biome-base.test.ts` | `pnpm test` exits 0; `pnpm typecheck` | toolchain files; revert restores empty repo |
| 0b | Layer boundaries and source-ban plugins | PR 0b | `pnpm vitest run tests/lint-fixtures` | `pnpm depcruise`, `pnpm lint` on fixtures | `biome.json` overrides, `biome-plugins/`, `.dependency-cruiser.cjs` |
| 0c | Repo policy, deps check, secretlint, hooks | PR 0c | `pnpm vitest run tests/unit/repo-policy tests/unit/check-deps.test.ts` | `pnpm check:repo-policy --all`, `pnpm secretlint`, real `git commit` in a temp repo | `scripts/`, `.secretlintrc.json`, hook config |
| 0d | Manifest, key script, settings, router/sender policy, alarms skeleton | PR 0d | `pnpm vitest run tests/build/manifest.test.ts tests/unit/router.test.ts` | `pnpm build` then `vitest run tests/build` | `wxt.config.ts`, `src/background`, `src/shared/messaging` |
| 0e | i18n, Playwright loading, CI/CodeQL/Dependabot, docs skeleton | PR 0e | `pnpm vitest run tests/unit/i18n.test.ts tests/build/workflows.test.ts` | `pnpm e2e` loads the extension and compares IDs from two folders | `.github/`, `docs/`, `src/ui/i18n`, `tests/e2e` |
| 0f | Manifest top-level key allowlist, install-time script policy, restricted-egress lint plugin (A21, A19) | PR 0f | `pnpm vitest run tests/build/manifest.test.ts tests/build/supply-chain.test.ts tests/lint-fixtures/gritql-egress.test.ts` | `pnpm build && pnpm vitest run tests/build`; `pnpm lint` | `tests/build/manifest-rules.ts`, `tests/build/supply-chain.test.ts`, `biome-plugins/restricted-egress.grit`, `biome.json` override |
| 1a | S1 and S2 verdicts (provider streaming + structured output) | PR 1a | N/A (docs): `pnpm vitest run tests/unit/docs-skeleton.test.ts` | Owner-run spike branch against the real provider (needs authorization) | `docs/spikes/S1.md`, `S2.md` only |
| 1b | S3, S4 (N/A), S5, S6, S7 verdicts and design amendments | PR 1b | N/A (docs) | Owner-run spike branches: live portal read, Playwright `route.fulfill`, popup gesture, forced worker stop | `docs/spikes/S3..S7.md`, `design.md` amendments |
| 2a-1 | Core ports (runtime, llm), catalog types, cost math, text, analysis schemas | PR 2a-1 | `pnpm vitest run tests/unit/core/cost.test.ts tests/unit/core/text.test.ts tests/unit/core/schemas` | `pnpm test` (node project) | new `src/core` modules only |
| 2a-2 | Profile schema, profileVersion, dealbreaker refs, prompt builder, cache key | PR 2a-2 | `pnpm vitest run tests/unit/core/analysis/prompt.test.ts tests/unit/core/profileVersion.test.ts` | prompt snapshot + version bump enforcement | `src/core/analysis/{prompt,cacheKey,profileVersion}.ts` |
| 2a-3 | Post-validation chain steps 1-8 | PR 2a-3 | `pnpm vitest run tests/unit/core/analysis/postValidate.test.ts` | per-row table tests | `postValidate.ts` |
| 2a-4 | Verdict, injection signals, language, apply warnings, PDF pick | PR 2a-4 | `pnpm vitest run tests/unit/core/verdict.test.ts tests/unit/core/language.test.ts tests/unit/core/applyWarnings.test.ts` | table tests | independent modules |
| 2a-5 | derive, analyzeOffer, test-only fake provider, golden fixtures | PR 2a-5 | `pnpm vitest run tests/unit/core/analysis/analyze.test.ts tests/unit/core/analysis/golden.test.ts` | golden synthetic fixtures with the fake provider | `analyze.ts`, `derive.ts`, `tests/support/fakeProvider.ts` |
| 2a-6 | Portal core: types (incl. A19/A20 types), registry, mapUrl, canonicalFor, guard, classify; coverage gate | PR 2a-6 | `pnpm vitest run tests/unit/core/registry.test.ts tests/unit/core/guard.test.ts tests/unit/core/classify.test.ts` | `pnpm test --coverage` (90% for `src/core`) | portal core modules; coverage threshold |
| 2a-7 | Rationale audit step 8b and its wiring (A18) | PR 2a-7 | `pnpm vitest run tests/unit/core/analysis/rationaleAudit.test.ts tests/unit/core/analysis/postValidate.audit.test.ts` | table tests per assertion class; cache-hit consistency through `derive` | `rationaleAudit.ts` and the 8b hook in `postValidate.ts` |
| 2a-8 | `classifyHost`, `KNOWN_ATS_APEXES`, `mapUrl` and guard delegation (A20) | PR 2a-8 | `pnpm vitest run tests/unit/core/classifyHost.test.ts tests/unit/core/registry.test.ts tests/unit/core/guard.test.ts` | negative-vector table; `pnpm test --coverage` | `classifyHost` block in `registry.ts` and the delegation lines in `mapUrl`/`guard.ts` |
| 2a-9 | Strict reader result schemas (A19) | PR 2a-9 | `pnpm vitest run tests/unit/core/schemas/reader.test.ts` | cap and unknown-field table; `pnpm test --coverage` | `src/core/schemas/reader.ts` |
| 2b-1 | redact, SSE parser, schema helpers, shared HTTP helper, contract suite | PR 2b-1 | `pnpm vitest run tests/unit/shared/redact.test.ts tests/unit/core/sse.test.ts tests/contract` | contract suite against the fake (`transport: false`) | `src/providers/{schemaCompat,http}.ts`, `src/shared/redact.ts`, `src/core/sse.ts` |
| 2b-2 | Anthropic adapter + recorded fixtures + record script | PR 2b-2 | `pnpm vitest run tests/contract/anthropic.contract.test.ts` | recorded SSE through fake fetch and fake clock | `src/providers/anthropic.ts`, fixtures |
| 2b-3 | OpenAI adapter + recorded fixtures | PR 2b-3 | `pnpm vitest run tests/contract/openai.contract.test.ts` | recorded SSE through fake fetch and fake clock | `src/providers/openai.ts`, fixtures |
| 2b-4 | createProvider, catalog data, E2E hooks, release hygiene build test | PR 2b-4 | `pnpm vitest run tests/unit/catalog.test.ts tests/build/release-hygiene.test.ts` | `pnpm build && pnpm build:e2e` then build tests | `src/providers/index.ts`, catalog data, `src/e2e/overrides.ts` |
| 3-1 | Dexie v1, DB guard, profile repo, branch delete cascade | PR 3-1 | `pnpm vitest run tests/integration/db.test.ts tests/integration/profileRepo.test.ts` | fake-indexeddb | `src/storage/db.ts` + repos (v1: revert only before release) |
| 3-2 | PDF repo, settings extension, secrets, isProfileComplete | PR 3-2 | `pnpm vitest run tests/integration/pdfRepo.test.ts tests/unit/core/profileComplete.test.ts` | fake-indexeddb with quota fault injection | `pdfs` repo, `secrets.ts`, settings additions |
| 3-3 | KeyService and key commands | PR 3-3 | `pnpm vitest run tests/integration/keyService.test.ts` | WXT fake-browser + fake provider | `src/background/services/key.ts` |
| 3-4 | Usage repo, budget gate, reservation/reconcile, provider gateway, model selection | PR 3-4 | `pnpm vitest run tests/integration/usage.test.ts tests/unit/core/budget.test.ts` | fake clock; killed-worker simulation | usage repo, `providerGateway.ts` |
| 3-5 | Onboarding service, port and claims review UI | PR 3-5 | `pnpm vitest run tests/integration/onboarding.test.ts tests/component/onboarding.test.tsx` | Testing Library + fake provider | onboarding service + options sections |
| 3-6 | Options UI: key, provider/model, profile editor, branch delete confirmation, PDFs | PR 3-6 | `pnpm vitest run tests/component/options` | Testing Library (jsdom) | `src/ui/components/options/**` |
| 3-7 | Backup export and reminder | PR 3-7 | `pnpm vitest run tests/integration/backupExport.test.ts tests/component/backupReminder.test.tsx` | fake-indexeddb round-trip prep | `src/storage/backup/export.ts`, reminder UI |
| 3-8 | Backup import with quiesce, journal, consent reset | PR 3-8 | `pnpm vitest run tests/integration/backupImport.test.ts` | failure injection mid-import; fake-browser storage | `src/storage/backup/{import,migrate}.ts`, `quiesce.ts` |
| 4-1 | Dexie v2, queue transitions, jobs repo | PR 4-1 | `pnpm vitest run tests/unit/core/queue tests/integration/jobsRepo.test.ts tests/integration/migrations.v2.test.ts` | fake-indexeddb | `jobs`/`analysisCache`/`logs` tables (v2: revert only before release) |
| 4-2 | QueueRunner, heartbeat, recovery, ensureAlarms queue-wake | PR 4-2 | `pnpm vitest run tests/integration/queueRunner.test.ts` | fake-browser restart and 3-step kill/resume | `queueRunner.ts`, `heartbeat.ts`, alarms |
| 4-3 | analysisCache, logs, AnalysisService, cancel, re-analyze | PR 4-3 | `pnpm vitest run tests/integration/analysisService.test.ts tests/integration/analysisCache.test.ts` | fake provider; fake-indexeddb | analysis service + cache repo |
| 4-4 | LinkedIn detail reader, tables, adapter, reader bundle, contract suite | PR 4-4 | `pnpm vitest run tests/contract/portalAdapter.linkedin.test.ts tests/build/readers.test.ts` | jsdom fixtures; `pnpm build` then reader-bundle grep | `src/portals/linkedin/**`, `reader-linkedin.ts` |
| 4-4a | LinkedIn adapter `idPattern`, `canonicalFor`, contract cases (A19) | PR 4-4a | `pnpm vitest run tests/contract/portalAdapter.linkedin.test.ts` | jsdom fixtures with foreign `href` cards | `idPattern`/`canonicalFor` in `src/portals/linkedin/adapter.ts`, contract additions |
| 4-5 | activeTab reader (strict result parse, A19), generic reader, analysis commands | PR 4-5 | `pnpm vitest run tests/integration/activeTabReader.test.ts tests/unit/portals/generic.test.ts` | fake-browser scripting | `activeTabReader.ts`, `src/portals/generic/**` |
| 4-5a | Generic URL from `tabs.get`, `previewId`, `confirmGeneric` payload, host class in the preview (A19, A20) | PR 4-5a | `pnpm vitest run tests/integration/genericPreview.test.ts` | fake-browser `tabs.get` and `storage.session`; reader returning a spoofed URL | `src/background/services/genericPreview.ts`, `analysis.confirmGeneric` payload |
| 4-6 | Review card, popup/side panel wiring, optional LinkedIn host | PR 4-6 | `pnpm vitest run tests/component/reviewCard.test.tsx tests/component/popup.test.tsx` | Testing Library; `tests/build/manifest.test.ts` | `src/ui/components/card/**`, popup/sidepanel entrypoints |
| 4-6a | Review-card chips: unverified figures, unverified source (A18, A20) | PR 4-6a | `pnpm vitest run tests/component/chips.test.tsx` | Testing Library with hostile strings | `src/ui/components/card/Chips.tsx` and its i18n keys |
| 4-7 | E2E manual analysis, network and persistence audits | PR 4-7 | `pnpm vitest run tests/integration/persistence-audit.test.ts` | `pnpm e2e` (e2e build, local fixture server, `route.fulfill` portal) | `tests/e2e/**` only |
| 4-8 | Page-content canary E2E, manual flow (A19) | PR 4-8 | `pnpm e2e -- canary-manual` | `pnpm e2e` with a canary offer fixture and request recorder | `tests/e2e/canary-manual.spec.ts` and fixtures only |
| 5-1 | Dexie v3, tracker schema and repo, Save upsert | PR 5-1 | `pnpm vitest run tests/integration/trackerRepo.test.ts tests/integration/migrations.v3.test.ts` | fake-indexeddb with quota fault | tracker tables (v3: revert only before release) |
| 5-2 | Tracker queries, pagination, notes, delete | PR 5-2 | `pnpm vitest run tests/integration/trackerQuery.test.ts` | 5,000-row seed | query module |
| 5-3 | Save-to-tracker action and tracker list UI | PR 5-3 | `pnpm vitest run tests/component/tracker` | Testing Library | `src/ui/components/tracker/**` |
| 5-4 | Popup summary, CSV codec, CSV/JSON export | PR 5-4 | `pnpm vitest run tests/unit/core/csv.test.ts tests/component/popupSummary.test.tsx` | node + jsdom | `csv.ts`, export module, popup summary |
| 5-5 | Backup extended to tracker, branch-name integration, E2E | PR 5-5 | `pnpm vitest run tests/integration/backupTracker.test.ts` | `pnpm e2e` save + export + backup round-trip + network audit | backup collections, E2E specs |
| 6-1 | Title/company filter (clean-room) | PR 6-1 | `pnpm vitest run tests/unit/core/filter.test.ts` | table tests | `filter.ts` |
| 6-2 | Dexie v4, beacon types, repos, normalizeSearchUrl | PR 6-2 | `pnpm vitest run tests/integration/beaconsRepo.test.ts tests/integration/migrations.v4.test.ts` | fake-indexeddb | beacon tables (v4: revert only before release) |
| 6-3 | Scan gate and wall ladder | PR 6-3 | `pnpm vitest run tests/unit/core/beaconGate.test.ts tests/unit/core/wallLadder.test.ts` | fake clock | `beaconPolicy.ts` gate part |
| 6-4 | Schedule math, caps, ToS version | PR 6-4 | `pnpm vitest run tests/unit/core/schedule.test.ts` | seeded RNG, fake clock | `beaconPolicy.ts` schedule part |
| 6-5 | LinkedIn search reader (ids only, A19) | PR 6-5 | `pnpm vitest run tests/contract/portalAdapter.linkedin.test.ts` | jsdom search fixtures | search reader and tables |
| 6-6 | ScanTabDriver and webRequest fail-closed | PR 6-6 | `pnpm vitest run tests/integration/scanTabDriver.test.ts` | fake-browser tabs and webRequest | `scanTabDriver.ts` |
| 6-6a | Scan driver navigates only rebuilt URLs (A19) | PR 6-6a | `pnpm vitest run tests/integration/scanTabDriver.rebuilt.test.ts` | fake-browser tabs; foreign-host items | `navigateDetail` in `scanTabDriver.ts` |
| 6-7 | Scan services and failed-offer flow | PR 6-7 | `pnpm vitest run tests/integration/scanService.test.ts` | fake-browser + fake provider + kill scenarios | scan services |
| 6-8 | Alarms, schedule enable/disable, notifications, badge | PR 6-8 | `pnpm vitest run tests/integration/beaconAlarms.test.ts` | WXT fake-browser alarms | `alarms.ts` additions, `notifications.ts`, `badge.ts` |
| 6-9 | Beacons UI and ToS screen | PR 6-9 | `pnpm vitest run tests/component/beacons tests/component/tosScreen.test.tsx` | Testing Library | `src/ui/components/beacons/**` |
| 6-10 | E2E simulated wall, network audit, backup of beacons/seen | PR 6-10 | `pnpm vitest run tests/integration/backupBeacons.test.ts` | `pnpm e2e` simulated 429 leads to backoff and pause | E2E specs, backup collections |
| 6-11 | Page-content canary E2E, scan flow (A19) | PR 6-11 | `pnpm e2e -- canary-scan` | `pnpm e2e` with a canary search fixture and request recorder | `tests/e2e/canary-scan.spec.ts` and fixtures only |
| 7-1 | InfoJobs adapter (beta) | PR 7-1 | `pnpm vitest run tests/contract/portalAdapter.infojobs.test.ts` | jsdom InfoJobs fixtures | `src/portals/infojobs/**` |
| 7-2 | Catalan content | PR 7-2 | `pnpm vitest run tests/unit/core/language.test.ts tests/unit/core/applyWarnings.test.ts` | table tests | `ca` table entries |
| 7-3 | CSV history import | PR 7-3 | `pnpm vitest run tests/unit/core/csvImport.test.ts tests/integration/historyImport.test.ts` | fake-indexeddb | `historyImport.ts`, mapping UI |
| 7-4 | Update check | PR 7-4 | `pnpm vitest run tests/integration/updateService.test.ts` | fake clock, fake fetch | `UpdateService`, alarm, settings |
| 7-5 | Release scripts: check-version, check-zip, check-docs | PR 7-5 | `pnpm vitest run tests/unit/scripts` | script fixtures | `scripts/check-*.ts` |
| 7-6 | Release workflow, release notes template, full docs, media | PR 7-6 | `pnpm vitest run tests/build/workflows.test.ts && pnpm check:docs` | `pnpm zip && pnpm zip:edge` locally; draft release dry run | `.github/workflows/release.yml`, docs |
| 7-7 | Parity run, Edge smoke, v1.0 cut, ADR export prep | PR 7-7 | `pnpm check:docs && pnpm vitest run tests/build` | owner parity run against the bot; manual Edge smoke | version bump + CHANGELOG |

### Dependencies and parallelism

Default topology is one writer in sequence. Items marked parallel-eligible could run in isolated worktrees, but only with explicit approval.

- Sequential spine: 0 -> 2a -> 2b -> 3 -> 4 -> 5 -> 6 -> 7. Slices inside a sub-change are ordered as numbered unless noted.
- Parallel-eligible: sub-change 1 (spikes) alongside 2a after 0 is complete. S1 and S2 must finish (and amend the design if they fail) before 2b-2/2b-3. S6 must finish before 3-2 (PDF caps) and before the 0.23 follow-up. S3, S5 and S7 must finish before 4-2/4-4/4-6. S3 InfoJobs items must finish before 7-1.
- Inside 6: 6-1, 6-3 and 6-4 are pure and parallel-eligible with 6-2. 6-5 needs the 4-4 reader base. 6-6 needs the S3 verdict.
- Inside 7: 7-2, 7-3 and 7-4 are independent of each other; 7-5 precedes 7-6; 7-7 is last.
- Inserted slices (A18-A21) and their execution order: 0f runs after 0e and before 2a (it only needs phase-0 infrastructure; it is parallel-eligible with sub-change 1). In 2a the order is 2a-1..2a-6, then 2a-7 (needs 2a-3 and 2a-5), 2a-8 (needs 2a-6; rewires `mapUrl` and the guard), 2a-9 (needs 2a-6 types). In 4 the order is 4-1..4-4, 4-4a (needs 4-4 and 2a-6), 4-5 (needs 2a-9), 4-5a (needs 4-5, 2a-8, 4-3), 4-6, 4-6a (needs 4-6, 2a-7, 2a-8), 4-7, 4-8 (needs 4-7). In 6 the order is 6-1..6-6, 6-6a (needs 6-6, 4-4a), 6-7..6-10, 6-11 (needs 6-10, 6-6a). Within a sub-change a letter-suffixed slice follows the slice it extends.
- Bottlenecks: 4-1/4-2 (queue) gate everything after 3; 6-7 consumes 6-2..6-6; the owner-run items (key generation 0.20, spikes, record-provider, parity run) block on the owner, not on code.

### Conventions for every task

- Strict TDD: each task lists the RED test first. The RED must be run and seen failing for the stated reason before the GREEN code is written, then REFACTOR with the test green. Commit per task, Conventional Commits, no AI attribution, tests and docs in the same commit as the behavior.
- Foundation bootstrap exception: tasks 0.1-0.3 create the runner and flip `strict_tdd`; their RED is the runner exiting non-zero for a missing assertion target (observed), not an earlier green suite.
- Layering: `src/core` stays pure (no `chrome`, `dexie`, DOM, `fetch`); ports are owned by core (ADR-01). Any import the boundary rules forbid fails `pnpm depcruise`.
- Test commands: `pnpm test` is `vitest run`. Config `testing.test_command` is `pnpm test` per the design (it resolves to `vitest run`); the runner is recorded in the new `testing.runner: vitest` key.
- No personal data, no copy from the private reference project; fixtures are synthetic. Task paths marked `(read-only)` are only read.
- Remote or live operations (real provider keys, live portal reads, GitHub settings) are owner-run and require explicit owner authorization of destination, operation and credential before they are executed.

### Type ownership (types the design leaves undefined; each is defined in the sub-change that first needs it)

| Type | Defined in | File | Notes |
|---|---|---|---|
| `Diagnostics`, `ValidatedOutput`, `AnalysisResult`, `AnalysisFailure` | 2a-1 task 2a.4 | `src/core/schemas/analysis.ts` | `Diagnostics = { droppedRequirements, droppedWalls: { ungrounded, weakEvidence, uncited }, removedClaimIds, unmatchedFit, ungroundedClaims: { count, samples, auditVersion } }` (A18; `ungroundedClaims` has `count: 0` and `samples: []` until 2a-7 fills it; from 2a.27 `derive` recomputes it on every result, review follow-up R3) |
| `RawSearchItem`, `SearchItem`, `HostClass`, `idPattern`/`canonicalFor` on `PortalAdapter` | 2a-6 task 2a.20 | `src/core/ports/portal.ts` | A19, A20; `classifyHost` itself lands in 2a-8 |
| Strict reader result schemas | 2a-9 task 2a.31 | `src/core/schemas/reader.ts` | A19; `parseSearchResult` takes the adapter `idPattern` as a parameter |
| `CvPdfMeta`, `TitleFilter`, `Branch`, `Claim`, `Profile` | 2a-2 task 2a.5 | `src/core/schemas/profile.ts` | `CvPdfMeta` = `CvPdf` minus `blob` (needed by `pickPdf`); `TitleFilter` is needed by `Branch`; 3 adds the stored `CvPdf` row with `blob`; 6-1 `filter.ts` imports `TitleFilter` |
| `RetryPolicy`, `GateReason`, `GateFailure`, `Job` and queue types | 4-1 task 4.2 | `src/core/queue/types.ts` | `GateFailure = { ok: false; reason: GateReason; deferUntil?: number; endRun: boolean }`; 6-3 `canRunPortalStep` returns `{ ok: true } \| GateFailure` and imports from here |
| `Beacon`, `BeaconRuntime`, `ScanState`, `ScanSettings`, `TosAcceptance` | 6-2 task 6.4 | `src/core/schemas/beacon.ts`, `src/core/schemas/settings.ts` | settings gain `tos` and `scan` here |
| `SavedCsvMapping` | 7-3 task 7.8 | `src/core/schemas/csvMapping.ts` | settings gain `csvMappings` here |
| `Settings` (base) | 0d task 0.21, extended additively by 3-2 (provider, models, keyStatus, dailyLimitUsd), 6-2 (tos, scan), 7-3 (csvMappings), 7-4 (updateCheck) | `src/storage/settings.ts` | `BackupPreferences` is defined by omitting the consent/runtime keys by name so later additions stay excluded |

### Ordering adjustments versus the Sub-change Map (no scope change)

- The core ports `src/core/ports/llm.ts` and the catalog type shell move to 2a-1 because `analyzeOffer` and the golden fixtures (2a exit criterion) need `LlmProvider`. 2b adds adapters, real catalog data and the contract suite.
- The test-only fake provider is written in 2a-5 and is later run through the 2b-1 contract suite with `transport: false`.
- A shared `src/providers/http.ts` (retry, timeout, cancel, redaction) is added in 2b-1 so the two adapters do not duplicate ADR-21 (judgment-day suspect B, accepted as a refactor of the same behavior).

---

## Phase 0: Sub-change 0 `foundation`

Exit: `pnpm test` green with strict TDD recorded; CI, CodeQL, Dependabot, policy checks, hook, boundaries, manifest build test, router sender policy, i18n parity and docs skeleton exist; Playwright loads the extension and the ID is stable.

### PR 0a - Runner, strict TDD flip, Biome base (~250 lines)

- [x] 0.1 Scaffold the toolchain (SHELL-7)
  - Files: `package.json`, `.npmrc`, `tsconfig.json`, `wxt.config.ts`, `vitest.config.ts`, `tests/setup/vitest.setup.ts`, `.gitignore`
  - Do: pnpm, exact WXT pin, strict TypeScript, Vitest with `WxtVitest()` and `fake-indexeddb/auto`, projects (node, jsdom, build, lint-fixtures), scripts `dev`, `build`, `typecheck` (`wxt prepare && tsc --noEmit`), `lint`, `format`, `test` = `vitest run`. `.gitignore` gains `.privacy-denylist.txt`, `.output/`, `.wxt/`, `coverage/`, `playwright-report/`, `test-results/`, `*.pem`, `.env*`. Other scripts from the File Changes list are added by the task that creates their target.
  - Proof of runner: `pnpm test` exits non-zero with "no test files" (observed), `pnpm typecheck` passes on the skeleton.
- [x] 0.2 RED: config assertion test (SHELL-7)
  - Files: `tests/build/config.test.ts`, `openspec/config.yaml` (read-only), `package.json` (read-only)
  - RED: asserts `strict_tdd: true`, `testing.status: active`, `testing.runner: vitest`, `testing.test_command: "pnpm test"`, `testing.layers` all true, `testing.coverage: true`, `linter: biome`, `type_checker: tsc`, `formatter: biome`, `rules.apply.test_command`, `rules.verify.test_command: "pnpm test && pnpm e2e"`, `rules.verify.build_command: "pnpm build"`, and `package.json` `scripts.test === "vitest run"`. Fails today (current config has `strict_tdd: false`, no `runner` key).
- [x] 0.3 GREEN: flip strict TDD in the OpenSpec config (SHELL-7)
  - Files: `openspec/config.yaml`
  - Do: set the values above; add the new `testing.runner: vitest` key; keep `tdd_intent: true`, set `rules.apply.tdd: true`.
  - Accept: `pnpm vitest run tests/build/config.test.ts` green.
- [x] 0.4 RED then GREEN: Biome base rules (SHELL-5, PRIV-4)
  - Files: `biome.json`, `tests/lint-fixtures/biome-base.test.ts`, `tests/lint-fixtures/biome/eval.positive.ts`, `tests/lint-fixtures/biome/innerhtml-react.positive.tsx`, `tests/lint-fixtures/biome/clean.negative.ts`
  - RED: the test spawns Biome on each fixture; `eval("1+1")` (`noGlobalEval`) and `dangerouslySetInnerHTML` (`noDangerouslySetInnerHtml`) must fail, the negative fixture must pass. Fixture directories are excluded from the normal `pnpm lint` run and checked only by the test.
  - Accept: the lint-fixture test is green and `pnpm lint` is green on the skeleton.

### PR 0b - Layer boundaries and source-ban plugins (~300 lines)

- [x] 0.5 Biome `src/core/**` globals override (ADR-01, ADR-23)
  - Files: `biome.json`, `tests/lint-fixtures/core-globals.test.ts`, `tests/lint-fixtures/core-globals/*.ts`
  - RED: for each of `chrome`, `browser`, `document`, `window`, `navigator`, `indexedDB`, `localStorage`, `fetch`, linting a fixture via `--stdin-file-path=src/core/x.ts` fails; the same code under `src/background/x.ts` passes.
  - Accept: test green.
- [x] 0.6 GritQL plugin: dynamic code and raw HTML sinks (SHELL-5, PRIV-4)
  - Files: `biome-plugins/no-new-function.grit`, `biome-plugins/no-html-sinks.grit`, `biome-plugins/README.md`, `tests/lint-fixtures/gritql-html.test.ts`, `tests/lint-fixtures/gritql/*.ts`
  - RED: positive fixtures for `new Function(...)`, `.innerHTML =`, `.outerHTML =`, `insertAdjacentHTML`, `document.write` fail; negative fixtures (for example reading `textContent`) pass.
  - Do: if the pinned Biome cannot express a pattern reliably, record that single pattern as a small TypeScript-AST check in `biome-plugins/README.md` and implement it as `scripts/check-ast-bans.ts` (decision recorded here; closes the design open question).
- [x] 0.7 GritQL plugin: `navigator.sendBeacon` ban (PRIV-2)
  - Files: `biome-plugins/no-send-beacon.grit`, `tests/lint-fixtures/gritql-beacon.test.ts`, `tests/lint-fixtures/gritql/sendbeacon.*.ts`
  - RED: positive fixture fails, negative passes.
- [x] 0.8 GritQL plugin: forbidden portal strings only in the guard (PORTAL-6)
  - Files: `biome-plugins/no-forbidden-portal-strings.grit`, `biome.json`, `tests/lint-fixtures/gritql-portal.test.ts`
  - RED: `/jobs-guest/`, `/job-apply/`, `runSearch` in any file fails; the same strings in `src/core/guard.ts` and `tests/unit/core/guard.test.ts` pass (path override declared now, files arrive in 2a).
- [x] 0.9 dependency-cruiser layer rules (ADR-01, Module Boundaries)
  - Files: `.dependency-cruiser.cjs`, `package.json`, `tests/lint-fixtures/depcruise.test.ts`, `tests/lint-fixtures/depcruise/**`
  - RED (one violating fixture tree per rule, each must fail): `src/core` importing `src/storage`, `src/providers`, `src/portals`, `chrome`, `dexie`, `react`, `wxt/*`; `src/providers` importing `src/portals` and the reverse; `src/ui` importing `src/providers`, `src/background`, `src/portals/*/readers`, `src/storage/**/*.worker.ts`, `src/storage/secrets`; `src/storage` importing `react`/`src/ui`; `src/shared` importing `dexie`/`src/storage`; anything importing `src/entrypoints`; relative-path bypass of a rule. A conforming fixture passes.
  - Accept: `pnpm depcruise` added and green on the skeleton.

### PR 0c - Repo policy, deps check, secretlint, hook (~400 lines)

- [x] 0.10 RED: Threat Matrix, documentation-like paths (PRIV-7, PRIV-8, PRIV-9, PORTAL-10) (cases 1-5; case 6, the secretlint email check, moves to 0.16 where secretlint exists)
  - Files: `tests/unit/repo-policy/docs-paths.test.ts`, `tests/unit/repo-policy/helpers.ts`
  - RED (6): a denylisted term in `docs/x.md` fails; in `tests/fixtures/portals/x.html` fails; in an extensionless file fails; a `.pdf` outside `tests/fixtures/binary/` fails; an allowlisted binary under `tests/fixtures/binary/` passes; a real-looking email in `docs/x.md` fails secretlint. Tests build throwaway git repos in a temp directory.
- [x] 0.11 RED: Threat Matrix, git repository selection
  - Files: `tests/unit/repo-policy/repo-selection.test.ts`
  - RED (4): running from `src/` scans the whole staged set; a linked worktree uses its own index; a missing denylist passes locally; a tracked or staged `.privacy-denylist.txt` fails.
- [x] 0.12 RED: Threat Matrix, commit state
  - Files: `tests/unit/repo-policy/commit-state.test.ts`
  - RED (5): a staged secret with a clean worktree fails; a clean staged blob with a dirty worktree passes; the `GIT_INDEX_FILE` override is honored; an empty index exits 0; renamed files are scanned.
- [x] 0.13 GREEN: repo policy check, all-files mode (PRIV-7, PRIV-8, PRIV-9)
  - Files: `scripts/check-repo-policy.ts`, `tests/fixtures/binary/ALLOWLIST`, `package.json`
  - Do: root from `git rev-parse --show-toplevel`; no path-based exemptions; text-vs-binary by NUL byte in the first 8 KB; plain local denylist and hashed `PRIVACY_DENYLIST_SHA256` mode (skipped with a notice on forks); fail when the denylist is tracked or staged; vendored-extension block (tracked path segment `extension`, any tracked `manifest.json` outside build output; the repository's own name is not a path segment); binary policy (`.pdf`, `.docx`, `.xlsx`, `.zip` only under `tests/fixtures/binary/` with an allowlisted hash). `pnpm check:repo-policy --all`.
  - Accept: tests 0.10 and 0.11 green.
- [x] 0.14 GREEN: repo policy check, staged mode (PRIV-9)
  - Files: `scripts/check-repo-policy.ts`
  - Do: `--staged` reads blobs from the index (`git diff --cached --name-only -z --diff-filter=ACMR` + `git show :<path>`), honors `GIT_INDEX_FILE`, exits 0 on an empty index, scans renames.
  - Accept: test 0.12 green.
- [x] 0.15 Telemetry dependency check (PRIV-2)
  - Files: `scripts/check-deps.ts`, `scripts/telemetry-denylist.json`, `tests/unit/check-deps.test.ts`, `tests/fixtures/check-deps/**`
  - RED: a fixture `package.json` and lockfile containing a denylisted analytics package (direct and transitive) fail; a clean one passes. GREEN: implement and add `pnpm check:deps`.
- [x] 0.16 secretlint rules (PRIV-8, PORTAL-10)
  - Files: `.secretlintrc.json`, `package.json`, `tests/unit/secretlint-rules.test.ts`
  - RED (synthetic samples only): provider key prefixes (`sk-ant-`, `sk-proj-`, `sk-` + 20 or more characters), emails outside reserved example domains, phones outside reserved test ranges, national-ID patterns are detected; reserved example values pass; output masks the match. GREEN: `preset-recommend` plus `@secretlint/secretlint-rule-pattern`; add `pnpm secretlint`.
- [x] 0.17 Pre-commit hook, PR template, clean-room attestation (PRIV-9, PRIV-10)
  - Files: `.lintstagedrc.json`, `package.json`, `.github/pull_request_template.md`, `tests/unit/hook-config.test.ts`
  - RED: `simple-git-hooks` `pre-commit` equals `pnpm lint-staged && pnpm check:repo-policy --staged`; lint-staged runs secretlint and Biome; the PR template contains the clean-room and no-personal-data checklist items and a filter-authorship line (PRIV-10).
  - Accept: test green; a real commit in a temp repo with a staged synthetic secret is blocked.

### PR 0d - Manifest, key, settings, router, alarms skeleton (~350 lines)

- [x] 0.18 RED: manifest build test including the optional-permission assertion (SHELL-1, SHELL-2, SHELL-3, SHELL-5; amendment A1)
  - Files: `tests/build/manifest.test.ts`, `tests/build/fixtures/manifest-*.json`
  - RED: on `.output/chrome-mv3/manifest.json` assert `permissions` is exactly `storage, alarms, scripting, activeTab, sidePanel`; `optional_permissions` is exactly `notifications, webRequest` (A1: any other optional permission fails, naming it; negative fixture manifests prove the failure message); optional host permissions are a subset of the portal, provider and release-check origins and equal the set allowed for the current sub-change (an `ORIGINS_BY_SUBCHANGE` table: 0 none, 3 providers, 4 + LinkedIn, 7 + InfoJobs and `api.github.com`); no `host_permissions`, no `<all_urls>`/`*://*/*`, no `content_scripts`, no `unlimitedStorage`, no `contextMenus`; CSP has no `unsafe-eval` or remote sources; `key` present and derived ID equals `docs/extension-id.txt`; `action.default_popup`, `side_panel.default_path`, `commands.analyze-page`, `minimum_chrome_version` 116; build output has no `__cvt_e2e_override__` and no `"fake"` provider id.
- [x] 0.19 GREEN: manifest generation and entrypoint stubs (SHELL-1, SHELL-3, SHELL-5)
  - Files: `wxt.config.ts`, `src/entrypoints/background.ts`, `src/entrypoints/popup/index.html`, `src/entrypoints/popup/main.tsx`, `src/entrypoints/sidepanel/index.html`, `src/entrypoints/sidepanel/main.tsx`, `src/entrypoints/options/index.html`, `src/entrypoints/options/main.tsx`, `public/_locales/en/messages.json`, `public/_locales/es/messages.json`
  - Do: Contract L required permissions only, React module, the build-time `E2E` define (false in production, true in `build:e2e`), `z.config({ jitless: true })` at startup; add `build:e2e` and `zip` scripts.
  - Accept: `pnpm build && pnpm vitest run tests/build/manifest.test.ts` green except the key and ID assertions (closed by 0.20).
- [x] 0.20 Extension key generation and stable ID (SHELL-2; S6 dependency)
  - Files: `scripts/gen-extension-key.ts`, `src/core/extensionId.ts`, `tests/unit/extension-id.test.ts`, `docs/extension-id.txt`, `wxt.config.ts`
  - RED: `deriveExtensionId(publicKeyDer)` returns the documented ID for a known synthetic key vector.
  - Do: the script generates an RSA-2048 pair once (owner-run, local); only the public key is committed as `manifest.key`; the private key is written outside the repository and is gitignored (`*.pem`). Owner action: run the script and commit the public key and the documented ID.
  - Accept: manifest test key and ID assertions green.
- [x] 0.21 Settings module skeleton (ADR-11, SHELL-8)
  - Files: `src/storage/settings.ts`, `src/core/schemas/settings.ts`, `tests/integration/settings.test.ts`
  - RED: defaults for `uiLanguage`, `outputLanguage` (= uiLanguage), `notificationsEnabled`; unknown stored keys are stripped; `onChanged` notifies; writes validate with Zod; later keys are added additively (provider/keyStatus in 3, tos/scan in 6, csvMappings/updateCheck in 7). Uses the WXT fake-browser.
- [x] 0.22 RED then GREEN: typed commands skeleton and sender policy (ADR-16, SHELL-4)
  - Files: `src/shared/messaging/commands.ts`, `src/shared/messaging/client.ts`, `src/background/router.ts`, `src/background/senderPolicy.ts`, `tests/integration/router.test.ts`
  - RED: a message with a foreign `sender.id` is rejected; a sender whose `sender.tab.url` is a web URL is rejected for every privileged command; a sender URL outside `popup.html`, `sidepanel.html`, `options.html` is rejected; an unknown command or malformed payload fails Zod validation; no `externally_connectable` exists. GREEN: discriminated-union `Command` (empty plus a `ping` used by the test), sender policy.
- [x] 0.23 RED then GREEN: background skeleton, `ensureAlarms`, storage access level (SHELL-4, ADR-03, ADR-11; S6 follow-up)
  - Files: `src/background/alarms.ts`, `src/entrypoints/background.ts`, `tests/integration/alarms.test.ts`
  - RED (fake-browser): after start there are no alarms by default; `ensureAlarms` is idempotent and reconciles on `storage.onChanged`; the worker calls `chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })` at every start.
  - Note: revisit after the S6 verdict (1.9); if `setAccessLevel` is unsupported at `minimum_chrome_version`, either raise the version or keep only the reader-bundle build test (4.10).

### PR 0e - i18n, Playwright, CI, docs skeleton (~300 lines)

- [x] 0.24 i18n infrastructure, EN + ES (SHELL-8, ADR-19)
  - Files: `src/ui/i18n/en.ts`, `src/ui/i18n/es.ts`, `src/ui/i18n/index.ts`, `tests/unit/i18n.test.ts`
  - RED: `es` typed as `Record<keyof typeof en, string>` (compile-time) plus a runtime key-parity test; default language from `chrome.i18n.getUILanguage()` (`es*` to `es`, `en*` to `en`, `ca` or other to `en`); a missing key falls back to English; a live language switch updates without reload (component test with a trivial consumer).
- [x] 0.25 Playwright extension loading and stable ID (SHELL-2)
  - Files: `playwright.config.ts`, `tests/e2e/fixtures/extension.ts`, `tests/e2e/install-id.spec.ts`, `package.json`
  - Do: `chromium.launchPersistentContext('', { channel: 'chromium', args: [--disable-extensions-except, --load-extension] })`; verify this loads the extension headless, otherwise run headed under `xvfb-run` and record which one CI uses. Add `pnpm e2e`.
  - RED: the spec loads the built extension from two different folders and expects the ID to equal `docs/extension-id.txt` both times.
- [x] 0.26 CI, CodeQL, Dependabot (SHELL-7; ADR-27)
  - Files: `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `.github/dependabot.yml`, `tests/build/workflows.test.ts`
  - RED: every `uses:` is pinned to a 40-hex commit SHA; no `pull_request_target`; `ci.yml` runs frozen install, typecheck, lint, depcruise, check:deps, check:repo-policy --all, secretlint, `pnpm audit --prod --audit-level high`, test with coverage, build, build tests, e2e, in that order, with `permissions: contents: read`; `codeql.yml` has `security-events: write` and a weekly schedule; Dependabot covers `npm` and `github-actions` weekly with minor and patch grouped.
- [x] 0.27 Public docs skeleton (SHELL-9, PRIV-6 skeleton, ADR-27)
  - Files: `LICENSE`, `README.md`, `PRIVACY.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `docs/architecture.md`, `tests/unit/docs-skeleton.test.ts`
  - RED: files exist; `LICENSE` is MIT; `SECURITY.md` names private vulnerability reporting through GitHub security advisories; `CHANGELOG.md` is Keep a Changelog; `docs/architecture.md` contains a Mermaid block; no process residue words ("Revision 2", "validator fix").
  - Do: `PRIVACY.md`/`README.md` carry headed placeholders for the PRIV-6 statements that 6 and 7 complete.
- [ ] 0.28 Branch protection and merge gates (SHELL-7) - owner action (documentation done in `CONTRIBUTING.md` under "Required status checks"; enabling branch protection on `main` remains an owner action)
  - Files: `CONTRIBUTING.md`
  - Do: document the required status checks (all CI steps, CodeQL) and ask the owner to enable branch protection on `main`. Record the confirmation in the PR description. No repository setting is changed by the agent.

### PR 0f - Manifest key allowlist, install-time script policy, egress lint (~240 lines; amendments A19, A21)

Follow-up foundation slice. It uses only phase-0 infrastructure (`manifest-rules.ts`, the Biome plugin setup from 0b, the existing repo files) and does not depend on sub-change 1 or 2a.

- [x] 0.29 RED: manifest top-level key allowlist (SHELL-1; amendment A21)
  - Files: `tests/build/manifest.test.ts`, `tests/build/manifest-rules.ts`, `tests/build/fixtures/manifest-extra-keys.json`
  - RED: `checkManifest` fails with `unexpected manifest key: <key>` for a fixture manifest that adds `web_accessible_resources` and `externally_connectable` (one failure per key, each named); further table-driven keys fail by name: `content_scripts`, `update_url`, `chrome_url_overrides`, `devtools_page`, `sandbox`, `declarative_net_request`, `oauth2`; a manifest containing only keys from the Contract L allowlist passes; `host_permissions` is allowed as a key only when absent or empty. Fails today because `manifest-rules.ts` has no key check.
- [x] 0.30 GREEN: top-level key allowlist in `manifest-rules.ts` (SHELL-1; amendment A21)
  - Files: `tests/build/manifest-rules.ts`, `tests/build/manifest.test.ts`
  - Do: add the exact allowlist from Contract L (`manifest_version`, `name`, `description`, `version`, `version_name`, `default_locale`, `key`, `minimum_chrome_version`, `icons`, `action`, `background`, `side_panel`, `options_ui`, `options_page`, `commands`, `permissions`, `optional_permissions`, `optional_host_permissions`, `host_permissions`, `content_security_policy`) with a comment that adding a key needs a rationale in the same PR; wire it into the real-build assertion.
  - Accept: 0.29 green; `pnpm build && pnpm vitest run tests/build/manifest.test.ts` green on the real output. If WXT emits a benign extra key, add it to the allowlist with its rationale in this PR (design open question closed here).
- [x] 0.31 RED: install-time script policy (SHELL-12; amendment A21)
  - Files: `tests/build/supply-chain.test.ts`
  - RED (pure `checkSupplyChain(files)` over in-memory objects, table-driven): an `allowBuilds` entry set to `true` or to any non-`false` value fails naming the package; `dangerouslyAllowAllBuilds` in `pnpm-workspace.yaml` fails; `dangerously-allow-all-builds` in `.npmrc` fails; a `pnpm` field with `onlyBuiltDependencies` or `neverBuiltDependencies` in `package.json` fails; each of `preinstall`, `install`, `postinstall`, `preprepare`, `postprepare`, `prepublish`, `prepack`, `postpack` in `scripts` fails naming the key; `prepare` other than exactly `simple-git-hooks` fails; a clean fixture passes. A final test reads the repository's own `pnpm-workspace.yaml`, `.npmrc` and `package.json` and expects pass.
- [x] 0.32 GREEN: `checkSupplyChain` and CI wiring (SHELL-12; amendment A21)
  - Files: `tests/build/supply-chain.test.ts`, `pnpm-workspace.yaml` (read-only), `.npmrc` (read-only), `package.json` (read-only)
  - Do: implement `checkSupplyChain` beside the test (same pure-function pattern as `checkManifest`; no build needed). `tests/build` already runs in CI after the build step (0.26), so no workflow change is needed.
  - Accept: 0.31 green against the repository files. If the repository files fail, fix the offending policy line in this PR and record it in the PR description.
- [x] 0.33 RED: restricted-egress lint fixtures (PRIV-11; ADR-14 item 7, ADR-23; amendment A19)
  - Files: `tests/lint-fixtures/gritql-egress.test.ts`, `tests/lint-fixtures/restricted-egress/*.ts`
  - RED (Biome with the plugin, fixtures linted under their stated paths via `--stdin-file-path`): global `fetch(...)`, `new XMLHttpRequest()`, `new WebSocket(...)`, `new EventSource(...)`, `window.open(...)`, `chrome.tabs.create(...)`, `chrome.tabs.update(...)` and `browser.tabs.create(...)` each fail under `src/ui/x.ts`; the same code passes under each of the five allowlisted paths (`src/background/services/providerGateway.ts`, `src/background/services/update.ts`, `src/background/scanTabDriver.ts`, `src/e2e/overrides.ts`, `src/ui/lib/openBlob.ts`); `deps.fetch(...)` in `src/providers/x.ts` passes; a property named `fetch` on a local object passes. Scope (review follow-up R3; ADR-14 item 7): the rule covers production source only, so global `fetch(...)` is not reported under `scripts/x.ts`, `scripts/record-provider.ts`, `tests/e2e/x.spec.ts`, `tests/support/x.ts`, `src/ui/x.test.ts` or `wxt.config.ts`, and is reported under `src/background/x.ts`.
- [x] 0.34 GREEN: `restricted-egress` GritQL plugin and allowlist override (PRIV-11; amendment A19)
  - Files: `biome-plugins/restricted-egress.grit`, `biome-plugins/README.md`, `biome.json`
  - Do: the plugin flags the listed patterns in production source only (`src/**` minus `src/**/*.test.ts` and `src/**/*.test.tsx`); the `biome.json` `overrides` entry disables it only for the five allowlisted paths (the paths need not exist yet; `src/ui/lib/openBlob.ts` arrives in 3.13). If the pinned Biome cannot scope a plugin by path, the scope is applied by the TypeScript-AST fallback below and recorded in `biome-plugins/README.md`. Same per-pattern fallback as the other plugins: a pattern the pinned Biome cannot express reliably is recorded in `biome-plugins/README.md` and implemented as a TypeScript-AST check in `scripts/check-ast-bans.ts` (created by 0.6 only if it was needed there; otherwise created here with its RED test).
  - Accept: 0.33 green; `pnpm lint` green on the existing tree.

---

## Phase 1: Sub-change 1 `spikes`

Each spike: write the hypothesis and pass/fail criteria in `docs/spikes/Sx.md` first (the RED), run the experiment on an unmerged branch (spike code never merges), then record the verdict and the fallback decision. Live runs (real provider keys, live portal pages, release endpoint) are owner-run and need explicit owner authorization of destination, operation and credential. A failed assumption requires a `design.md` amendment before the dependent sub-change starts.

### PR 1a - Provider spikes (~250 lines)

- [ ] 1.1 S1 hypothesis and criteria: Anthropic structured output with streaming from a `chrome-extension://` origin; is `anthropic-dangerous-direct-browser-access: true` required (ADR-05)
  - Files: `docs/spikes/S1.md`
  - Criteria written before running: structured output (`output_config.format` json_schema) streams; the header need is observed with and without it.
- [ ] 1.2 Run S1 and record the verdict
  - Files: `docs/spikes/S1.md`
  - Outcomes: pass; or non-streamed call with the heartbeat; or forced single-tool schema (needs an LLM-2 amendment to "declares no tools" before 2b).
- [ ] 1.3 S2: OpenAI Responses strict `json_schema` with `stream: true`
  - Files: `docs/spikes/S2.md`
  - Fallback if it fails: Chat Completions `response_format: json_schema, strict: true` with streaming.
- [ ] 1.4 Apply S1/S2 amendments (gate for 2b)
  - Files: `openspec/changes/extension-v1/design.md`, `openspec/changes/extension-v1/specs/llm-providers/spec.md`
  - Only edits what a failed assumption requires; if nothing failed, record "no amendment" in both spike docs.

### PR 1b - Portal, shell and runtime spikes (~300 lines)

- [ ] 1.5 S3 a/b/d: reading and classification fixtures
  - Files: `docs/spikes/S3.md`, `tests/fixtures/portals/linkedin/.gitkeep`
  - Verdict: full description after `complete` + marker wait; session and wall markers detectable; InfoJobs URL shapes, subdomains and challenge markers confirmed. Fixtures are synthetic reconstructions, never copied pages or personal data.
- [ ] 1.6 S3 c: `webRequest` main-frame status, including under Playwright `route.fulfill`
  - Files: `docs/spikes/S3.md`
  - Fallback decision recorded: `--host-resolver-rules` with a local TLS fixture server, or URL/DOM-only classification failing closed (task 6.14) with `webRequest` removed from optional permissions.
- [ ] 1.7 S3 e/f/g: InfoJobs default pace, scan-tab discard and throttling, portal subdomains
  - Files: `docs/spikes/S3.md`
  - Outcomes drive: InfoJobs Scan-now only (ADR-09 c); raised scan-tab readiness deadline (ADR-09 e); host patterns (Contract E hosts).
- [ ] 1.8 S5: popup click handler can run `sidePanel.open` and `permissions.request`; popup open grants `activeTab`; side panel on Edge
  - Files: `docs/spikes/S5.md`
- [ ] 1.9 S6: stable key ID on Chrome and Edge; default quota holds PDFs; `setAccessLevel` support at the minimum Chrome version
  - Files: `docs/spikes/S6.md`
  - Outcome gates PDF caps (3.4) and the 0.23 follow-up.
- [ ] 1.10 S7: heartbeat keeps the worker alive for a 240 s streamed call; lease queue resumes after a forced stop
  - Files: `docs/spikes/S7.md`
  - Fallback: offscreen-document `llm` lane executor (same contract).
- [ ] 1.11 S4 recorded as N/A (folder sync out of v1, Q5 default)
  - Files: `docs/spikes/S4.md`
- [ ] 1.12 Apply S3/S5/S6/S7 amendments (gate for 3, 4, 6, 7)
  - Files: `openspec/changes/extension-v1/design.md`
  - Edit only ADR-09/10/11/03 and Contract E/L parts a failed assumption requires; otherwise record "no amendment".

---

## Phase 2a: Sub-change 2a `engine-core`

Exit: golden synthetic fixtures pass with the fake provider; `src/core` coverage at or above 90% lines.

### PR 2a-1 - Ports, cost, text, schemas (~360 lines)

- [x] 2a.1 Core ports and catalog types (ADR-01, Contract A)
  - Files: `src/core/ports/runtime.ts`, `src/core/pricing/catalog.ts`, `src/core/ports/llm.ts`, `tests/unit/core/ports.test.ts`
  - RED: `ProviderError` carries `cls`, `retryAfterMs`, `afterFirstChunk`; the error class list is exactly the ten in ADR-21; `REAL_PROVIDER_IDS` is derived from the catalog; `llm.ts` re-exports `ProviderId` and `ModelEntry` from the catalog and the catalog imports nothing from `llm.ts`. Catalog entries are synthetic test data here; real entries land in 2b-4.
- [x] 2a.2 Cost math (LLM-8)
  - Files: `src/core/cost.ts`, `tests/unit/core/cost.test.ts`
  - RED: the $0.02 scenario from the spec; cached-input pricing; `estimated` propagation; `estimateTokens(chars) = ceil(chars/4)`.
- [x] 2a.3 Text normalization and folding (ANALYSIS-3; A2, A3, A16)
  - Files: `src/core/text.ts`, `tests/unit/core/text.test.ts`
  - RED: `normalizeOfferText` (NFC, zero-width and invisible format characters removed, whitespace collapsed, trimmed, no cap); `fold` maps typographic quotes, apostrophes and dashes to ASCII and lowercases; `words`; `capHeadTail(fullText, 11_000)` keeps the first 8,000 characters and the tail that fills the rest minus the `" […] "` marker, both cut at whitespace, `truncated: true`; text at or under the cap is untouched.
- [x] 2a.4 Analysis schemas (ANALYSIS-1, ANALYSIS-10, ANALYSIS-11; A18; defines `Diagnostics`)
  - Files: `src/core/schemas/analysis.ts`, `tests/unit/core/schemas/analysis.test.ts`
  - RED: `OfferAnalysisOutput` is strict and requires every field including `walls[].basis` and `walls[].ref`; extra keys fail; `AnalysisResult` serialization round-trips with every ANALYSIS-10 field; `AnalysisFailure` has no verdict; `Diagnostics` is always present on success and includes `ungroundedClaims: { count, samples, auditVersion }` (A18: `samples` at most 5 entries of at most 40 characters; a longer sample or a sixth entry fails parsing; `auditVersion` is a required non-empty string, and an empty or missing one fails parsing; an audit-free result has `count: 0` and `samples: []`; the `AUDIT_VERSION` constant itself is defined by 2a.26).

### PR 2a-2 - Profile schema, profileVersion, prompt, cache key (~390 lines)

- [x] 2a.5 Profile schemas, `profileVersion`, `dealbreakerRefs` (PROFILE-8; A4; defines `CvPdfMeta`, `TitleFilter`)
  - Files: `src/core/schemas/profile.ts`, `src/core/analysis/profileVersion.ts`, `tests/unit/core/profileVersion.test.ts`
  - RED: deterministic for identical content; changes on claim statement, tags, set membership, branch name, rules, dealbreakers and output language; does not change on PDF changes, titleFilter or blocklist; independent of insertion order; `dealbreakerRefs` yields `<branchId>/d<index>` stable per version; claim and branch id patterns `c-<n>`, `b-<n>`.
- [x] 2a.6 Prompt builder and output schema (ANALYSIS-2, ANALYSIS-3, ANALYSIS-10, ANALYSIS-11; ADR-14, ADR-29; A18)
  - Files: `src/core/analysis/prompt.ts`, `src/core/analysis/outputSchema.ts`, `tests/unit/core/analysis/prompt.test.ts`
  - RED: the prefix is byte-identical across offers for the same `(snapshot, outputLanguage, PROMPT_VERSION)`; claims and branches are sorted by id; every case-insensitive `</offer_data` in the offer text and in `source`/`title`/`company` is rewritten and the closing delimiter appears exactly once; attributes are escaped; a snapshot test maps the template hash to `PROMPT_VERSION` so a template or output-schema change without a bump fails; Spanish output-language instruction present when `outputLanguage` is `es`; the rubric (prefix block 0) contains the A18 sentence that figures in the rationale must come from the offer or the listed claims (asserted by a substring test on the built prefix). `PROMPT_VERSION` stays `analysis-2` because 2a-2 has not merged; if it merges before this edit lands, the sentence bumps the version and the snapshot test records it.
- [x] 2a.7 Cache key (ANALYSIS-9; interpretation (a))
  - Files: `src/core/analysis/cacheKey.ts`, `tests/unit/core/analysis/cacheKey.test.ts`
  - RED: `sha256(requestText \0 qualifiedModelId \0 promptVersion \0 profileVersion)`; each component change changes the key; the qualified id is `<provider>/<model>`.

### PR 2a-3 - Post-validation chain (~400 lines)

- [x] 2a.8 RED: steps 1-3 (shape, score, placeholders) with the placeholder check order (ANALYSIS-4 rules 1 and 4)
  - Files: `tests/unit/core/analysis/postValidate.shape.test.ts`
  - RED: schema failure is `invalid_output`; score non-integer, below 0, above 100 is `invalid_output` and is not clamped. Placeholder order is fixed: shape (1), score (2), placeholders (3) run before grounding (4), so a placeholder in a requirement that would later be dropped as ungrounded still yields `invalid_output`; with both a bad score and a placeholder the reported cause is the score (earlier step). Placeholders after trim, case-insensitive: whole-string `tbd`, `todo`, `n/a`, `...`, the ellipsis character, `<word>` templates, the type words `string`, `number`, `integer`, `boolean`, `array`, `object`, `null`; substring `lorem ipsum`, `{{...}}`; an empty string after trim; checked fields are exactly `rationale`, every `requirements[].text` and every `walls[].text`; "string theory" (a longer legitimate phrase) is not whole-string `string`.
- [x] 2a.9 RED: steps 4-8 (grounding, nothing strong, claim ids, walls, branch) (ANALYSIS-4 rules 2, 3, 5; A3, A10)
  - Files: `tests/unit/core/analysis/postValidate.rows.test.ts`
  - RED, one test per row plus each spec scenario: ungrounded requirement dropped with `droppedRequirements++`; grounding is typographic-quote and dash tolerant; zero requirements left, or none with strong evidence (2 words and 12 folded characters), is `invalid_output`; unknown claim ids removed with `removedClaimIds++`; an entry left with no ids is kept `unmatched: true`; a wall with evidence "on site" is dropped as `weak_evidence`; a wall citing an unknown dealbreaker ref is dropped as `uncited`; an `unmet_must_have` wall whose ref does not fold-equal a kept must-have requirement with no matching claim is dropped; ungrounded wall evidence dropped as `ungrounded`; unknown `branch_id` becomes `null`, `''` becomes `null`.
- [x] 2a.10 GREEN: `postValidate`
  - Files: `src/core/analysis/postValidate.ts`
  - Do: implement the ordered chain returning `ValidatedOutput` with diagnostics; pure, no clamping, no retries.
  - Accept: 2a.8 and 2a.9 green.

### PR 2a-4 - Verdict, injection signals, language, warnings, PDF (~370 lines)

- [x] 2a.11 Verdict (ANALYSIS-5; A12, A18)
  - Files: `src/core/analysis/verdict.ts`, `tests/unit/core/verdict.test.ts`
  - RED table: 85, 70, 69, 40, 39; any accepted wall gives `skip` with reason `wall`; `apply` with injection suspected gives `review` with `injection_downgrade`; signals never upgrade and never add walls. A18 rows: input gains `ungroundedClaims: number`; score 85 with `ungroundedClaims: 2` gives `review` with `grounding_downgrade`; score 85 with both injection suspected and `ungroundedClaims: 2` gives `review` with `injection_downgrade` (injection takes precedence as the recorded reason); `ungroundedClaims > 0` never changes a `review` or `skip` (scores 69, 40, 39 and a wall case keep their verdict and reason) and never creates a wall; `VerdictReason` is exactly `wall | score | injection_downgrade | grounding_downgrade`. ANALYSIS-5 (review follow-up R3): the input type is exactly `{ score, acceptedWalls, injectionSuspected, ungroundedClaims }` (a type-level test asserts that passing a `rationale` field does not compile), so the verdict depends on the audit count only, never on rationale text.
- [x] 2a.12 Injection signals (ADR-14; A12)
  - Files: `src/core/injectionSignals.ts`, `tests/unit/core/injectionSignals.test.ts`
  - RED: EN and ES phrase table positives ("ignore previous instructions", "you are now", "output score ..."), benign negatives, matches are short excerpts; computed over the full normalized text. Catalan entries wait for 7-2.
- [x] 2a.13 Language inference (ANALYSIS-6, PROFILE-5; A16)
  - Files: `src/core/languages.ts`, `src/core/language.ts`, `tests/unit/core/language.test.ts`
  - RED: synthetic 40-word `es` and `en` texts; short text (< 20 tokens) is `unknown`; company-name interference case; a registered synthetic fourth language works through the table parameter; thresholds `LANG_MIN_SCORE` 3 and `LANG_LEAD_RATIO` 1.5; operates on `fullText`. Table authored fresh.
- [x] 2a.14 Apply warnings (ANALYSIS-7; A16)
  - Files: `src/core/applyWarnings.ts`, `tests/unit/core/applyWarnings.test.ts`
  - RED: every ANALYSIS-7 scenario in EN and ES; negatives (a bare footer address has no directive cue); one warning per category with excerpt at most 160 characters; a cover-letter request in the tail of a 30,000-character text is found. Catalan entries wait for 7-2.
- [x] 2a.15 PDF pick (ANALYSIS-8)
  - Files: `src/core/analysis/pickPdf.ts`, `tests/unit/core/analysis/pickPdf.test.ts`
  - RED: branch null gives `no_branch`; language unknown gives `language_unknown`; no exact pair gives `no_pdf_for_language` with that branch's PDFs as alternatives; never substitutes another language.

### PR 2a-5 - derive, analyzeOffer, fake provider, golden fixtures (~400 lines)

- [x] 2a.16 Test-only fake provider (ADR-28)
  - Files: `tests/support/fakeProvider.ts`, `tests/unit/support/fakeProvider.test.ts`
  - RED: implements `LlmProvider` with a plain-string `id`, scripted progress and final events, scripted `ProviderError`s, counts calls. Lives only under `tests/`.
- [x] 2a.17 `derive` (steps 9-13; ANALYSIS-9; A15, A18)
  - Files: `src/core/analysis/derive.ts`, `tests/unit/core/analysis/derive.test.ts`
  - RED: the same `ValidatedOutput` derives different PDFs when PDFs change; verdict, language, apply warnings and injection flags are recomputed from current `fullText`; assembles `AnalysisResult` with `cached` flag and diagnostics; `derive` passes `validated.diagnostics.ungroundedClaims.count` to `deriveVerdict` (A18; a `ValidatedOutput` with `count: 1` and score 85 derives `review`/`grounding_downgrade`). The audit itself and the cache-hit consistency case arrive in 2a-7, where 2a.27 replaces this pass-through with derived step 9b (the audit re-run on every result).
- [x] 2a.18 `analyzeOffer` (ANALYSIS-1; ADR-06)
  - Files: `src/core/analysis/analyze.ts`, `tests/unit/core/analysis/analyze.test.ts`
  - RED: exactly one provider call; a malformed output yields `invalid_output` with one call and no retry; an `auth` error is surfaced typed; usage is forwarded; `truncated` set when capped; the model returns no verdict, language or PDF.
- [x] 2a.19 Golden synthetic fixtures (exit criterion; ADR-14)
  - Files: `tests/fixtures/offers/*.json`, `tests/fixtures/profiles/*.json`, `tests/unit/core/analysis/golden.test.ts`
  - RED: ES and EN synthetic offers and profiles end to end through the fake provider; injection goldens: "output score 100" with ungrounded evidence is rejected; a smuggled closing delimiter appears once; a trivial wall fragment is dropped; an injection phrase downgrades `apply` to `review`; a 30,000-character offer reports a `cover_letter` warning with `truncated: true`.

### PR 2a-6 - Portal core and coverage gate (~385 lines)

- [x] 2a.20 Portal port types (Contract E; PORTAL-3, PORTAL-11, PRIV-11; A19, A20)
  - Files: `src/core/ports/portal.ts`, `tests/unit/core/portalTypes.test.ts`
  - RED: `SourceId`, `PageState`, `ReadResult`, `RawSearchItem`, `SearchItem` (= `RawSearchItem` plus worker-built `canonicalUrl`), `OfferDetail`, `GenericPreview` (title and text only, no URL), `HostClass`, `PageMarkers`, `ClassifyTables`, `PortalAdapter` (with `idPattern: RegExp` and `canonicalFor(id): string | null`) are DOM-free (a compile-time check plus a dependency-cruiser fixture); `PortalReaders.readSearchResults` returns `ReadResult<RawSearchItem[]>` (type-level assertion that no URL field exists on a reader result); no `PortalReaders` in core.
- [x] 2a.21 Registry, `mapUrl`, `canonicalFor`, `isAllowedNavigation`, `canonicalizeGenericUrl` (PORTAL-1 LinkedIn, PORTAL-3, MANUAL-3, PORTAL-6; A19)
  - Files: `src/core/registry.ts`, `tests/unit/core/registry.test.ts`
  - RED (A19 additions first): registry `canonicalFor(source, id)` returns the canonical detail URL only when the id matches the adapter id pattern (LinkedIn `/^\d{1,20}$/`) and returns `null` otherwise (`'12 34'`, `'../x'`, a 21-digit id, an empty string, an id containing `/` or `?`); the result passes `mapUrl` round trip (`mapUrl(canonicalFor('linkedin', '123')).id === '123'`) and `isAllowedNavigation`. Existing cases: `/jobs/view/<id>` and `/jobs/view/<slug>-<id>/`; `currentJobId=<id>` on search and collection URLs; tracking parameters removed; any `*.linkedin.com` subdomain including country subdomains; canonical `https://www.linkedin.com/jobs/view/<id>/`; idempotent; unsupported URLs return null; generic canonicalization lowercases host, drops fragment, drops default port, removes `utm_*`, and two URLs differing only by fragment collapse. Host table is the single source for `hostPermissions`.
- [x] 2a.22 Navigation guard (PORTAL-6)
  - Files: `src/core/guard.ts`, `tests/unit/core/guard.test.ts`
  - RED: only https on registry hosts; rejects `/jobs-guest/`, `/job-apply/`, `runSearch` case-insensitively in path or query. These strings exist only in this file and its test (the 0.8 plugin passes).
- [x] 2a.23 `classify` precedence (PORTAL-5; A13)
  - Files: `src/core/classify.ts`, `tests/unit/core/classify.test.ts`
  - RED table: rate-limit status wins over a login marker; login before authwall before checkpoint; no content root gives `unreadable_shell`; otherwise `ok`; `unreadable_shell` is not a wall.
- [x] 2a.24 Enable the coverage threshold
  - Files: `vitest.config.ts`
  - Accept: `pnpm test --coverage` enforces 90% lines for `src/core` and passes.

### PR 2a-7 - Rationale audit, step 8b (~260 lines; amendment A18)

- [x] 2a.25 RED: rationale audit table (ANALYSIS-11; ADR-29, Contract C step 8b)
  - Files: `tests/unit/core/analysis/rationaleAudit.test.ts`
  - RED, one test per row: durations (`5 years`, `3 años`, `18 months`, `2 semanas`, `10 days`) grounded when the number appears in the corpus and ungrounded otherwise; percentages (`40%`); money (`$120k`, `€50.000`, `USD 90000`, `£40k`) with `k` expansion and thousands-separator and decimal-comma normalization on both sides; calendar years 1950-2099 (`2019` grounded by the offer text, `1949` and `2100` not extracted); corpus number words one to twenty in EN and ES (`five years` in the offer grounds `5 years`; `cinco años` grounds `5 años`); corpus is exactly `fold(requestText)` plus the folded claim statements and tags, branch names, rules and dealbreakers (a number that appears only in an unrelated field such as a claim id, or only in the model's own output, is ungrounded); exclusions: the integer equal to `score` and digits inside `c-<n>`, `b-<n>`, `b-<n>/d<n>` are never extracted; bare counts (`2 of 3 requirements`) are not assertions; `count` equals the number of ungrounded assertions; `samples` hold at most 5 literal rationale spans of at most 40 characters each; a rationale with no assertions yields `{ count: 0, samples: [], auditVersion: AUDIT_VERSION }`; pure and deterministic. Numeric parsing (review follow-up R3; `parseNumber`, Contract C "Step 8b numeric parsing"), one row per token, applied identically to rationale and corpus: `€50.000` -> 50000; `50,000` -> 50000; `1.5 years` -> 1.5; `1,5 años` -> 1.5; `2.025` -> 2025 (decided ambiguity: thousands, and not a calendar year); `1.500 €` -> 1500; `0.250` -> 0.25; `1234.567` -> 1234.567; `50.00` -> 50 (equal to `50`); `1.234.567` -> 1234567; `1.234,56` -> 1234.56; `1,234.56` -> 1234.56; `2,5k` -> 2500; `$120k` -> 120000; `1.2.3` and `1,23.4` unparseable (not an assertion, not counted, not added to the corpus); `5 years.` -> 5 (final dot is punctuation); cross-format grounding: `€50.000` in the offer grounds `50,000 EUR` in the rationale; values compare as exact decimal strings, not floats. Versioning: a snapshot test maps a hash of the unit-word tables, number-word tables and parsing/extraction constants to `AUDIT_VERSION` (`'audit-1'`), so changing any table entry without bumping the version fails.
- [x] 2a.26 GREEN: `auditRationale` (ANALYSIS-11; ADR-29)
  - Files: `src/core/analysis/rationaleAudit.ts`
  - Do: implement `auditRationale(rationale, corpus, { score, ids })`, `parseNumber(token)` (the single parsing rule for both sides), the exported `AUDIT_VERSION = 'audit-1'`, and a `buildCorpus(requestText, snapshot)` helper limited to cache-key inputs; the result carries `auditVersion: AUDIT_VERSION`; no dependency outside `src/core`. Catalan unit words and number words are added in 7.4, not here.
  - Accept: 2a.25 green.
- [x] 2a.27 Wire step 8b into `postValidate` and prove cache-hit consistency (ANALYSIS-11, ANALYSIS-5, ANALYSIS-9; ADR-29; A15, A18)
  - Files: `src/core/analysis/postValidate.ts`, `src/core/analysis/derive.ts`, `tests/unit/core/analysis/postValidate.audit.test.ts`, `tests/unit/core/analysis/derive.audit.test.ts`
  - RED: after steps 1-8, step 8b stores the result in `diagnostics.ungroundedClaims`; an ungrounded figure never yields `invalid_output`, never changes `score`, `fit` (no entry becomes `unmatched`), `walls` or `branch_id` (assert the output equals the same input without the figure); the audit sits after the branch step, so a placeholder or ungrounded-evidence failure still reports its earlier cause. Through `derive` (derived step 9b, review follow-up R3: `derive` re-runs `auditRationale` on every result, fresh or cached, and the recomputed value replaces the stored `diagnostics.ungroundedClaims`): a score-85 output with an ungrounded duration derives `review`/`grounding_downgrade`; the same `ValidatedOutput` served again as a cache hit with a changed PDF set derives the same downgrade and the same `ungroundedClaims`; a cached `ValidatedOutput` whose stored `ungroundedClaims` was tampered to `{ count: 0, samples: [], auditVersion: 'audit-1' }` still derives `review`/`grounding_downgrade` (the stored value is never trusted); with audit tables injected through a test parameter that add a unit word (simulating 7.4), a cached rationale figure that was not extracted before is now extracted and the result records the injected `auditVersion`, with no provider call and `cached: true`; `AUDIT_VERSION` is not a cache-key component (the 2a.7 key is unchanged); with injection signals present the recorded reason is `injection_downgrade`; a grounded figure keeps `apply`. Golden check: extend one fixture from 2a.19 with a stray `10 years` figure and assert `review`.
  - Accept: 2a.25 to 2a.27 green; `pnpm test --coverage` still at or above 90% for `src/core`.

### PR 2a-8 - Source-host classification (~220 lines; amendment A20)

- [ ] 2a.28 RED: `classifyHost` vectors (PORTAL-11; Contract E; A20)
  - Files: `tests/unit/core/classifyHost.test.ts`
  - RED, table-driven; none of the negatives may yield `kind: 'portal'`: `https://linkedin.com@evil.example/jobs/view/1/` (`userinfo`), `https://linkedin.com.evil.com/` (`unknown_host`), `https://evil-linkedin.com/` (`unknown_host`), `https://www.linkedin.com./jobs/view/1/` (`trailing_dot`), a punycode host `https://xn--lnkedin-xyz.com/` and a Unicode look-alike (`punycode`), `http://www.linkedin.com/jobs/view/1/` (`not_https`), `https://www.linkedin.com:8443/jobs/view/1/` (`port`), `javascript:alert(1)` and `data:text/html,x` (`not_https`), an unparseable string (`unparseable`). Positives: `https://linkedin.com/`, `https://www.linkedin.com/`, a country subdomain (`https://es.linkedin.com/`), `https://www.infojobs.net/` classify as `portal` with the right `source`; a host from `KNOWN_ATS_APEXES` and a subdomain of it classify as `known_ats`; an unlisted host is `unverified/unknown_host`; the default `:443` is accepted (WHATWG drops it).
- [ ] 2a.29 GREEN: `classifyHost` and `KNOWN_ATS_APEXES` (PORTAL-11; A20)
  - Files: `src/core/registry.ts`
  - Do: WHATWG parse, https only, empty userinfo and port, no trailing dot, no `xn--` label, then `hostname === apex || hostname.endsWith('.' + apex)` over the portal apex table, then `KNOWN_ATS_APEXES` (a short, freshly authored, data-only list). No other module compares hostnames after 2a.30.
  - Accept: 2a.28 green.
- [ ] 2a.30 RED then GREEN: `mapUrl`, the guard and the generic flow delegate to `classifyHost` (PORTAL-11, PORTAL-6; A20)
  - Files: `src/core/registry.ts`, `src/core/guard.ts`, `tests/unit/core/registry.test.ts`, `tests/unit/core/guard.test.ts`
  - RED: `mapUrl` returns `null` and `isAllowedNavigation` returns `false` for every negative vector from 2a.28 even when the path looks like a LinkedIn offer; the guard still rejects `/jobs-guest/`, `/job-apply/` and `runSearch` on a valid portal host; a `known_ats` or `unverified` URL is never allowed for navigation or reading; an `unverified` result still allows the generic preview (informational only: no throw, no block).
  - Do: replace any hostname comparison in 2a.21 and 2a.22 with `classifyHost(url).kind === 'portal'`; a grep-based unit test asserts `registry.ts` is the only `src/core` file that reads `.hostname`.
  - Accept: 2a.28 to 2a.30 green; the 0.8 forbidden-strings plugin still passes.

### PR 2a-9 - Strict reader result schemas (~150 lines; amendment A19)

- [ ] 2a.31 RED: reader result schemas and caps (PRIV-11, PORTAL-3, PORTAL-4; ADR-14 item 7, Contract E; A19)
  - Files: `tests/unit/core/schemas/reader.test.ts`
  - RED, table-driven: `PageMarkers` accepts only five booleans (a string or extra key fails); a search result with an unknown field at any level fails as a whole; caps: `id` 64 characters, `title` 300, `company` 200, `location` 200, detail `text` 50,000 (one character over fails), at most 100 search items, at most 10 `attempted` strategy names of at most 40 characters each, strategy name 41 characters fails; `parseSearchResult(raw, idPattern)` drops an item whose id fails the pattern but keeps the others, returns `unreadable` when zero valid items remain and `noResults` is false, and returns `[]` only when `noResults` is true; a result that parses with a URL-like `href` field fails (strict); a failure message and the logged detail contain only the count and field name, never page text.
- [ ] 2a.32 GREEN: `src/core/schemas/reader.ts` (PRIV-11; A19)
  - Files: `src/core/schemas/reader.ts`
  - Do: `.strict()` Zod schemas for markers, search result, detail result and generic preview (title and text only), plus `parseSearchResult`, `parseDetailResult`, `parseMarkers`; a parse failure maps to `ReadResult` `unreadable`. Zod runs with `jitless` (already configured at startup).
  - Accept: 2a.31 green; `src/core` coverage at or above 90%.

---

## Phase 2b: Sub-change 2b `providers`

Prerequisite: S1 and S2 verdicts merged (1.4). Exit: the shared provider contract suite passes on recorded fixtures for both adapters and the fake.

### PR 2b-1 - Shared provider infrastructure (~380 lines)

- [ ] 2b.1 Redactor (PRIV-3)
  - Files: `src/shared/redact.ts`, `tests/unit/shared/redact.test.ts`
  - RED: masks key values, `x-api-key` and `authorization` header values and provider-key patterns in strings and nested error messages.
- [ ] 2b.2 SSE parser
  - Files: `src/core/sse.ts`, `tests/unit/core/sse.test.ts`
  - RED: events split across chunk boundaries, multi-line `data:`, comments, CRLF, `[DONE]`.
- [ ] 2b.3 Schema helpers (LLM-2, LLM-3)
  - Files: `src/providers/schemaCompat.ts`, `tests/unit/providers/schemaCompat.test.ts`
  - RED: `assertSchemaCompatible` rejects `minLength`, `maximum` and recursive `$ref`; `toStrictSchema` makes every property required and sets `additionalProperties: false`.
- [ ] 2b.4 Shared HTTP helper (ADR-21; LLM-4, LLM-5)
  - Files: `src/providers/http.ts`, `tests/unit/providers/http.test.ts`
  - RED (fake clock): retries only `transient` and `rate_limit`, at most 2, only before the first chunk; delay `max(RetryAfter, 2 s * 2^(n-1))`; a wait above 20 s stops retrying and throws `rate_limit` with `retryAfterMs`; `auth` never retried; 60 s inactivity timer reset per chunk and 240 s total yield `timeout`; abort yields `cancelled`; a 503 makes 3 requests, a 401 makes 1, `Retry-After: 7` waits at least 7 s; no retry after the first chunk.
- [ ] 2b.5 Shared contract suite (LLM-1)
  - Files: `tests/contract/llmProvider.contract.ts`, `tests/contract/fake.contract.test.ts`
  - Do: `describeLlmProviderContract(factory, fixtures, { transport })` asserting event order (progress then one final), the final event carries `json`, `usage` and `model` (a missing field fails naming it), timeout and cancel behavior; HTTP-only assertions guarded by `transport: true`. Run now against the fake with `transport: false`.

### PR 2b-2 - Anthropic adapter (~400 lines)

- [ ] 2b.6 RED: Anthropic recorded fixtures and contract run (LLM-1, LLM-2, LLM-5)
  - Files: `tests/fixtures/providers/anthropic/*.sse`, `tests/contract/anthropic.contract.test.ts`
  - RED: the suite for `anthropic` fails (adapter missing). Fixtures are synthetic, sanitized (headers dropped, ids replaced).
- [ ] 2b.7 GREEN: Anthropic adapter (LLM-2, LLM-5, LLM-7; ADR-13, ADR-21)
  - Files: `src/providers/anthropic.ts`
  - Do: Messages API streamed structured output per the S1 verdict (header only if S1 says it is required); no tools; `cache_control` on the last prefix block; completion status mapping (401/403 `auth`, 429 `rate_limit`, 5xx/529/network `transient`, other 4xx `invalid_request`, refusal `refusal`, truncated or unparseable `invalid_output`); `validateKey` zero-token `GET /v1/models` mapping (200 valid, 401 invalid, 403 `unverifiable/restricted`, 429/5xx/529 `provider_unavailable`, network/timeout `network`); asserts request origin equals `https://api.anthropic.com`; refuses before any request when the host permission is missing (`permission_missing`); redacts messages; maps cached input tokens.
  - Accept: 2b.6 green.
- [ ] 2b.8 Owner tooling: `record:provider` (fixtures)
  - Files: `scripts/record-provider.ts`, `package.json`
  - RED: the sanitizer unit test (`tests/unit/record-provider.test.ts`) drops headers, replaces ids and rejects any non-synthetic input. The script itself is owner-run with a local key and needs explicit owner authorization before use.

### PR 2b-3 - OpenAI adapter (~380 lines)

- [ ] 2b.9 RED: OpenAI recorded fixtures and contract run (LLM-1, LLM-3, LLM-5)
  - Files: `tests/fixtures/providers/openai/*.sse`, `tests/contract/openai.contract.test.ts`
- [ ] 2b.10 GREEN: OpenAI adapter (LLM-3, LLM-5, LLM-7)
  - Files: `src/providers/openai.ts`
  - Do: Responses API strict `json_schema` with `stream: true` per the S2 verdict (Chat Completions strict fallback if S2 failed); `toStrictSchema`; same status mapping and `validateKey` mapping; origin `https://api.openai.com`; permission-before-request; cached token usage; refusal mapping.
  - Accept: 2b.9 green; both adapters pass the unchanged suite.

### PR 2b-4 - createProvider, catalog data, E2E hooks, release hygiene (~350 lines)

- [ ] 2b.11 `createProvider` and `ProviderDeps` (ADR-01)
  - Files: `src/providers/index.ts`, `tests/unit/providers/index.test.ts`
  - RED: returns the adapter for each real `ProviderId`; throws for unknown ids; `hasPermission` is consulted before any request.
- [ ] 2b.12 Catalog data (LLM-8, LLM-10)
  - Files: `src/core/pricing/catalog.ts`, `tests/unit/catalog.test.ts`
  - RED: every entry has `verifiedAt` and `sourceUrl`; exactly one `isDefault` per provider (cheapest suitable); `qualifiedId` equals `<provider>/<id>`; `REAL_PROVIDER_IDS` equals the keys; no custom model ids.
  - Do: re-verify default model ids and prices against the providers' current pricing pages (authorized documentation access) and fill the entries; record the verification date.
- [ ] 2b.13 E2E hooks compiled out of release builds (ADR-28)
  - Files: `src/e2e/overrides.ts`, `wxt.config.ts`, `tests/build/release-hygiene.test.ts`
  - RED: the release output contains neither `__cvt_e2e_override__` nor a `"fake"` provider id; the e2e output contains the override; the override is imported only inside `if (import.meta.env.E2E)`.
  - Do: base-URL override pointing at the local fixture server and a `FetchLike` network recorder.

---

## Phase 3: Sub-change 3 `profile` (Dexie v1, key, onboarding, budget, full backup)

Prerequisite: S6 verdict merged (1.9). Exit: the owner can configure key, profile, PDFs, onboard from pasted CV text, export and re-import a backup.

### PR 3-1 - Dexie v1, DB guard, profile repo (~300 lines)

- [ ] 3.1 Dexie v1 and downgrade guard (TRACKER-6; ADR-11, Contract J)
  - Files: `src/storage/db.ts`, `src/storage/dbGuard.ts`, `tests/support/dbVersions.ts`, `tests/integration/db.test.ts`
  - RED: v1 stores `profile`, `cvPdfs` (with unique `[branchId+language]`), `usage`, `meta`; a database stored at a newer version raises `VersionError`, sets `dbState = 'newer_than_app'`, and every repo write refuses; the migration harness can seed a database at any prior version (used by later bumps).
- [ ] 3.2 Claims repo (PROFILE-1, PROFILE-3)
  - Files: `src/storage/repos/profile.ts`, `tests/integration/profileRepo.test.ts`
  - RED: fresh install has empty claims, branches and blocklist; claim ids `c-<seq>` are never reused after deletion; a blank statement is refused; `dataChangedAt` bumps on writes.
- [ ] 3.3 Branches repo and delete cascade (PROFILE-4 repo layer)
  - Files: `src/storage/repos/profile.ts`, `tests/integration/branchDelete.test.ts`
  - RED: create, rename, delete without a fixed limit; a new branch starts with empty filters, rules and dealbreakers; deleting removes that branch's PDFs in the same transaction; a transaction failure leaves the branch and PDFs intact. The confirmation prompt is the UI half (task 3.13); the tracker `branchName` retention is tested in 5.12.

### PR 3-2 - PDFs, settings additions, secrets, completeness (~300 lines)

- [ ] 3.4 PDF repo (PROFILE-6; S6 caps)
  - Files: `src/storage/repos/pdfs.ts`, `tests/integration/pdfRepo.test.ts`
  - RED: first 5 bytes must be `%PDF-` else rejected with a message; sha256 via `crypto.subtle`; uploading a second PDF for the same `[branchId+language]` replaces the first atomically; a quota error aborts the transaction leaving no partial row and returns a storage-full result; PDFs open and download only through `URL.createObjectURL` in the page. Add the 5 MB per PDF and 50 MB total caps only if the S6 verdict requires them.
- [ ] 3.5 Settings additions, secrets, `isProfileComplete` (LLM-6, LLM-10, PROFILE-7; A8)
  - Files: `src/storage/settings.ts`, `src/core/schemas/settings.ts`, `src/storage/secrets.ts`, `src/core/schemas/profile.ts`, `tests/integration/secrets.test.ts`, `tests/unit/core/profileComplete.test.ts`
  - RED: `provider` is `z.enum(REAL_PROVIDER_IDS).nullable()`; an unknown stored value resets to `null` with a log entry; `keyStatus`, `dailyLimitUsd` default 1.00, `models`; secrets stored as `secret:<providerId>` and importable only from the worker (the `src/ui` boundary rule rejects it); `isProfileComplete` requires at least one claim, one branch and a stored key whose state is not `invalid` (valid or unverified both pass).

### PR 3-3 - KeyService (~350 lines)

- [ ] 3.6 KeyService (LLM-6, LLM-7; ADR-13; A5, A7)
  - Files: `src/background/services/key.ts`, `src/shared/messaging/commands.ts`, `src/background/router.ts`, `tests/integration/keyService.test.ts`
  - RED (fake provider): `valid` stores the key with status `valid`; `invalid` writes nothing, the previous key survives; `unverifiable` (403, 429/5xx, network) writes nothing until `key.set { saveUnverified: true }`, which stores status `unverified`; an unverified key is usable; a successful provider call promotes it to `valid`; an `auth` failure sets `invalid`, keeps the key and blocks further calls; `key.remove` deletes `secret:<id>` and `keyStatus` and later calls fail with `auth` before any request; validation records are written at zero cost and are exempt from the budget (A5); the key is never returned to the UI (only "ends in ...abcd"); commands `key.set`, `key.validate`, `key.remove` are privileged and rejected from web senders.
- [ ] 3.7 Key-use hooks for the provider gateway
  - Files: `src/background/services/key.ts`, `tests/integration/keyService.promotion.test.ts`
  - Do: `markKeyUsed(providerId, outcome)` for promotion and invalidation, called by the gateway in 3.8.
  - Accept: promotion and invalidation scenarios green.

### PR 3-4 - Usage, budget, gateway, model choice (~350 lines)

- [ ] 3.8 Usage repo, budget gate and provider gateway (LLM-8, LLM-9; ADR-18; A5, A6)
  - Files: `src/storage/repos/usage.worker.ts`, `src/core/budget.ts`, `src/background/services/providerGateway.ts`, `tests/integration/usage.test.ts`, `tests/unit/core/budget.test.ts`
  - RED: a reservation record (`pending`, `estimated`) is written before any token-consuming request, input estimated as `ceil(promptChars/4)` uncached; progress updates the output estimate; completion reconciles the same record to `final`; if usage is omitted the estimate stays `estimated: true`; cancel, timeout or mid-stream failure becomes `interrupted` and counts; a failure before any response byte reconciles to zero tokens; a call never produces two usage records; `spentToday` sums every record of the local day regardless of state; the gate refuses with `budget_exceeded` when `spentToday >= dailyLimitUsd`; rollover at local midnight; raising the limit unblocks; an in-flight call completes and is recorded; killed worker leaves an `interrupted` record counted by the budget; startup recovery marks leftover `pending` records `interrupted`; records older than 90 days are pruned.
- [ ] 3.9 Provider and model selection (LLM-10)
  - Files: `src/core/schemas/settings.ts`, `src/storage/settings.ts`, `tests/integration/modelSelection.test.ts`
  - RED: only catalog models are selectable; the default is the `isDefault` entry; switching provider or model keeps the profile; an unlisted model id is not accepted.

### PR 3-5 - Onboarding (~380 lines)

- [ ] 3.10 OnboardingService and `profile_proposal_v1` (PROFILE-2, PROFILE-3; ADR-25)
  - Files: `src/background/services/onboarding.ts`, `src/core/schemas/onboarding.ts`, `src/shared/messaging/commands.ts`, `tests/integration/onboarding.test.ts`
  - RED: `onboarding.propose { cvText }` over a `runtime.connect` port applies the key, permission and budget gates, timeouts, heartbeat, metering with reservation and redaction; nothing is persisted as a job; the CV text is never written to IndexedDB; proposals are not stored as accepted claims until reviewed; on failure the text survives (mirrored to `chrome.storage.session`) and retry is possible; a worker death marks the onboarding usage record `interrupted`; at the budget limit the user sees the budget message and manual claim entry still works.
- [ ] 3.11 Onboarding UI: disclosure and review (PROFILE-2, PROFILE-3)
  - Files: `src/ui/components/onboarding/Onboarding.tsx`, `src/ui/components/onboarding/ClaimsReview.tsx`, `src/ui/i18n/en.ts`, `src/ui/i18n/es.ts`, `tests/component/onboarding.test.tsx`
  - RED: the disclosure names the provider and model and requires an explicit action; no request is sent before confirmation; PDFs are never sent; accept, edit, delete and manual add; a blank statement is refused; the review is completable entirely in the UI.

### PR 3-6 - Options UI (~350 lines)

- [ ] 3.12 Key section and provider/model selector (LLM-6, LLM-7, LLM-10)
  - Files: `src/ui/components/options/KeySection.tsx`, `src/ui/components/options/ProviderSelect.tsx`, `src/ui/i18n/en.ts`, `src/ui/i18n/es.ts`, `tests/component/options/keySection.test.tsx`
  - RED: the unencrypted-storage warning is rendered adjacent to the key field; the optional provider host permission is requested on the Save gesture; "Key verified" and "The provider rejected this key" states; `unverifiable` shows the reason with "Save without verification" and "Retry check"; unverified shows "Not verified - checked on first analysis" and a "Verify now" button; only "key set, ends in ...abcd" is displayed after save; manifest origin test table gains the provider origins (0.18 `ORIGINS_BY_SUBCHANGE`).
- [ ] 3.13 Profile editor: claims, branches, PDFs, output language (PROFILE-3, PROFILE-4, PROFILE-5, PROFILE-6, PRIV-11)
  - Files: `src/ui/components/options/ClaimsEditor.tsx`, `src/ui/components/options/BranchesEditor.tsx`, `src/ui/components/options/PdfSection.tsx`, `src/ui/lib/openBlob.ts`, `tests/component/options/branchDelete.test.tsx`, `tests/component/options/pdfSection.test.tsx`, `tests/unit/ui/openBlob.test.ts`
  - RED, PROFILE-4 branch-delete confirmation: clicking delete opens a confirmation that names the branch and the number of PDFs that will also be removed and says tracker records keep the branch name; cancel leaves the branch and its PDFs untouched; only the explicit confirm calls the cascading delete; the delete control is not reachable without the confirmation step. PDF section: language selector offers `es` and `en` (`ca` after 7-2), rejects a non-PDF with a message, replacing an existing pair asks no data loss silently (shows the replacement), a storage-full message appears on a quota error. Open control (PRIV-11, review follow-up R3; ADR-14 item 7): create `src/ui/lib/openBlob.ts` with `openBlob(blob: Blob): void` and `tests/unit/ui/openBlob.test.ts`; RED: it calls `URL.createObjectURL` with the given `Blob`, opens only the resulting `blob:` URL with `window.open(url, '_blank', 'noopener')`, refuses (throws, opens nothing) if the created URL does not start with `blob:`, and revokes the URL after 60 seconds (fake timers); a type-level test asserts that a `string` argument does not compile; the PDF section's open control calls `openBlob` with the stored `Blob` (download stays on `<a download>`). This is the fifth path allowlisted by 0.34, so `pnpm lint` stays green.

### PR 3-7 - Backup export and reminder (~300 lines)

- [ ] 3.14 Backup export (PORT-3, PORT-7; ADR-20; A9)
  - Files: `src/storage/backup/export.ts`, `src/core/schemas/backup.ts`, `tests/integration/backupExport.test.ts`
  - RED: filename `cvtracker-backup-YYYYMMDD-HHmm.json`; `{ format: 'cvtracker-backup', formatVersion: 1, schemaVersion, appVersion, exportedAt, data, secrets? }`; every collection defined from the start and a collection whose table does not exist yet exports as an empty array; PDFs carry sha256 and base64; preferences exclude `tos`, `keyStatus`, `updateCheck` and `scan.scheduleEnabled` (defined by omit-by-name so later keys are covered; a schema test enumerates the excluded names); `analysisCache`, `jobs`, `scanState`, `usage` and `logs` are excluded; `secrets` appears only after the explicit opt-in with a warning; the exported file never contains a key otherwise (persistence audit); size warning above 50 MB; export uses `Blob` and `URL.createObjectURL` and makes no network call.
- [ ] 3.15 Backup reminder (PORT-6)
  - Files: `src/core/backupReminder.ts`, `src/ui/components/BackupReminder.tsx`, `tests/unit/core/backupReminder.test.ts`, `tests/component/backupReminder.test.tsx`
  - RED: shown only when user data exists, `lastBackupAt` is null or older than 30 days, `dataChangedAt > (lastBackupAt ?? 0)` and `now >= reminderSnoozedUntil`; 31 days shows, empty profile does not, dismiss snoozes to the next local midnight (at most once per day); export sets `lastBackupAt` and clears the snooze; visible in popup and options; never a system notification.

### PR 3-8 - Backup import (~380 lines)

- [ ] 3.16 Import validation and migration chain (PORT-4; ADR-20)
  - Files: `src/storage/backup/import.ts`, `src/storage/backup/migrate.ts`, `tests/integration/backupImport.validate.test.ts`
  - RED: full Zod validation before any write; `provider` must be a real registered provider; a tampered PDF digest is rejected and data is unchanged; a newer `formatVersion` or `schemaVersion` is rejected; a non-empty collection for a table that does not exist in this version is rejected as "newer than this version"; an older version runs the migrator chain.
- [ ] 3.17 Quiesce, single transaction, journal, consent reset (PORT-4; ADR-20; A9)
  - Files: `src/background/quiesce.ts`, `src/shared/messaging/commands.ts`, `src/storage/backup/import.ts`, `src/entrypoints/background.ts`, `tests/integration/backupImport.test.ts`
  - RED: `maintenance.quiesce` sets the 5-minute flag in `chrome.storage.session`, cancels queued jobs, aborts and persists `cancelled` for running jobs (job parts are completed in 4.5 when the queue exists), closes the scan tab; one Dexie read-write transaction replaces all user-owned tables and writes `meta.pendingSettings`; settings are applied after commit with `tos: null`, `scan.scheduleEnabled: false`, `keyStatus: {}` (an opted-in key is restored as `unverified`), `updateCheck.enabled: false`; a startup hook rolls a leftover journal forward; `maintenance.afterImport` clears the flag and reconciles alarms; `maintenance.resume` on failure or cancel; the flag expires on its own; failure injected mid-import leaves the previous data intact; a backup exported with consent and schedule set is imported with both off.
  - Do: the import UI names what will be replaced and requires confirmation before quiescing.

---

## Phase 4: Sub-change 4 `manual-analysis` (Dexie v2, queue)

Prerequisite: S3, S5, S7 verdicts merged (1.12). Exit: the owner analyzes a live LinkedIn offer end to end (owner-run, local, authorization required).

### PR 4-1 - Dexie v2, queue transitions, jobs repo (~350 lines)

- [ ] 4.1 Dexie v2 and migration test (TRACKER-6, Contract J)
  - Files: `src/storage/db.ts`, `tests/integration/migrations.v2.test.ts`
  - RED: a seeded v1 database upgrades to v2 keeping every record; new tables `jobs`, `analysisCache`, `logs` exist with the Contract J indexes; downgrade refusal still holds.
- [ ] 4.2 Queue types and pure transitions (SHELL-4, BEACON-6; Contract G; defines `RetryPolicy`, `GateReason`, `GateFailure`)
  - Files: `src/core/queue/types.ts`, `src/core/queue/transitions.ts`, `tests/unit/core/queue/transitions.test.ts`
  - RED: `pickNext` by priority then `nextAt`, per lane; `recoverExpired` requeues an expired `running` job with `attempts + 1` unless it is `cancelled`; `onStepError` follows the `RetryPolicy`; `onGateDefer` leaves `attempts` unchanged; leases are `llm` 300 s and `portal` 90 s; manual outranks scheduled within a lane.
- [ ] 4.3 Jobs repo (ADR-17; `jobs.worker.ts`)
  - Files: `src/storage/repos/jobs.worker.ts`, `tests/integration/jobsRepo.test.ts`
  - RED: claiming a job takes a lease in a read-write transaction; the dedupe check against non-terminal jobs happens inside the enqueue transaction; a `force` re-analyze job is allowed while a cached entry or a `normal` job exists; terminal jobs are pruned after 7 days; the repo cannot be imported from `src/ui` (boundary rule).

### PR 4-2 - QueueRunner and recovery (~400 lines)

- [ ] 4.4 QueueRunner, heartbeat, startup recovery (SHELL-4, BEACON-6, LLM-4; ADR-03; S7)
  - Files: `src/background/queueRunner.ts`, `src/background/heartbeat.ts`, `tests/integration/queueRunner.test.ts`
  - RED (fake-browser): `pump()` claims one due job per lane and runs one bounded step per event; a 20 s heartbeat (`chrome.runtime.getPlatformInfo()`) persists streamed-output progress on the usage record; an in-worker `setTimeout` is used only when the next job is 25 s away or less, otherwise a `queue-wake` alarm exists only while jobs are pending; pump runs on `onStartup`, `onInstalled`, top-level init, every enqueue and after every step; a killed worker leaves a `running` job with an expired lease that is requeued on restart with `attempts + 1` and its `pending` usage record becomes `interrupted`; a cancelled job stays cancelled; a 3-step run killed between steps resumes without duplicating a step; the quiesce flag stops `pump()`.
- [ ] 4.5 `ensureAlarms` queue wake and quiesce job handling (SHELL-4, PORT-4)
  - Files: `src/background/alarms.ts`, `src/background/quiesce.ts`, `src/entrypoints/background.ts`, `tests/integration/quiesceJobs.test.ts`
  - RED: `queue-wake` is created only while jobs are pending and removed otherwise; reconcile on settings change stays idempotent; `maintenance.quiesce` cancels queued jobs and aborts running ones persisting `cancelled` before aborting; no job runs while the flag is set (closes the job half of 3.17).

### PR 4-3 - Analysis cache, logs, AnalysisService (~400 lines)

- [ ] 4.6 Analysis cache (ANALYSIS-9; A15)
  - Files: `src/storage/repos/analysisCache.worker.ts`, `tests/integration/analysisCache.test.ts`
  - RED: stores only the `ValidatedOutput` plus call metadata; a hit updates `lastUsedAt` and returns `cached: true` with every derived field recomputed (a PDF added after caching is recommended on the next hit); failures are never cached; a put over 2,000 entries evicts the oldest `lastUsedAt` in the same transaction; `force` skips the lookup and overwrites.
- [ ] 4.7 Logs and redacting logger
  - Files: `src/storage/repos/logs.worker.ts`, `src/shared/log.ts`, `tests/integration/logs.test.ts`
  - RED: logs are capped at 500 entries; keys and authorization headers never appear (persistence audit input for 4.16).
- [ ] 4.8 AnalysisService (MANUAL-5, MANUAL-7, PROFILE-7, LLM-4; ADR-04, ADR-17)
  - Files: `src/background/services/analysis.ts`, `src/shared/messaging/commands.ts`, `src/background/router.ts`, `tests/integration/analysisService.test.ts`
  - RED (fake provider): gates G1 (profile complete, key not invalid) and G2 (provider permission) run before any page read or provider call so a missing key reads nothing; one analysis makes exactly one provider call through the gateway; cache lookup then derive; a cache hit makes no call and has zero incremental cost; cancel persists `cancelled` first, aborts, and caches/saves nothing; re-analyze enqueues a `force` job and replaces the cached entry with one call; progress is forwarded on a `progress:<jobId>` port; transient failures follow the retry policy; PRIV-5 manual ungated: with no `tos` stored, `analysis.start` proceeds with no ToS screen.
  - Commands: `analysis.start`, `analysis.confirmGeneric`, `analysis.reanalyze`, `analysis.cancel`. The `analysis.confirmGeneric` payload carries no URL (`{ tabId, previewId, title, text }`, Contract M, A19); its handler and the preview store are implemented and tested in 4.20/4.21, and this task registers only the command name.

### PR 4-4 - LinkedIn detail reader (~400 lines)

- [ ] 4.9 LinkedIn detail reader, tables, adapter, reader bundle (PORTAL-2, PORTAL-4, PORTAL-5, PORTAL-8 detail; ADR-08)
  - Files: `src/portals/readers.ts`, `src/portals/index.ts`, `src/portals/linkedin/tables.ts`, `src/portals/linkedin/readers.ts`, `src/portals/linkedin/inject.ts`, `src/portals/linkedin/adapter.ts`, `src/entrypoints/reader-linkedin.ts`, `tests/contract/portalAdapter.contract.ts`, `tests/contract/portalAdapter.linkedin.test.ts`, `tests/fixtures/portals/linkedin/*.html`
  - RED (jsdom, synthetic fixtures, S3 verdict applied): detail ok; collapsed description clicks only the portal's own expand control; empty description yields `unreadable` listing the attempted strategies and no page text (PORTAL-4); content uses `textContent` of content nodes excluding `script` and `style` and is capped at 50,000 characters; login, authwall, checkpoint and rate-limit pages classify through core `classify` with LinkedIn `ClassifyTables`; the 10 s readiness deadline is the worker's, the reader waits on markers with a bounded timeout. The contract suite takes capabilities `{ detail: true, search: false }`; `readSearchResults` returns `unreadable` until 6-5.
- [ ] 4.10 Reader bundle build assertions (LLM-4, ADR-04, ADR-11)
  - Files: `tests/build/readers.test.ts`
  - RED: after `pnpm build`, the `reader-*` bundles contain no provider host, no `chrome.storage` and no `secret:`; the manifest has no `content_scripts`.

### PR 4-4a - LinkedIn adapter id pattern and `canonicalFor` (~90 lines; amendment A19)

- [ ] 4.18 RED: adapter `idPattern`, `canonicalFor` and contract cases (PORTAL-3, PRIV-11; A19)
  - Files: `tests/contract/portalAdapter.contract.ts`, `tests/contract/portalAdapter.linkedin.test.ts`, `tests/fixtures/portals/linkedin/search-foreign-href.html`
  - RED: for every adapter the shared contract asserts `canonicalFor(id)` round-trips through `mapUrl` (`mapUrl(canonicalFor('123')).id === '123'`), `canonicalFor` returns `null` for ids that fail `idPattern` (`'12 34'`, `'../x'`, a 21-digit id, `''`), and the result passes `isAllowedNavigation`; a fixture card whose anchor `href` points to a foreign host (`https://canary.invalid/x`) while carrying a valid-looking id yields only that id, never a URL (the search assertion that uses the fixture is enabled in 6-5; here the fixture is parsed by the detail-side id helper test).
- [ ] 4.19 GREEN: LinkedIn `idPattern` and `canonicalFor` (PORTAL-3; A19)
  - Files: `src/portals/linkedin/adapter.ts`
  - Do: `idPattern = /^\d{1,20}$/` (anchored); `canonicalFor` delegates to the core registry `canonicalFor` from 2a.21 so there is one URL builder.
  - Accept: 4.18 green.

### PR 4-5 - activeTab reader, generic reader, commands (~350 lines)

- [ ] 4.11 activeTab reader and permission handling (PORTAL-7, MANUAL-2, PRIV-11; ADR-14 item 7; A19)
  - Files: `src/background/activeTabReader.ts`, `tests/integration/activeTabReader.test.ts`
  - RED (fake-browser scripting): without the host permission nothing is injected and the result is `permission_missing`; `executeScript({ files })` once per document then `executeScript({ func })`; results are accepted only from the worker's own calls for the expected tab id; a `login`, `authwall`, `checkpoint` or `rate_limit` page produces the wall message and no analysis. A19: every `executeScript` result is parsed with the 2a.32 strict schemas before use; an unknown field, a wrong type or any cap exceeded (title 301 characters, text over 50,000) is `unreadable` as a whole and nothing partial reaches the analysis; a markers object with an extra key is `unreadable`; the parse failure is logged by count and field name only.
- [ ] 4.12 Generic reader and preview (MANUAL-3; ADR-08, ADR-10; A19)
  - Files: `src/portals/generic/readers.ts`, `src/portals/generic/inject.ts`, `src/entrypoints/reader-generic.ts`, `tests/unit/portals/generic.test.ts`
  - RED (jsdom): `readMainContent` extracts main-content text and returns only `{ title, text }` (no URL field; A19); it is not a `PortalAdapter` (no registry entry, no tables); the id is `sha256(canonicalizeGenericUrl(url))`, so URLs differing by fragment give the same id (the `url` argument is supplied by the worker from `tabs.get`, see 4.20); nothing is enqueued until `analysis.confirmGeneric` after the editable preview.

### PR 4-5a - Generic URL from `tabs.get` and host class in the preview (~120 lines; amendments A19, A20)

- [ ] 4.20 RED: worker-owned generic URL, `previewId`, `confirmGeneric` payload (MANUAL-3, PORTAL-11, PRIV-11; ADR-10, ADR-14 item 7, Contract M; A19, A20)
  - Files: `tests/integration/genericPreview.test.ts`
  - RED (fake-browser): building a preview reads `tabs.get(tabId).url`, stores `{ url, hostClass }` in `chrome.storage.session` under a fresh `previewId` and returns `{ previewId, title, text, hostClass }`; a reader result that carries a URL (even a valid one on another host) is rejected by the strict schema and its URL is never used; `analysis.confirmGeneric { tabId, previewId, title, text }` rejects a payload with a `url` field (strict command schema) and an unknown `previewId`, and enqueues with the stored URL only; the stored `canonicalUrl` equals `canonicalizeGenericUrl(tabs.get(tabId).url)` and two previews that differ only by fragment give the same job id; if the tab navigated to another URL between preview and confirm, the stored URL (not the new one) is used and the preview is flagged stale; an `unverified` host (for example `https://linkedin.com.evil.com/x`) still produces a preview with `hostClass.kind === 'unverified'` and does not block or change the analysis path.
- [ ] 4.21 GREEN: generic preview service and command wiring (MANUAL-3; Contract M; A19, A20)
  - Files: `src/background/services/genericPreview.ts`, `src/shared/messaging/commands.ts`, `src/background/router.ts`, `src/background/services/analysis.ts`
  - Do: implement the preview store keyed by `previewId`, drop `url` from the `analysis.confirmGeneric` schema (the 4.8 command keeps its name, the payload is `{ tabId, previewId, title, text }`), call `classifyHost` once per preview.
  - Accept: 4.20 green.

### PR 4-6 - Review card and popup/side panel (~400 lines)

- [ ] 4.13 Review card component (MANUAL-4, MANUAL-5, ANALYSIS-8, ANALYSIS-10; PRIV-4; A12)
  - Files: `src/ui/components/card/ReviewCard.tsx`, `src/ui/components/card/states.ts`, `src/ui/i18n/en.ts`, `src/ui/i18n/es.ts`, `tests/component/reviewCard.test.tsx`
  - RED: states reading, queued, analyzing with progress, done, each failed class, cancelled; verdict, score, requirements and fit, rationale, apply warnings, recommended PDF with reason and alternatives (its open control calls `openBlob` from 3.13 with the stored `Blob`; PRIV-11); a wall `skip` is shown as "Skip - blocker found" with the wall and its evidence, distinct from a low-score skip; the injection chip appears when flagged; untrusted text (`<img onerror>`, `<script>`) renders as literal text; re-analyze asks for cost confirmation; labels in EN and ES.
- [ ] 4.14 Popup and side panel wiring (MANUAL-1, MANUAL-2, SHELL-1, SHELL-3; ADR-10; S5)
  - Files: `src/entrypoints/popup/main.tsx`, `src/entrypoints/sidepanel/main.tsx`, `src/ui/components/popup/Popup.tsx`, `wxt.config.ts`, `tests/component/popup.test.tsx`, `tests/build/manifest.test.ts`
  - RED: "Analyze this page" calls `chrome.sidePanel.open({ tabId })` and, when the URL maps to a portal without the host permission, `chrome.permissions.request` in the same click handler, then sends `analysis.start`; when `chrome.sidePanel` is unavailable the card renders inside the popup without an error; the side panel's own button requests the permission for a supported portal origin and shows the "click the toolbar icon or press the shortcut" guidance on `permission_missing`; keyboard command `analyze-page` grants `activeTab`; nothing runs while idle. Manifest origin table gains `https://*.linkedin.com/*`.

### PR 4-6a - Review-card chips (~110 lines; amendments A18, A20)

- [ ] 4.22 RED: unverified-figures and unverified-source chips (MANUAL-4, MANUAL-3, ANALYSIS-11, PORTAL-11, PRIV-4; ADR-10, ADR-29; A18, A20)
  - Files: `tests/component/chips.test.tsx`
  - RED (Testing Library): a result with `diagnostics.ungroundedClaims.count > 0` shows the chip "Unverified figures in the rationale" listing each sample as a text node (a sample containing `<img onerror=x>` renders as literal text, no element is created); with `count: 0` no chip is shown; the downgrade reason `grounding_downgrade` shows the review verdict with the chip, and `injection_downgrade` wins when both apply; a preview or card whose `hostClass.kind === 'unverified'` shows the non-blocking chip "Unverified source: <host>" with the host rendered as text (a host string containing markup stays literal), never as a link, and `known_ats` and `portal` show no chip; the preview confirm button stays enabled with the chip present; chip labels exist in EN and ES (the i18n parity test passes).
- [ ] 4.23 GREEN: chips component and i18n keys (MANUAL-4; A18, A20)
  - Files: `src/ui/components/card/Chips.tsx`, `src/ui/components/card/ReviewCard.tsx`, `src/ui/components/card/GenericPreview.tsx`, `src/ui/i18n/en.ts`, `src/ui/i18n/es.ts`
  - Do: render the chips as React text nodes only; read `hostClass` from the preview payload (4.21) and `diagnostics` from the result.
  - Accept: 4.22 green; 4-6 card tests still green.

### PR 4-7 - E2E and audits (~330 lines)

- [ ] 4.15 Persistence audit (PRIV-3)
  - Files: `tests/integration/persistence-audit.test.ts`
  - RED: after key save, onboarding, analysis and export, a scan of every IndexedDB store, the export JSON and the logs finds no key value.
- [ ] 4.16 E2E: manual analysis, network audit, key confinement (MANUAL-1, MANUAL-2, MANUAL-3, PRIV-1, LLM-6, PROFILE-7)
  - Files: `tests/e2e/manual-analysis.spec.ts`, `tests/e2e/support/fixtureServer.ts`, `tests/e2e/support/routes.ts`
  - RED (e2e build, stub provider server, `context.route` for the LinkedIn fixture): happy path on a fixture offer; permission prompt path; `login` wall message; generic preview and confirm; a fresh user completes onboarding without any files; the API key appears only in requests to the provider host; the network audit shows only allowlisted origins; the recorder supplies service-worker requests if Playwright does not.
- [ ] 4.17 Live smoke (owner-run, local only; exit criterion)
  - Files: `package.json`, `tests/live/provider.live.test.ts`
  - Do: `pnpm test:live` env-gated, never in CI, one provider smoke with a real key and one real LinkedIn read. Requires explicit owner authorization of destination, operation and credential before it runs.

### PR 4-8 - Page-content canary E2E, manual flow (~90 lines; amendment A19)

- [ ] 4.24 E2E: page content never steers code, manual flow (PRIV-11, PORTAL-11, MANUAL-3; ADR-14 item 7; A19, A20)
  - Files: `tests/e2e/canary-manual.spec.ts`, `tests/e2e/support/fixtureServer.ts`, `tests/fixtures/portals/linkedin/detail-canary.html`
  - RED (e2e build, request recorder, `context.route` for the LinkedIn fixture): a detail fixture whose description and markup contain `https://canary.invalid/x` both as text and as an anchor is analyzed end to end; expected: zero requests to `canary.invalid` (page, worker and recorder), no tab created or updated with that URL, no element with that `href` in the review card, and the detail read targeted the portal host only; a generic-flow variant on a page whose reader would otherwise report a foreign URL stores the `tabs.get` URL, and a spoofed-host tab (`linkedin.com.evil.com` served through the route) shows the unverified-source chip and is not treated as a portal. Skipping the reader schema or the egress allowlist makes the spec fail.

---

## Phase 5: Sub-change 5 `tracker` (Dexie v3)

### PR 5-1 - Dexie v3, tracker schema and repo (~400 lines)

- [ ] 5.1 Dexie v3 and migrations (TRACKER-6)
  - Files: `src/storage/db.ts`, `tests/integration/migrations.v3.test.ts`
  - RED: databases seeded at v1 and at v2 upgrade to v3 keeping all records; `tracker` and `trackerDetails` indexes per Contract J; downgrade refusal holds.
- [ ] 5.2 Tracker schemas and search text (TRACKER-1, TRACKER-2, TRACKER-3; ADR-22)
  - Files: `src/core/schemas/tracker.ts`, `src/core/trackerSearch.ts`, `tests/unit/core/trackerSearch.test.ts`
  - RED: `TrackerStatus` has the 8 states; `TrackerRow`/`TrackerDetail` shapes per Contract K; `foldSearch` lowercases, NFD-strips marks and collapses whitespace over title, company and notes.
- [ ] 5.3 Tracker repo and Save upsert (TRACKER-1, TRACKER-2, MANUAL-6)
  - Files: `src/storage/repos/tracker.ts`, `tests/integration/trackerRepo.test.ts`
  - RED: Save creates a row with status `new` and origin `manual` and a detail row in one read-write transaction; a quota error aborts both writes; saving an existing key updates only the snapshot and analysis fields and clears `scanFailure`; a status change updates `statusChangedAt`/`updatedAt` and appends to `statusHistory`; setting the same status is a no-op; rows may have no analysis (imported and failed-scan rows); `searchText` is recomputed on every write.

### PR 5-2 - Queries, notes, delete (~300 lines)

- [ ] 5.4 Tracker query (TRACKER-3; ADR-22)
  - Files: `src/storage/repos/trackerQuery.ts`, `tests/integration/trackerQuery.test.ts`
  - RED: with 5,000 seeded rows page 3 returns 50 rows in the expected order; an indexed field narrows (`status`, `origin`, `source`), other filters apply in memory; accent-insensitive search and notes search; sort fields.
- [ ] 5.5 Notes and delete (TRACKER-4)
  - Files: `src/storage/repos/tracker.ts`, `tests/integration/trackerNotes.test.ts`
  - RED: notes edits update `searchText`; delete removes the row and its detail in one transaction; the seen set is untouched (asserted for real in 6.27 once it exists).

### PR 5-3 - Save action and tracker list UI (~380 lines)

- [ ] 5.6 Save to tracker action (MANUAL-6)
  - Files: `src/ui/components/card/SaveButton.tsx`, `tests/component/tracker/saveButton.test.tsx`
  - RED: Save writes through the user-owned repo path; a saved offer shows "saved"; saving again updates the snapshot only.
- [ ] 5.7 Tracker list UI (TRACKER-2, TRACKER-3, TRACKER-4, MANUAL-6, PRIV-4)
  - Files: `src/ui/components/tracker/TrackerList.tsx`, `src/ui/components/tracker/TrackerRowView.tsx`, `src/ui/components/tracker/statusLabels.ts`, `src/ui/i18n/en.ts`, `src/ui/i18n/es.ts`, `tests/component/tracker/trackerList.test.tsx`
  - RED: list via `useLiveQuery` with filters, search and 50-per-page pagination; status select with Spanish labels; notes editing; delete asks confirmation; untrusted title and company render as text (markup test); flagged rows show "Analysis failed" and a Retry button (wired in 6.23).

### PR 5-4 - Popup summary and exports (~400 lines)

- [ ] 5.8 Popup status summary and unviewed count (TRACKER-5, BEACON-9 groundwork)
  - Files: `src/ui/components/popup/StatusSummary.tsx`, `src/storage/repos/trackerQuery.ts`, `tests/component/popupSummary.test.tsx`
  - RED: per-status counts via `where('status').equals(s).count()`; unviewed count only for rows with `viewedAt === null`, origin `beacon` and `scanFailure === null`; opening the list sets `viewedAt` and clears the count.
- [ ] 5.9 CSV codec and export (PORT-1)
  - Files: `src/core/csv.ts`, `src/storage/backup/trackerExport.ts`, `tests/unit/core/csv.test.ts`
  - RED: fixed column order; UTF-8 with BOM; RFC 4180 quoting (comma, quote, CR, LF; inner quotes doubled); cells starting with `=`, `+`, `-`, `@`, tab or CR get a `'` prefix; export all or the filtered view.
- [ ] 5.10 JSON tracker export (PORT-2, PORT-7)
  - Files: `src/storage/backup/trackerExport.ts`, `src/core/schemas/backup.ts`, `tests/unit/trackerJsonExport.test.ts`
  - RED: `{ format: 'cvtracker-tracker', formatVersion: 1, exportedAt, records }`, validated by the same Zod schema used on import, never contains a key; Blob + `createObjectURL`, no network call.

### PR 5-5 - Backup tracker round-trip, integration, E2E (~300 lines)

- [ ] 5.11 Backup extended to tracker collections (PORT-3, PORT-4, TRACKER-6)
  - Files: `src/storage/backup/export.ts`, `src/storage/backup/import.ts`, `tests/integration/backupTracker.test.ts`
  - RED: round-trip including `tracker` and `trackerDetails` compares settings excluding consent and runtime fields; import into a v3 database accepts the previously empty tracker collections.
- [ ] 5.12 Branch name retention (PROFILE-4)
  - Files: `tests/integration/branchDeleteTracker.test.ts`
  - RED: after deleting a branch, existing tracker rows keep their stored `branchName` as text.
- [ ] 5.13 E2E: save, tracker, export, backup round-trip (MANUAL-6, PORT-1, PORT-3, PORT-4, PORT-7)
  - Files: `tests/e2e/tracker.spec.ts`
  - RED: save an analyzed fixture offer, change status, search, export CSV, export a backup and re-import it; the network audit shows no request.

---

## Phase 6: Sub-change 6 `beacons` (Dexie v4)

Prerequisite: S3 verdict merged. PRIV-10: the filter PR (6-1) must carry the owner's written authorship confirmation in its description before merge.

### PR 6-1 - Clean-room filter (~250 lines)

- [ ] 6.1 Authorship confirmation (PRIV-10; BEACON-3) - owner action
  - Status: owner confirmed authorship of the reference filter algorithm on 2026-10-10 (recorded in planning); copy this confirmation into the 6-1 PR description.
  - Do: obtain the owner's written confirmation of authorship of the reference filter algorithm and put it in the 6-1 PR description (the template line from 0.17). The implementation is derived from the written BEACON-3 behavior, not from the reference source. Merge is blocked until it is present.
- [ ] 6.2 RED: filter vectors, authored fresh (BEACON-3)
  - Files: `tests/unit/core/filter.test.ts`
  - RED: every BEACON-3 scenario (whole word `java` vs `javascript`; accents and case; symbol tokens `c#`, `c++`, `.net`; groups AND with terms OR; exclude wins; empty configuration passes; any selected branch passes and records the matched branch; no shipped lists). `tokenize` NFD-strips marks, lowercases and tokenizes with `/\.?[a-z0-9]+[#+]*/g`, so hyphens split ("back-end" gives `back`, `end`). Company blocklist interpretation is whole-name: `companyBlocked` is true only when the tokenized company equals a tokenized blocklist entry, so `"ACME corp"` matches `"Acme Corp"` and `"Acme, Corp."` matches, but `"Acme Corporation"`, `"Acme Corp Spain"` and an entry `"Acme"` do not match `"Acme Corp"`; reasons returned are `blocked_company`, `no_branch_passed`, `passed`.
- [ ] 6.3 GREEN: filter
  - Files: `src/core/filter.ts`
  - Accept: 6.2 green; the interpretation is documented in the beacons UI help text task (6.24) and in `docs/architecture.md` notes.

### PR 6-2 - Dexie v4, beacon types, repos (~380 lines)

- [ ] 6.4 Beacon types and settings additions (BEACON-1, BEACON-2; defines `Beacon`, `BeaconRuntime`, `ScanState`, `ScanSettings`, `TosAcceptance`)
  - Files: `src/core/schemas/beacon.ts`, `src/core/schemas/settings.ts`, `tests/unit/core/schemas/beacon.test.ts`
  - RED: `Beacon` (id, source, search URL, enabled, `branchIds` defaulting to all, interval overrides), `BeaconRuntime` (last run, runs today, details today, cursor), `ScanState` (consecutive walls, backoff until, paused, per-source `layoutFailures`, `layoutSuspect`, adapter version), `ScanSettings` (`scheduleEnabled` false, `intervalHours` 8, `activeHours`), `TosAcceptance { version, acceptedAt }`; settings gain `tos: TosAcceptance | null` and `scan`.
- [ ] 6.5 Dexie v4 and migrations (TRACKER-6)
  - Files: `src/storage/db.ts`, `tests/integration/migrations.v4.test.ts`
  - RED: v1, v2 and v3 databases upgrade to v4 with all records intact; new tables `beacons`, `seenIds`, `scanState` with Contract J indexes.
- [ ] 6.6 Beacon, seen-id and scan-state repos (BEACON-1, BEACON-4)
  - Files: `src/storage/repos/beacons.ts`, `src/storage/repos/seenIds.worker.ts`, `src/storage/repos/scanState.worker.ts`, `src/portals/linkedin/adapter.ts`, `tests/integration/beaconsRepo.test.ts`
  - RED: at most 5 enabled beacons; a beacon URL must pass `normalizeSearchUrl` (LinkedIn: `host_mismatch`, `forbidden_form`, `not_search` rejected; accepted URLs normalized) and the navigation guard; `branchIds` default to all branches; seen ids are per source with a 3,000 cap and the oldest evicted; seen and scan state writers are worker-only (boundary rule).

### PR 6-3 - Scan gate and wall ladder (~380 lines)

- [ ] 6.7 RED: gate order table (BEACON-2, BEACON-7, BEACON-8, BEACON-10, BEACON-11)
  - Files: `tests/unit/core/beaconGate.test.ts`
  - RED (fake clock): one case per reason in the fixed order `tos_missing` (end) > `paused` (end) > `backoff` (defer) > `layout_suspect` (end, notify, per source) > `permission_missing` (end, notify) > `key_missing` (end) > `budget_exhausted` (defer to midnight) > `run_cap` (scheduled) > `detail_cap` (defer to midnight) > `outside_active_hours` (scheduled, defer); with several failing the first in order wins; a ToS version mismatch is `tos_missing`; a manual-analysis context never calls the gate.
- [ ] 6.8 GREEN: `canRunPortalStep`
  - Files: `src/core/beaconPolicy.ts`
  - Do: returns `{ ok: true } | GateFailure` (type from 4.2).
- [ ] 6.9 Wall ladder and layout counters (BEACON-8; A13)
  - Files: `src/core/beaconPolicy.ts`, `tests/unit/core/wallLadder.test.ts`
  - RED: `onWall` sets 2 h, 6 h, 24 h backoff and the fourth consecutive wall pauses globally; `onShellFailure` increments the per-source `layoutFailures` without touching the wall backoff (two runs ending in `unreadable_shell` set no backoff); three consecutive runs set `layoutSuspect`; it clears when the stored adapter version differs; `onCleanRun` resets walls and layout failures; `resume` clears paused, count and `layoutSuspect`.

### PR 6-4 - Schedule math and ToS version (~300 lines)

- [ ] 6.10 Pacing, interval, jitter, caps, active hours (BEACON-7; A17)
  - Files: `src/core/beaconPolicy.ts`, `tests/unit/core/schedule.test.ts`
  - RED (seeded RNG, fake clock): pacing uniform 2.5-6 s; default interval 8 h and values below 4 h are rejected with a message; jitter is positive only in [0, 20%] of the interval so the 4 h floor holds; at most 3 scheduled runs per beacon per local day and 30 detail pages per local day across beacons; active hours 08:00-22:00 local with overnight windows supported, scheduled runs only, deferral to the window start plus jitter; Scan now bypasses hours and the run cap but not the detail cap, ToS, pause or backoff.
- [ ] 6.11 ToS version constant and acceptance helpers (PRIV-5, BEACON-11)
  - Files: `src/core/tos.ts`, `tests/unit/core/tos.test.ts`
  - RED: `TOS_TEXT_VERSION` constant; acceptance valid only when its version equals the constant; revoking yields `tos: null` and `scan.scheduleEnabled: false` as one settings object; an import-restored settings object never carries acceptance.

### PR 6-5 - LinkedIn search reader (~380 lines)

- [ ] 6.12 RED: search reader cases (PORTAL-3, PORTAL-8, PRIV-11; A19)
  - Files: `tests/contract/portalAdapter.linkedin.test.ts`, `tests/fixtures/portals/linkedin/search-*.html`
  - RED (jsdom): 25 rendered cards with 2 duplicates yields 23 items deduped by id; `[]` only when `noResults`; unrecognized markup yields `unreadable`; a virtualized list reads only what is rendered; first page only, no scrolling and no pagination; capability flag `search: true`. A19: items are `RawSearchItem` (`id`, `title`, `company`, optional `location`) with no URL field; the id comes from the card attribute or the `href` path; a card whose anchor points to a foreign host (`search-foreign-href.html` from 4.18) yields only its id and the foreign URL appears nowhere in the result; a card whose id fails `idPattern` is dropped, and a page where every card fails it (without `noResults`) is `unreadable`; the result passes the 2a.32 strict schema (101 cards yields at most 100 items).
- [ ] 6.13 GREEN: `readSearchResults` and search markers
  - Files: `src/portals/linkedin/readers.ts`, `src/portals/linkedin/tables.ts`, `src/portals/linkedin/adapter.ts`
  - Accept: 6.12 green; reader bundle build test 4.10 still green.

### PR 6-6 - ScanTabDriver (~400 lines)

- [ ] 6.14 RED: tab driver behavior (BEACON-5, BEACON-8, PORTAL-5, PORTAL-6; ADR-09, A13)
  - Files: `tests/integration/scanTabDriver.test.ts`
  - RED (fake-browser): one inactive tab with `autoDiscardable: false`, reused sequentially and closed at run end, its id kept in `chrome.storage.session`; every navigation passes the guard; readiness is `tabs.onUpdated complete` plus the marker wait with the 10 s deadline measured by the worker clock; a user-closed, discarded or replaced scan tab triggers one recreation per run and a second loss ends the run `interrupted` with items still pending; a `login`, `authwall`, `checkpoint` or `rate_limit` page stops the run and enters the backoff ladder leaving remaining items queued with `nextAt` at the backoff expiry; `unreadable_shell` is re-navigated once after the pacing delay and a second one ends the run and counts a layout failure.
- [ ] 6.15 GREEN: `scanTabDriver`
  - Files: `src/background/scanTabDriver.ts`
  - Do: non-blocking `webRequest.onCompleted` and `onErrorOccurred` filtered to the scan tab id and `main_frame`; permission checked before opening a tab (PORTAL-7).
- [ ] 6.16 RED then GREEN: webRequest denied fails closed (PORTAL-5; ADR-09 d; S3 c)
  - Files: `src/background/scanTabDriver.ts`, `tests/integration/scanTabDriver.failClosed.test.ts`
  - RED: when the optional `webRequest` permission is denied, revoked or its status is not observable, classification uses URL and DOM markers only, an unrecognized layout is treated as `unreadable_shell` (never as `ok`), no HTTP status is assumed, and the scan continues only through the layout-failure path; if the S3 verdict removed `webRequest`, this becomes the only mode and the build test (0.18) is updated to drop `webRequest` from the optional allowlist.

### PR 6-6a - Scan driver navigates only rebuilt URLs (~100 lines; amendment A19)

- [ ] 6.28 RED: rebuilt-URL navigation (PRIV-11, PORTAL-3, PORTAL-6; ADR-14 item 7, ADR-09; A19)
  - Files: `tests/integration/scanTabDriver.rebuilt.test.ts`
  - RED (fake-browser): `navigateDetail({ source, id })` accepts only an id and builds the target with `canonicalFor`; an id that fails `idPattern` (`'../x'`, `'12 34'`, a 21-digit id) never navigates and yields a typed `invalid_id` result; `navigateSearch(beaconId)` navigates only to the beacon search URL that `normalizeSearchUrl` accepted at save time (a stored URL mutated to another host is refused by the guard); no driver function accepts a URL string from a reader result or from item text; a `SearchItem` built by the worker has `canonicalUrl === canonicalFor(id)` and a foreign `href` in the page markup never reaches `tabs.update`; every `tabs.update` and `tabs.create` call observed in the fake-browser targets a URL that passes `isAllowedNavigation`.
- [ ] 6.29 GREEN: `navigateDetail` and `navigateSearch` (PRIV-11; A19)
  - Files: `src/background/scanTabDriver.ts`, `src/background/services/scan.ts`
  - Do: the driver is the only module allowed to call `tabs.create`/`tabs.update` for scans (the 0.34 egress allowlist); `scan.detail` job payloads carry `{ source, id }`, never a URL (the 6.17 jobs use these payloads).
  - Accept: 6.28 green; 6.14 to 6.16 still green.

### PR 6-7 - Scan services and failed-offer flow (~400 lines)

- [ ] 6.17 Scan jobs: search, detail, finish (BEACON-4, BEACON-5, BEACON-6; ADR-17)
  - Files: `src/background/services/scan.ts`, `src/shared/messaging/commands.ts`, `src/background/router.ts`, `tests/integration/scanService.test.ts`
  - A19 note: `scan.detail` payloads carry `{ source, id }` and navigate through `navigateDetail` from 6.29; no job payload holds a URL read from a page.
  - RED (fake-browser, fake provider): `scan.search` reads the first page, applies the filter, enqueues `scan.detail` jobs deduped by `scan.detail:<source>:<id>`; the first scan of a source records a baseline without analysis; `scan.detail` retries an unreadable detail twice (1 min then 5 min); a detail step persists its `analyze` job in the same transaction that marks the detail done; a seen id is written only when the offer is resolved; at most one due beacon starts per tick; killing the worker at each step boundary resumes without duplicate analysis; `scan.finish` produces the run summary; every portal step calls `canRunPortalStep` first and a failing gate never navigates.
- [ ] 6.18 Failed offers (BEACON-4, BEACON-5, BEACON-10, TRACKER-1; ADR-26; A14)
  - Files: `src/background/services/scan.ts`, `src/storage/repos/tracker.ts`, `tests/integration/scanFailures.test.ts`
  - RED: `transient`, `rate_limit` or `timeout` failures requeue the `analyze` job at +15 min up to 2 attempts, then create a tracker row flagged `scanFailure { retryable: true }` with the id NOT marked seen, and a later scan that reads the offer again processes it and clears the flag on success; `invalid_output`, `refusal` or a detail still unreadable after retries create a row flagged `retryable: false` and mark the id seen; flagged rows are origin `beacon`, status `new`, no verdict or analysis; `budget_exceeded`, `auth` and gate deferrals keep items pending and unseen with no tracker row; `scan.retryFailed { trackerKey }` enqueues `analyze` when text was captured, otherwise `scan.detail` subject to the gate.

### PR 6-8 - Alarms, schedule, notifications, badge (~350 lines)

- [ ] 6.19 Beacon tick and schedule enable/disable (BEACON-2, SHELL-4; ADR-03)
  - Files: `src/background/alarms.ts`, `tests/integration/beaconAlarms.test.ts`
  - RED (WXT fake-browser): `beacon-tick` (15 min) exists only while the schedule is enabled; disabling cancels queued `scheduled` jobs and removes the alarm; revoking ToS (tos null) removes `beacon-tick` and cancels scheduled jobs; Scan now during a pause returns `paused`; `scan.resume` clears the pause; schedule defaults to off with no alarm on a fresh install.
- [ ] 6.20 Notifications and badge (BEACON-9, BEACON-10)
  - Files: `src/background/notifications.ts`, `src/background/badge.ts`, `tests/integration/notifications.test.ts`
  - RED: a run summary notification only when the optional `notifications` permission is granted and enabled; the badge shows the unviewed count and excludes flagged failure rows; opening the list clears it; gate failures that need the user (`permission_missing`, `layout_suspect`, pause) notify once.

### PR 6-9 - Beacons UI and ToS screen (~380 lines)

- [ ] 6.21 ToS screen (PRIV-5, BEACON-11)
  - Files: `src/ui/components/beacons/TosScreen.tsx`, `src/ui/i18n/en.ts`, `src/ui/i18n/es.ts`, `tests/component/tosScreen.test.tsx`
  - RED: the screen states all four required statements: automated reading of portal pages may violate a portal's terms and may lead to account restrictions; the risk is the user's; scanning is optional and off by default; manual analysis is the lowest-risk path; acceptance stores `{ version, acceptedAt }`; a new text version re-shows the screen; revoke turns scheduled scanning off; shown before any scan (tos missing means no tab is opened); EN and ES both carry every statement.
- [ ] 6.22 PRIV-5 manual path stays ungated
  - Files: `tests/integration/manualUngated.test.ts`
  - RED: with `tos: null` and a stale ToS version, `analysis.start` proceeds without the screen; the ToS gate lives only in `canRunPortalStep`.
- [ ] 6.23 Beacons options UI (BEACON-1, BEACON-2, BEACON-3, BEACON-7, SHELL-1)
  - Files: `src/ui/components/beacons/BeaconsSection.tsx`, `src/ui/components/beacons/BeaconForm.tsx`, `wxt.config.ts`, `tests/component/beacons/beaconsSection.test.tsx`
  - RED: create, edit and delete beacons; the cap of 5 enabled; branch selection defaults to all; an interval below 4 h is refused with a message; the empty-filter warning appears when every selected branch has an empty configuration ("every new offer will be analyzed and cost tokens"); enabling the schedule requires ToS acceptance, requests `webRequest` (and `notifications` if opted in) on that gesture and the portal host permission; Scan now, Resume, scan status with "N failed"; flagged rows' Retry action calls `scan.retryFailed`.
- [ ] 6.24 Blocklist help text and Profile-side editing (BEACON-3)
  - Files: `src/ui/components/options/BlocklistEditor.tsx`, `src/ui/i18n/en.ts`, `src/ui/i18n/es.ts`, `tests/component/options/blocklist.test.tsx`
  - RED: the editor shows no default entries; help text states that entries match the whole company name, ignoring case, accents and punctuation (the interpretation pinned in 6.2).

### PR 6-10 - E2E, backup of beacons and seen ids (~330 lines)

- [ ] 6.25 Backup extended to beacons and seen ids (PORT-3, PORT-4; A9)
  - Files: `src/storage/backup/export.ts`, `src/storage/backup/import.ts`, `tests/integration/backupBeacons.test.ts`
  - RED: round-trip includes `beacons` and `seenIds`; `scanState` is excluded; a backup exported with `tos` accepted and the schedule on imports with both off and the ToS screen required before any scan.
- [ ] 6.26 E2E: simulated wall leads to backoff and pause; network audit (BEACON-8, PRIV-1)
  - Files: `tests/e2e/scan.spec.ts`, `tests/e2e/support/routes.ts`
  - RED: a fixture scan with a simulated 429 (`route.fulfill`, or the S3 fallback host-resolver mapping) stops the run, sets a backoff and eventually pauses; the audit shows only allowlisted origins.
- [ ] 6.27 Tracker delete leaves the seen set untouched (TRACKER-4)
  - Files: `tests/integration/trackerDeleteSeen.test.ts`
  - RED: deleting a tracker row does not remove its id from the source's seen set, so it is not re-added by a scan.

### PR 6-11 - Page-content canary E2E, scan flow (~80 lines; amendment A19)

- [ ] 6.30 E2E: search results never steer navigation (PRIV-11, PORTAL-3, PORTAL-6, BEACON-5; ADR-14 item 7; A19)
  - Files: `tests/e2e/canary-scan.spec.ts`, `tests/fixtures/portals/linkedin/search-canary.html`
  - RED (e2e build, request recorder, simulated portal through `context.route`): a search fixture whose card anchors point to `https://canary.invalid/x` while the cards carry valid-looking ids is scanned; expected: zero requests to `canary.invalid`, no tab created or updated with it, no `href` to it in the tracker rows or the scan summary, and every detail navigation goes to `canonicalFor(id)` on the portal host only; a card with an id that fails the pattern is skipped without navigation. Removing the rebuilt-URL step in the driver or the egress allowlist makes the spec fail.

---

## Phase 7: Sub-change 7 `parity-cutover`

### PR 7-1 - InfoJobs adapter, beta (~400 lines)

- [ ] 7.1 InfoJobs registry shapes and fixtures (PORTAL-1, PORTAL-8, PORTAL-9; S3)
  - Files: `src/core/registry.ts`, `tests/unit/core/registry.infojobs.test.ts`, `tests/fixtures/portals/infojobs/*.html`
  - RED: detail URL shape and id extraction as confirmed in S3; query and fragment stripped; idempotent canonical form; `*.infojobs.net` subdomains confirmed in S3.
- [ ] 7.2 InfoJobs adapter, readers, reader bundle (PORTAL-2 to PORTAL-5, PORTAL-9)
  - Files: `src/portals/infojobs/tables.ts`, `src/portals/infojobs/readers.ts`, `src/portals/infojobs/inject.ts`, `src/portals/infojobs/adapter.ts`, `src/entrypoints/reader-infojobs.ts`, `tests/contract/portalAdapter.infojobs.test.ts`
  - RED: the shared adapter contract suite over the InfoJobs fixtures including login, authwall, checkpoint, rate limit and collapsed description; `beta: true`; Scan-now-only if S3 e failed.
- [ ] 7.3 Beta label and origin allowlist (PORTAL-9, SHELL-1)
  - Files: `src/ui/components/beacons/PortalBadge.tsx`, `wxt.config.ts`, `tests/component/portalBadge.test.tsx`, `tests/build/manifest.test.ts`
  - RED: the InfoJobs beta label is rendered; the manifest origin table gains `https://*.infojobs.net/*` (subdomains per S3).

### PR 7-2 - Catalan content (~300 lines)

- [ ] 7.4 Catalan language, warnings and signals (PROFILE-5, ANALYSIS-6, ANALYSIS-7)
  - Files: `src/core/languages.ts`, `src/core/applyWarnings.ts`, `src/core/injectionSignals.ts`, `src/core/analysis/rationaleAudit.ts`, `tests/unit/core/language.ca.test.ts`, `tests/unit/core/applyWarnings.ca.test.ts`, `tests/unit/core/analysis/rationaleAudit.ca.test.ts`
  - RED: synthetic Catalan 40-word text infers `ca`; Catalan directive cues ("inclou", "adjunta") fire the warnings (best effort) with negatives; Catalan injection phrases flagged. Authored fresh. A18: the rationale audit (2a.26) also recognizes Catalan duration unit words and Catalan number words one to twenty (a `5 anys` rationale figure is grounded by `cinc anys` in the offer, ungrounded otherwise); the entries are added to the tables in `src/core/analysis/rationaleAudit.ts` and covered in `tests/unit/core/analysis/rationaleAudit.ca.test.ts`. The same edit bumps `AUDIT_VERSION` from `'audit-1'` to `'audit-2'` and updates the 2a.25 table-hash snapshot; RED: the snapshot fails before the bump; a cached result audited under `'audit-1'` with a `5 anys` rationale figure and no `5`/`cinc` in the offer or profile is re-audited on the hit to 1 ungrounded claim with `auditVersion: 'audit-2'` and `review`/`grounding_downgrade`, without a provider call (ANALYSIS-11 scenario "Audit re-run on a cache hit after an audit table change").
- [ ] 7.5 Language selector offers `ca` (PROFILE-5, SHELL-8)
  - Files: `src/ui/components/options/PdfSection.tsx`, `src/ui/components/options/OutputLanguage.tsx`, `tests/component/options/languageSelector.test.tsx`
  - RED: the PDF language selector and the output-language setting offer `es`, `en`, `ca`; the UI itself stays EN and ES (`ca` UI language falls back to `en`).

### PR 7-3 - CSV history import (~380 lines)

- [ ] 7.6 CSV parser (PORT-5)
  - Files: `src/core/csv.ts`, `tests/unit/core/csvImport.test.ts`
  - RED: auto-detects `,` or `;` from the first non-empty line outside quotes; quoted delimiters and newlines; with or without BOM; line-numbered errors.
- [ ] 7.7 Mapping, keying and import (PORT-5; Contract N)
  - Files: `src/storage/backup/historyImport.ts`, `tests/integration/historyImport.test.ts`
  - RED: columns map to title, company, URL, status, location, date applied, notes; every distinct status value must be mapped before import is allowed; a row with empty title and company is an error and skipped; key is `mapUrl(url)` as `<source>:<id>` or `import:<sha256(fold(title)|fold(company)|date)>`; existing keys skipped and counted as duplicates; rows written with origin `import` and no analysis.
- [ ] 7.8 Import UI and saved mappings (PORT-5; defines `SavedCsvMapping`)
  - Files: `src/core/schemas/csvMapping.ts`, `src/core/schemas/settings.ts`, `src/ui/components/tracker/ImportCsv.tsx`, `tests/component/tracker/importCsv.test.tsx`
  - RED: the preview shows counts and errors; mappings can be saved in `settings.csvMappings` and re-applied; the file is read locally (no network).

### PR 7-4 - Update check (~350 lines; first candidate to defer post-v1, Q9)

- [ ] 7.9 UpdateService (SHELL-10)
  - Files: `src/background/services/update.ts`, `src/core/semver.ts`, `src/core/schemas/settings.ts`, `tests/integration/updateService.test.ts`
  - RED (fake clock, fake fetch): off by default, so after 48 h no request is made; when enabled, a daily `update-check` alarm calls `GET https://api.github.com/repos/<owner>/<repo>/releases/latest` with `credentials: 'omit'`; skipped if the last check is under 24 h old (3 h limit scenario); a newer semver stores `latest` and shows a notice with the release URL; nothing is downloaded; offline records `lastResult: 'failed'` with no retry before the next 24 h window; requires the optional `api.github.com` permission; `update.checkNow` limited to once per 24 h.
- [ ] 7.10 Update notice UI and origin allowlist (SHELL-10, SHELL-1)
  - Files: `src/ui/components/options/UpdateSection.tsx`, `wxt.config.ts`, `tests/component/options/updateSection.test.tsx`, `tests/build/manifest.test.ts`
  - RED: opt-in toggle requests the host permission on the gesture; the notice links to the release; manifest origin table gains `https://api.github.com/*`.

### PR 7-5 - Release scripts (~380 lines)

- [ ] 7.11 `check-version` (SHELL-6)
  - Files: `scripts/check-version.ts`, `tests/unit/scripts/checkVersion.test.ts`
  - RED: tag, `package.json` and manifest versions must be equal; mismatches fail naming the file.
- [ ] 7.12 `check-zip` (SHELL-6)
  - Files: `scripts/check-zip.ts`, `tests/unit/scripts/checkZip.test.ts`
  - RED: manifest at the zip root; no `tests/`, `spikes/`, `.env*` or source maps; both Chrome and Edge zips.
- [ ] 7.13 `check-docs` (SHELL-9, SHELL-11, PRIV-6)
  - Files: `scripts/check-docs.ts`, `package.json`, `tests/unit/scripts/checkDocs.test.ts`
  - RED: required docs and sections exist: PRIVACY and README state what is stored locally, what is sent to which party and when, the unencrypted key, no telemetry, the portal terms-of-service risk for manual analysis, and the prompt-injection residual risk; the release-notes template has an "Edge smoke:" field; add `check:docs` to `ci.yml` (extend `tests/build/workflows.test.ts`).

### PR 7-6 - Release workflow and docs (~350 lines)

- [ ] 7.14 Release workflow (SHELL-6, SHELL-11; ADR-27)
  - Files: `.github/workflows/release.yml`, `.github/release-notes-template.md`, `tests/build/workflows.test.ts`
  - RED: trigger on tag `v*`; steps check-version, full CI steps, `wxt zip` and `wxt zip -b edge`, check-zip, sha256 sums, `actions/attest-build-provenance` on both zips, draft release from the template; `contents: write`, `id-token: write`, `attestations: write` only in the release job; actions SHA-pinned.
- [ ] 7.15 Full public docs (SHELL-9, PRIV-6, ADR-27)
  - Files: `README.md`, `PRIVACY.md`, `SECURITY.md`, `docs/tos-risk.md`, `docs/release-checklist.md`, `CHANGELOG.md`
  - Do: install to a stable folder and Load unpacked, `gh attestation verify`, updating by extracting over the same folder, key threat model and prompt-injection residual risk, ToS risk, the release checklist with the Edge smoke step. `check-docs` (7.13) is green.
- [ ] 7.16 README media (ADR-27)
  - Files: `docs/media/screenshot-review-card.png`, `docs/media/demo.gif`, `tests/e2e/media.spec.ts`
  - Do: captured by a Playwright run over synthetic fixtures only; binaries covered by the repository policy allowlist (hash added to `tests/fixtures/binary/ALLOWLIST` only if stored under `tests/fixtures/binary/`, otherwise an explicit policy exception for `docs/media/` is added to `scripts/check-repo-policy.ts` with its RED test).

### PR 7-7 - Parity run, Edge smoke, v1.0 cut (~250 lines)

- [ ] 7.17 Parity run against the bot (owner-run; proposal criteria)
  - Files: `docs/parity-report.md`
  - Do: owner runs the proposal's parity criteria (including "no apply-labelled offer rejected") over a representative set and records results; local, uses the owner's key and data, none committed.
- [ ] 7.18 Edge smoke and release candidate checks (SHELL-11)
  - Files: `docs/release-checklist.md`
  - Do: manual Edge smoke recorded in the release-notes "Edge smoke:" field of the draft release.
- [ ] 7.19 Version 1.0.0 (SHELL-6)
  - Files: `package.json`, `CHANGELOG.md`
  - Do: version bump and CHANGELOG entry; `check-version` green.
- [ ] 7.20 Archive-time ADR export (ADR-27)
  - Files: `docs/adr/0001-functional-core-imperative-shell.md`
  - Do: at archive of `extension-v1`, generate one MADR-style file per ADR (ADR-01..ADR-28) from `design.md`; later changes add new ADR files. This task runs during `sdd-archive`, not before.

---

## Notes

- Judgment-day r1 suspects that were not adopted into the design are not tasks: lease recovery latency and the alarm backstop, tab-less side-panel permission URL reading beyond ADR-10, per-beacon seen ids (seen stays per source), single settings-object lost-update race, `maxOutputTokens` in design constants (set a conservative value in the adapters during 2b-2 and 2b-3 and record it in the PR), price-catalog cache-write price. Raise any of them as a separate change.
- Open product items carried from the design: product display name for the manifest and README (set in 0.19 as a placeholder and finalized before 7-6); Q1-Q15 defaults are assumed throughout.
- Spec amendments A1-A21 are already applied to the specs (A18 ANALYSIS-11, A19 PRIV-11, A20 PORTAL-11, A21 SHELL-12; the tasks for A18-A21 are 0.29-0.34, 2a.25-2a.32 plus in-place edits of 2a.4, 2a.6, 2a.11, 2a.17, 2a.20, 2a.21, 4.8, 4.11, 4.12, 4.18-4.24, 6.12, 6.17, 6.28-6.30 and 7.4); no task edits `specs/` except 1.4 when a spike fails.
- Review follow-up R3 (review of 6733d73, 2026-10-18) edited tasks in place without new IDs: 0.33 and 0.34 (egress lint scope and the fifth allowlisted path `src/ui/lib/openBlob.ts`), 2a.4 (`auditVersion`), 2a.11 (verdict input never includes rationale text), 2a.17 (pass-through replaced by step 9b in 2a.27), 2a.25 and 2a.26 (numeric parsing table, `AUDIT_VERSION` snapshot), 2a.27 (audit re-run on every result), 3.13 (`openBlob`), 4.13 (open control uses `openBlob`), and 7.4 (`AUDIT_VERSION` bump to `'audit-2'`). Line forecasts are unchanged within the advisory heuristic; 2a-7 grows by roughly 40-60 lines.
