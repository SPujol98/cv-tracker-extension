# Judgment Day — extension-v1 planning artifacts — round 1 ledger

Target identity: sha256 89983b3df67327d085092ce72093e6b42babc52e92ecc1e2c796e5e28b9be412 (proposal.md, design.md, specs/*, explore.md as of 2026-10-10)
Judges: jd-judge-a, jd-judge-b (blind, parallel, identical scope). Skill: cognitive-doc-design.

## Confirmed by both judges
| ID | Severity (A / B) | Finding | Status |
|---|---|---|---|
| JD-1 | WARNING / CRITICAL | Dependency inversion broken: port types (LlmProvider, ProviderError, LlmErrorClass, Usage, CompletionRequest; SourceId, PageState, ReadResult, classify) live in src/providers / src/portals but are consumed by src/core, which may not import them → architecture test fails or core loses purity. Fix: ports and shared types owned by core. | severe-confirmed — awaiting owner OK for fix |
| JD-2 | SUGGESTION / SUGGESTION | Full hexagonal = over-engineering; plan is functional core + imperative shell with ports only where ≥2 implementations (LLM, portals); state it in an ADR; no repository ports over Dexie. | info |
| JD-3 | SUGGESTION / SUGGESTION | AnalysisStrategy / PipelineStrategy is speculative (one implementation). | info |
| JD-4 | WARNING / WARNING | "A crash never double-charges" is false; mid-stream crash bills without usage record → budget undercount. Pre-call estimated usage row + reconcile. | info |
| JD-5 | WARNING / WARNING | Key validation: restricted/spend-limited keys may 403 on /v1/models → rejected; 'unverified' stored keys are unusable (G1/isProfileComplete require valid). | info |
| JD-6 | WARNING / WARNING | Backup import restores tos, scheduleEnabled, keyStatus (no key) → consent/scan re-enabled without gesture, inconsistent state. | info |
| JD-7 | WARNING / WARNING | Walls: 3-char grounding floor + absolute veto → trivial fragments can force skip; conflicts with parity "no apply-labelled offer rejected". | info |
| JD-8 | SUGGESTION / WARNING | Prompt-injection residual risk: score/wall selection model-trusted; document + downgrade apply when injection signals. | info |
| JD-9 | SUGGESTION / WARNING | Background (inactive) tab throttling/discard not in S3; unreadable_shell counted as a wall → DOM breakage drives 24h pause. | info |
| JD-10 | WARNING / WARNING | Size forecast ~2x low; foundation/engine overloaded; stall risk. | info |
| JD-11 | SUGGESTION / SUGGESTION | Custom tooling duplicates maintained tools (dependency-cruiser/Biome, gitleaks/secretlint). | info |
| JD-12 | SUGGESTION / SUGGESTION | Portfolio gaps: docs/adr + architecture overview, SECURITY.md, Dependabot/Renovate, audit/provenance, README screenshots; remove process residue ("Revision 2", "validator fix"). | info |
| JD-13 | SUGGESTION / SUGGESTION | 'fake' provider in production ProviderId union / bundle. | info |
| JD-14 | SUGGESTION / SUGGESTION | chrome.storage.local.setAccessLevel('TRUSTED_CONTEXTS') missing. | info |

## Suspect (one judge only — not auto-fixed)
A: lease-based recovery leaves jobs running up to 5 min after restart + no alarm backstop for ≤25 s wakes; side-panel permission request needs a URL it cannot read without tabs/host permission; cache hit returns stale PDF/derived fields; IndexedDB cannot index null (viewedAt); import not quiesced vs running queue; scan run-completion/summary job undefined; canonicalUrl must be https; truncation (head-only 11k cap) drops apply warnings at the end; unreadable_shell single retry; first-scan baseline UX copy.
B: redact/shared/entrypoints missing from boundary table, portal host table not single-sourced; provider contract suite can't apply transport assertions to fake, retry/timeout duplicated in both adapters, hasPermission mixes concerns; single settings object lost-update race; failed scan offers burned as seen; seen per source not per beacon; host permissions need *.linkedin.com subdomains; E2E can't click action/accept permission prompts; compiled price catalog staleness + no cache-write price; backup arrives after real data (sub-change 5) + rollback statement wrong; fit entries keep claimIds only; openspec/.atl/.engram expose private reference names if published; vitest build project/CI order; maxOutputTokens missing from constants.

## Contradictions
None.

## Round 1 outcome (2026-10-10)
- JD-1 fixed in 0a49527 (jd-fix-agent). Scoped re-judgment (both judges, on exported immutable delta + design-at-0a49527 + ledger): JD-1 resolved; no CRITICAL/HIGH; fix-caused minor wording defects (ProviderId owner, PortalReaders DOM in core, ClassifyTables unnamed, generic tables, sub-change row 4, Clock placement) folded into a7ee7b2.
- Owner-approved ordinary design adjustments (JD-2..14 + suspects a–e) applied in a7ee7b2; spec amendments A6–A17 and proposal notes P1–P5 to be applied before sdd-tasks.
- JUDGMENT: APPROVED ✅
