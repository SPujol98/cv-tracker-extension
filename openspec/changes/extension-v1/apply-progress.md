# Apply Progress: extension-v1

Cumulative state of the apply phase. Each batch merges into this file; completed tasks from earlier batches are never dropped.

## Status

- Tasks complete: 27 of 171 (0.1-0.27; 0.28 documentation done, enabling branch protection is an owner action). Next unit: sub-change 1 (spikes).
- Mode: Strict TDD from task 0.3 onward (`strict_tdd: true`, runner `vitest`, command `pnpm test`). Tasks 0.1-0.3 follow the foundation bootstrap exception from `tasks.md` (the runner and the flag flip are created by these tasks).
- Delivery: `auto-chain`, chain strategy `stacked-to-main`. This batch is slice 0a on branch `feat/0a-toolchain` (local only, not pushed, no PR opened).

## Batch 1: PR 0a - Runner, strict TDD flip, Biome base

### Completed tasks

- [x] 0.1 Scaffold the toolchain (SHELL-7)
- [x] 0.2 RED: config assertion test (SHELL-7)
- [x] 0.3 GREEN: flip strict TDD in the OpenSpec config (SHELL-7)
- [x] 0.4 RED then GREEN: Biome base rules (SHELL-5, PRIV-4)

### Commits (branch `feat/0a-toolchain`, base `main` at `cac12df`)

| Commit | Tasks | Message |
|---|---|---|
| `449d14c` | 0.1 | `build: scaffold pnpm, WXT, strict TypeScript and Vitest toolchain` |
| `24746a5` | 0.2, 0.3 | `test(config): activate strict TDD in the OpenSpec config` |
| `6eb97a7` | 0.4 | `build(lint): add Biome base rules with fixture tests` |
| (this commit) | tracking | `docs(openspec): record apply progress for slice 0a` |

The RED test (0.2) and its GREEN config flip (0.3) share one commit so the branch never carries a failing test, which keeps tests with the behavior they verify.

### TDD Cycle Evidence

| Task | Test file | RED (observed) | GREEN (observed) | REFACTOR |
|---|---|---|---|---|
| 0.1 | none (bootstrap exception) | Runner proof: `pnpm test` exit 1, `No test files found, exiting with code 1` | `pnpm typecheck` exit 0 (`wxt prepare && tsc --noEmit`); a deliberate type error in a probe file made `tsc` exit 1, then the probe was removed | Slimmed `tsconfig.json` to the keys WXT's generated base does not already set |
| 0.2 | `tests/build/config.test.ts` | `pnpm vitest run tests/build/config.test.ts`: exit 1, 3 failed / 1 passed. Failures: `strict_tdd` received `false`; `testing` received `status: 'to-be-set-up'`, no `runner`, empty `test_command`/`linter`/`type_checker`/`formatter`, `coverage: false`; `rules.apply.test_command` received `""`. The `scripts.test === "vitest run"` assertion already passed from 0.1 | see 0.3 | none |
| 0.3 | `tests/build/config.test.ts` | see 0.2 | Same command: exit 0, 4 passed | Refreshed the stale `context` lines and the two comments in `openspec/config.yaml` |
| 0.4 | `tests/lint-fixtures/biome-base.test.ts` | `pnpm vitest run tests/lint-fixtures/biome-base.test.ts` with no `biome.json`: exit 1, 2 failed / 2 passed. Failed: `noDangerouslySetInnerHtml` fixture exited 0 (rule is gated by the React domain and was not enabled), and the `biome.json` pin assertion (`ENOENT`). Passed already: `eval` fixture (Biome's default recommended set flags `noGlobalEval`) and the clean fixture | Same command with the final config: exit 0, 5 passed. Mutation checks: removing the fixture exclusion failed only the exclusion test; setting `noGlobalEval` to `off` failed the eval and pin tests | Replaced the deprecated `recommended: true` with `preset: "recommended"`; replaced the `*/**` ignore glob (flagged by `useBiomeIgnoreFolder`) with an explicit folder |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/build/config.test.ts tests/lint-fixtures/biome-base.test.ts`: exit 0, 2 files passed, 9 tests passed |
| Runtime harness command/scenario and exact result | `pnpm test`: exit 0, 2 files, 9 tests. `pnpm typecheck`: exit 0. `pnpm lint`: exit 0, `Checked 10 files`, no diagnostics. Real Biome process spawned on the three fixtures (positive fail with the rule id, negative passes) |
| Rollback boundary | `git revert` of the three slice commits restores the empty repository: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, `tsconfig.json`, `wxt.config.ts`, `vitest.config.ts`, `biome.json`, `src/entrypoints/background.ts`, `tests/setup`, `tests/build/config.test.ts`, `tests/lint-fixtures/**`, the `.gitignore` additions, and the `openspec/config.yaml` values |

### Files changed

| File | Action | What was done |
|---|---|---|
| `package.json` | Created | Private ESM package, `packageManager: pnpm@12.11.2`, engines, scripts `dev`, `build`, `typecheck`, `lint`, `format`, `test`; exact pins for every devDependency (wxt 0.21.4, typescript 7.0.2, vitest 5.0.3, @biomejs/biome 2.5.15, fake-indexeddb 6.2.5, jsdom 30.1.2, yaml 2.9.1, @types/node 26.6.5) |
| `pnpm-lock.yaml` | Created | Generated; excluded from the authored line count |
| `pnpm-workspace.yaml` | Created | pnpm 12 settings: `savePrefix: ''`, `engineStrict: true` |
| `.npmrc` | Created | Pins the public npm registry |
| `.gitignore` | Modified | Kept `.atl/`, `.engram/`, `openspec/changes/extension-v1/explore.md`; added `node_modules/`, `.output/`, `.wxt/`, `coverage/`, `playwright-report/`, `test-results/`, `.privacy-denylist.txt`, `*.pem`, `.env*` |
| `tsconfig.json` | Created | Extends the WXT-generated config; `strict`, node types; excludes lint fixture trees |
| `wxt.config.ts` | Created | Minimal config with `srcDir: 'src'` |
| `vitest.config.ts` | Created | `WxtVitest()` plus projects node, jsdom, build, lint-fixtures; shared setup file |
| `tests/setup/vitest.setup.ts` | Created | Loads `fake-indexeddb/auto` |
| `src/entrypoints/background.ts` | Created | Empty `defineBackground` stub (see deviations) |
| `tests/build/config.test.ts` | Created | RED/GREEN assertions for the SHELL-7 activation values |
| `openspec/config.yaml` | Modified | Strict TDD on, `testing.*` populated with the new `runner` key, apply/verify commands, refreshed context and comments |
| `biome.json` | Created | VCS-aware, formatter (2 spaces, single quotes, width 100), recommended preset, the two security rules pinned to error, fixture folder excluded |
| `tests/lint-fixtures/biome-base.test.ts` | Created | Spawns Biome on the fixtures; pins the rules; checks the exclusion |
| `tests/lint-fixtures/biome.fixtures.json` | Created | Extends `biome.json` and re-includes fixtures for the test |
| `tests/lint-fixtures/biome/{eval.positive.ts,innerhtml-react.positive.tsx,clean.negative.ts}` | Created | Positive and negative fixtures |
| `openspec/changes/extension-v1/tasks.md` | Modified | Marked 0.1-0.4 as `[x]` |

### Deviations from design and tasks

1. `pnpm-workspace.yaml` was added (not listed in the task files). pnpm 12 does not read `save-exact` or `engine-strict` from `.npmrc`; both were verified empirically (caret saved, unsupported engine accepted). `.npmrc` therefore only pins the registry, and pnpm settings live in `pnpm-workspace.yaml`.
2. `src/entrypoints/background.ts` was created in 0.1 although task 0.19 lists it as Create. `wxt prepare` fails with "No entrypoints found" otherwise, and 0.1 requires `pnpm typecheck` to pass on the skeleton. Task 0.19 now modifies this file instead of creating it.
3. `node_modules/` was added to `.gitignore` in addition to the entries task 0.1 lists.
4. `WxtVitest` is imported from `wxt/testing/vitest-plugin`; the `wxt/testing` specifier does not exist in WXT 0.21.4.
5. `tests/lint-fixtures/biome.fixtures.json` was added (not listed). `biome.json` excludes the fixture folder, and Biome refuses explicitly passed ignored paths ("No files were processed"), so the test lints through a config that extends `biome.json` and re-includes the fixtures.
6. The 0.4 test has two assertions beyond the three listed behaviors: the config pin (`noGlobalEval` and `noDangerouslySetInnerHtml` at `error`) and the exclusion check. The pin exists because the eval rule is already on by default, so without it the eval RED could never fail on a missing config.
7. `biome.json` excludes fixture folders one by one (`!tests/lint-fixtures/biome`). The generic `!tests/lint-fixtures/*/**` glob works but triggers the `useBiomeIgnoreFolder` warning, and `!tests/lint-fixtures/*` would also exclude the test files that live directly in `tests/lint-fixtures/`.

### Issues found and risks for later slices

- **Biome stdin mode (affects tasks 0.5 and later).** In Biome 2.5.15, `biome lint --stdin-file-path=<path>` prints no per-rule diagnostics: the output is always the generic "The contents aren't fixed" error with exit 1, even for clean content, and `--write` exits 0 for violating content. Task 0.5 plans `--stdin-file-path=src/core/x.ts`; it needs another mechanism, for example copying the fixture to a temporary directory under the virtual path with a config that extends `biome.json`, or `--config-path` plus real files.
- **Biome ignored paths.** Every new fixture folder under `tests/lint-fixtures/` needs its own `!` line in `biome.json` (and is already excluded from `tsc` by the generic `tests/lint-fixtures/*/**` entry). Forgetting it makes `pnpm lint` fail loudly.
- **Toolchain versions.** The registry's current majors were used: TypeScript 7.0.2 (native compiler; `tsc --noEmit` works with the WXT-generated tsconfig), Vitest 5.0.3 and Vite 8 (via WXT), pnpm 12.11.2. All verified green here; a version-related surprise in later slices is possible but none was seen.
- **WXT build.** `pnpm build` was not run in this slice (it is not part of the 0a verification and there is no manifest configuration yet); build verification starts in slice 0d.
- **Install scripts.** The install output reported no ignored build scripts, so no `onlyBuiltDependencies` setting was added.

### Remaining tasks

- [ ] 0.10-0.17 (PR 0c), 0.18-0.23 (PR 0d), PR 0e, then sub-changes 1 to 7 as listed in `tasks.md`

### Workload / PR boundary

- Mode: stacked PR slice (`auto-chain`, `stacked-to-main`), slice 0a, target `main`.
- Boundary: starts at `main` (`cac12df`, planning commit only) and ends with the Biome base commit plus this tracking commit.
- Review budget: 287 authored changed lines in the three code commits (271 additions, 16 deletions; lockfile excluded). Forecast was about 250; the overage is the config pin and exclusion tests, the fixtures config, and the toolchain files. Under the 400-line budget.

## Batch 2: PR 0b - Layer boundaries and source-ban plugins

Branch `feat/0b-boundaries`, created from `feat/0a-toolchain` (stacked-to-main). Local only, not pushed, no PR opened.

### Completed tasks

- [x] 0.5 Biome `src/core/**` globals override (ADR-01, ADR-23)
- [x] 0.6 GritQL plugin: dynamic code and raw HTML sinks (SHELL-5, PRIV-4)
- [x] 0.7 GritQL plugin: `navigator.sendBeacon` ban (PRIV-2)
- [x] 0.8 GritQL plugin: forbidden portal strings only in the guard (PORTAL-6)
- [x] 0.9 dependency-cruiser layer rules (ADR-01, Module Boundaries)

### Commits

| Commit | Tasks | Message |
|---|---|---|
| `6c9ca68` | 0.5 | `build(lint): forbid browser globals in src/core with a Biome override` |
| `f0b7113` | 0.6 | `build(lint): ban new Function and raw HTML sinks with GritQL plugins` |
| `0de8945` | 0.7 | `build(lint): ban navigator.sendBeacon with a GritQL plugin` |
| `043e18c` | 0.8 | `build(lint): confine forbidden portal strings to the navigation guard` |
| `c11fcda` | 0.9 | `build(deps): enforce layer boundaries with dependency-cruiser` |
| (this commit) | tracking | `docs(openspec): record apply progress for slice 0b` |

### TDD Cycle Evidence

| Task | Test file | RED (observed) | GREEN (observed) | REFACTOR |
|---|---|---|---|---|
| 0.5 | `tests/lint-fixtures/core-globals.test.ts` | Without the override: 8 failed / 8 passed (every `src/core` case failed, every `src/background` case passed). A first harness run failed all 16 because of Biome's VCS root lookup in the temp tree; fixed with `vcs.enabled: false` before taking the RED | 16 passed | Plugin directory copied into the temp tree once the plugins existed (see 0.6) |
| 0.6 | `tests/lint-fixtures/gritql-html.test.ts` | Without the plugins: 5 failed (all positives) / 1 passed | 6 passed. First GREEN attempt exposed a false pass: plugin paths failed to load and the load error text still contained the rule names. Fixed by moving `biome.fixtures.json` to the repo root and asserting the output never contains `during loading of plugins` | Added the load-error guard to the test |
| 0.7 | `tests/lint-fixtures/gritql-beacon.test.ts` | 2 failed (both positives) / 1 passed | 3 passed | none |
| 0.8 | `tests/lint-fixtures/gritql-portal.test.ts` | 3 failed (rejections) / 3 passed (the exemption and clean cases pass vacuously before the plugin exists). During GREEN the exemption cases failed twice (regex capture groups, then plugin `includes` globs without `**/`), proving they are sensitive | 6 passed | Guard files receive all three forbidden strings (appended) so the exemption is tested against each |
| 0.9 | `tests/lint-fixtures/depcruise.test.ts` | No `.dependency-cruiser.cjs`: all 28 cases failed (`Can't open config file`). After the config, 24 failed because dependency-cruiser resolved the repo root instead of the fixture tree and then cruised zero modules | 30 passed (after the `--dir` fix, the swc parser, and two extra cases for the `portals-chrome` rule) | Conforming cases assert a non-zero module count so a silent empty run cannot pass |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/lint-fixtures`: exit 0, 6 files, 66 tests passed (70 tests across the whole suite) |
| Runtime harness command/scenario and exact result | Real Biome processes on fixture trees (config extending `biome.json`), real `depcruise` processes on generated source trees. `pnpm test` 7 files / 70 passed; `pnpm typecheck` exit 0; `pnpm lint` exit 0 (`Checked 20 files`); `pnpm depcruise` exit 0 (`no dependency violations found (2 modules, 1 dependencies cruised)`) |
| Rollback boundary | `git revert` of the five slice commits: `biome.json` plugins and override, `biome-plugins/**`, `.dependency-cruiser.cjs`, `biome.fixtures.json` (moved back to `tests/lint-fixtures/`), the `depcruise` script, `@swc/core` and `dependency-cruiser` dev dependencies, the `allowBuilds` entry, and the new fixture tests |

### Files changed

| File | Action | What was done |
|---|---|---|
| `biome.json` | Modified | `overrides` entry for `src/core/**` (`style/noRestrictedGlobals` with the eight denied globals), `plugins` array with the four GritQL plugins (the portal one with a guard-exempting `includes`), two new fixture exclusions; reformatted by Biome |
| `biome.fixtures.json` | Moved | From `tests/lint-fixtures/` to the repo root (see deviations) |
| `biome-plugins/*.grit`, `biome-plugins/README.md` | Created | Four plugins and the decision record |
| `.dependency-cruiser.cjs` | Created | Eleven forbidden rules from Module Boundaries |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` | Modified | `depcruise` script, exact pins `dependency-cruiser` 18.5.0 and `@swc/core` 1.16.13, `allowBuilds` for `@swc/core` set to false |
| `tests/lint-fixtures/{core-globals,gritql-html,gritql-beacon,gritql-portal,depcruise}.test.ts` and fixture folders `core-globals/`, `gritql/`, `gritql-portal/` | Created | Tests and fixtures |
| `tests/lint-fixtures/biome-base.test.ts` | Modified | Points at the moved `biome.fixtures.json` |

### Deviations from design and tasks

1. **Stdin mode replaced (0.5, 0.8).** As predicted in slice 0a, `--stdin-file-path` is unusable. Tests copy fixtures into a temp tree that mirrors `src/core`, `src/background`, `src/portals`, `tests/unit/core`, with a `biome.json` that extends the repository config (`vcs.enabled: false`) and a copy of `biome-plugins/`, then lint the real files via `--config-path`.
2. **`biome.fixtures.json` moved to the repo root.** Biome resolves plugin paths (including inherited ones) against the directory of the loaded config, so the fixtures config must sit next to `biome-plugins/`.
3. **GritQL covered every pattern.** No `scripts/check-ast-bans.ts` fallback was needed; the decision is recorded in `biome-plugins/README.md`. The design open question is closed.
4. **Plugin `includes` globs need `**/`.** `!src/core/guard.ts` was silently ignored by Biome 2.5.15; `!**/src/core/guard.ts` works (recorded in the README). The exemption lives on the plugin entry, not in an override, because overrides cannot remove a plugin.
5. **0.9 fixtures are generated, not committed trees.** The test builds each violating source tree in a temp directory from a case table instead of committing `tests/lint-fixtures/depcruise/**`. Same coverage (20 violation cases, 5 conforming cases, relative-path bypass included) with far fewer files.
6. **`@swc/core` added (not in the task).** dependency-cruiser 18.5.0 supports TypeScript below 7 only; with TypeScript 7.0.2 it cruises zero TypeScript modules and reports "no violations". `options.parser: 'swc'` makes it work. `allowBuilds: '@swc/core': false` keeps `pnpm install` from failing on the ignored postinstall (swc ships prebuilt binaries). dependency-cruiser still prints a `missing-typescript-transpiler` notice for TypeScript 7; it is harmless and drops out when it supports TS 7.
7. **Extra rules.** Besides the task list, rules `providers-restricted`, `portals-restricted`, `portals-chrome` (chrome allowed only in `src/portals/*/inject.ts`), and `background-restricted` encode the rest of the Module Boundaries table. The reverse direction of the providers/portals rule is its own rule name (`portals-providers-separate`).

### Issues found and risks for later slices

- **dependency-cruiser and TypeScript 7.** If `@swc/core` is dropped or the parser option is removed, `pnpm depcruise` silently passes with zero modules. The fixture tests catch this (module-count assertion); the real run reports its module count.
- **Plugin vacuity.** Any future fixture test for a GritQL plugin must assert the absence of `during loading of plugins`.
- **The 0.8 plugin matches string and template literals only.** A forbidden path built by concatenation across literals, or a regex literal, is not seen; the guard (2a) is the runtime defence.
- **New fixture folders** still need their own `!` line in `biome.json` (added for `core-globals`, `gritql`, `gritql-portal`).

### Workload / PR boundary

- Mode: stacked PR slice (`auto-chain`, `stacked-to-main`), slice 0b, targets branch `feat/0a-toolchain` until PR #1 merges, then `main`.
- Boundary: starts at the slice 0a tip (`88f5c2c`) and ends with the dependency-cruiser commit plus this tracking commit.
- Review budget: about 299 authored changed lines in the five code commits (287 additions, 12 deletions; lockfile excluded). Under the 400-line budget.

## Batch 3: PR 0c (partial) - Repo policy check, tasks 0.10-0.14

Branch `feat/0c-repo-policy`, created from `feat/0b-boundaries` (stacked-to-main). Local only, not pushed, no PR opened. The slice stopped at a clean task boundary after 0.14 because tasks 0.10-0.14 alone are 481 authored lines (over the 400 budget). Tasks 0.15-0.17 are left for a follow-up slice (suggested name `feat/0c2-deps-secretlint-hook`, stacked on this branch).

### Completed tasks

- [x] 0.10 RED: documentation-like paths (cases 1-5; case 6 moves to 0.16)
- [x] 0.11 RED: git repository selection
- [x] 0.12 RED: commit state
- [x] 0.13 GREEN: repo policy check, all-files mode
- [x] 0.14 GREEN: repo policy check, staged mode

### Commits

| Commit | Tasks | Message |
|---|---|---|
| `e125182` | 0.10-0.14 | `build(policy): add repo policy check with denylist, vendored-dir and binary rules` |
| (this commit) | tracking | `docs(openspec): record apply progress for slice 0c part 1` |

RED tests share the commit with their GREEN implementation so the branch never carries failing tests.

### TDD Cycle Evidence

| Task | Test file | RED (observed) | GREEN (observed) | REFACTOR |
|---|---|---|---|---|
| 0.10 | `tests/unit/repo-policy/docs-paths.test.ts` | `pnpm vitest run tests/unit/repo-policy` with no script: 15 failed / 2 passed across the 3 task files; every spawned process reported `MODULE_NOT_FOUND` for `scripts/check-repo-policy.ts`. The 2 passes were vacuous (they only assert exit 1) | 17 passed after `scripts/check-repo-policy.ts` | none |
| 0.11 | `tests/unit/repo-policy/repo-selection.test.ts` | same run | same | none |
| 0.12 | `tests/unit/repo-policy/commit-state.test.ts` | same run | same | none |
| 0.13 | `policy-modes.test.ts` (added as triangulation for hashed mode, vendored block, manifest rule, usage) | Written after the script, so no RED. Sensitivity check by mutation: disabling the manifest, `extension` segment and hashed-token checks failed 3 of 8 tests | 25 passed | Biome formatting only |
| 0.14 | `commit-state.test.ts` | same as 0.12 | same as 0.12 | none |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/unit/repo-policy`: exit 0, 4 files, 25 tests passed |
| Runtime harness command/scenario and exact result | Real `node scripts/check-repo-policy.ts` processes against throwaway git repos (including a linked worktree and an alternate `GIT_INDEX_FILE`). `pnpm check:repo-policy --all` on this repository: exit 0 |
| Rollback boundary | `git revert e125182`: `scripts/check-repo-policy.ts`, `tests/unit/repo-policy/**`, `tests/fixtures/binary/ALLOWLIST`, the `check:repo-policy` script |

### Deviations

1. Case 6 of 0.10 (real-looking email fails secretlint) is deferred to task 0.16, where `.secretlintrc.json` exists; adding it earlier would commit a failing test.
2. Extra test file `policy-modes.test.ts` (not in the task list) covers the GREEN behavior of 0.13 that no listed RED test exercises: hashed denylist, fork notice, vendored block, manifest rule, usage errors.
3. The script is run as `node scripts/check-repo-policy.ts` (native TypeScript type stripping, no extra dependency). `engines.node` is `>=22.12`, where type stripping needs a flag; CI must use Node 22.18+ or 24+ (decide in 0e). Local runtime is Node 26.
4. The denylist report names the matching entry by position (`entry #N`), never by value, so output cannot leak a term. Path names are scanned as text too.
5. The hashed mode tokenizes content into words and hashes each; multi-word denylist terms are only supported in the local plain-text mode.
6. Slice size: 481 authored lines (all additions) for 0.10-0.14, over the 400 budget; stopped here instead of adding 0.15-0.17. No `size:exception` requested for this slice; recommend reviewers accept it as a cohesive unit or request a split of the test files.

### Remaining tasks

- (done in Batch 4) 0.15, 0.16, 0.17
- [ ] 0.18-0.23 (PR 0d), PR 0e, then sub-changes 1 to 7

### Workload / PR boundary

- Mode: stacked PR slice (`auto-chain`, `stacked-to-main`), slice 0c part 1, targets `feat/0b-boundaries` until PR #2 merges.
- Review budget: 481 authored changed lines.

## Batch 4: PR 0c part 2 - Deps check, secretlint, hook, tasks 0.15-0.17

Branch `feat/0c2-deps-secretlint-hook`, created from `feat/0c-repo-policy` (stacked-to-main). Local only, not pushed, no PR opened.

### Completed tasks

- [x] 0.15 Telemetry dependency check (PRIV-2)
- [x] 0.16 secretlint rules (PRIV-8, PORTAL-10), including the deferred 0.10 case 6
- [x] 0.17 Pre-commit hook, PR template, clean-room attestation (PRIV-9, PRIV-10)

### Commits

| Commit | Tasks | Message |
|---|---|---|
| `5924d2f` | 0.15 | `build(deps): fail on telemetry packages in manifest and lockfile` |
| `6a29aeb` | 0.16 (+0.10 case 6) | `build(privacy): add secretlint rules for keys, emails, phones and national IDs` |
| `970bd13` | 0.17 | `build(hooks): add pre-commit hook, lint-staged config and PR attestation template` |
| (this commit) | tracking | `docs(openspec): record apply progress for slice 0c part 2` |

### TDD Cycle Evidence

| Task | Test file | RED (observed) | GREEN (observed) | REFACTOR |
|---|---|---|---|---|
| 0.15 | `tests/unit/check-deps.test.ts` | `pnpm vitest run tests/unit/check-deps.test.ts` with no script: 5 failed / 0 passed | 5 passed. First GREEN attempt failed on the real lockfile (pnpm 12 writes two YAML documents; `parse` threw); fixed with `parseAllDocuments` | Biome formatting only |
| 0.16 | `tests/unit/secretlint-rules.test.ts`, `tests/unit/repo-policy/docs-paths.test.ts` (case 6) | No `.secretlintrc.json`: 21 failed (all, negatives included, because the missing config is an error exit) | 28 passed. Iterations on the real repo: email regex matched `pnpm@12.11.2` (fixed with an alphabetic TLD), `+1 555 010 0000` in a spec (555 area code now reserved) | Samples assembled at runtime so test files never hold a literal match |
| 0.17 | `tests/unit/hook-config.test.ts` | No config files: 7 failed / 0 passed | 7 passed, including a real `git commit` in a temp repo: the staged synthetic key is blocked (non-zero exit, key absent from output, zero commits) and a clean change commits | none |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/unit`: 6 files passed, 51 tests passed |
| Runtime harness command/scenario and exact result | Real `secretlint`, `lint-staged` and `git commit` processes in temp repos. `pnpm test` 128 passed; `pnpm typecheck`, `pnpm lint` (36 files), `pnpm depcruise`, `pnpm check:repo-policy --all`, `pnpm check:deps`, `pnpm secretlint` all exit 0. The new pre-commit hook ran on the 0.17 commit itself and passed |
| Rollback boundary | `git revert` of the three commits: `scripts/check-deps.ts`, `scripts/telemetry-denylist.json`, `.secretlintrc.json`, `.secretlintignore`, `.lintstagedrc.json`, `.github/pull_request_template.md`, the new tests and fixtures, the dev dependencies and scripts |

### Deviations

1. `.secretlintignore` added (not listed): ignores build output, `pnpm-lock.yaml`, and the PRIV-8 spec file (`privacy-safeguards/spec.md`), which quotes a real-looking address as its scenario input.
2. `pnpm-workspace.yaml`: `allowBuilds` entry `simple-git-hooks: false` (its postinstall is not needed; the `prepare` script installs the hook).
3. `helpers.ts` gained `runSecretlint`; fixtures for 0.15 are three small trees under `tests/fixtures/check-deps/` (clean, direct, transitive).
4. Extra package scripts: `lint-staged`, `prepare`. The denylist JSON supports package names plus scopes.
5. The reserved phone ranges are an approximation: NANP 555 area code or 555-01xx, UK Ofcom drama range 07700 900xxx, and `600 000 0xx` for Spain. National IDs cover Spanish DNI/NIE and US SSN shapes. The Spanish `[6-9]xx xxx xxx` pattern can false-positive on 9-digit spaced numbers.
6. The tests in 0.17 run `lint-staged` and the policy script directly in the temp repo hook (not through `pnpm`), since the `pnpm` scripts only exist in this repo. The `package.json` command string is asserted separately.

### Workload / PR boundary

- Mode: stacked PR slice (`auto-chain`, `stacked-to-main`), slice 0c part 2, targets `feat/0c-repo-policy` until #3 merges.
- Review budget: 436 authored changed lines (434 additions, 2 deletions; lockfile excluded), over 400. Cohesive unit (one tool per task with its tests); recommend `size:exception`.

## Batch 5: PR 0d part 1 - Manifest, entrypoint stubs, extension key, tasks 0.18-0.20

Branch `feat/0d-manifest-router`, created from `feat/0c2b-hook-template` (stacked-to-main). Local only, not pushed, no PR opened. Stopped at a clean boundary after 0.20: the slice is 399 authored lines (397 additions, 2 deletions; lockfile excluded), so 0.21-0.23 become a follow-up slice.

### Completed tasks

- [x] 0.18 RED: manifest build test with the optional-permission assertion (SHELL-1/2/3/5, A1)
- [x] 0.19 GREEN: manifest generation and entrypoint stubs
- [x] 0.20 Extension key generation and stable ID (SHELL-2)

### Commits

| Commit | Tasks | Message |
|---|---|---|
| `85376d4` | 0.18, 0.19 | `build(manifest): generate Contract L manifest and entrypoint stubs with build tests` |
| `493c25f` | 0.20 | `feat(shell): pin extension ID with a generated public key and derive it in tests` |
| (this commit) | tracking | `docs(openspec): record apply progress for slice 0d part 1` |

### TDD Cycle Evidence

| Task | Test file | RED (observed) | GREEN (observed) | REFACTOR |
|---|---|---|---|---|
| 0.18 | `tests/build/manifest.test.ts`, `tests/build/manifest-rules.ts`, `tests/build/fixtures/manifest-*.json` | Against the bare skeleton: 2 failed / 5 passed. Failed: Contract L rules (permissions, optional permissions, popup, side panel, command all missing) and the pages check (no `options_ui`). The sentinel/fake-provider scan passes vacuously on a skeleton | see 0.19 | none |
| 0.19 | same | see 0.18 | 7 passed after `wxt.config.ts` manifest, three entrypoints, locales, E2E define | `jsx: react-jsx` added to tsconfig after `pnpm typecheck` flagged the TSX stubs |
| 0.20 | `tests/unit/extension-id.test.ts` and the key assertion in `manifest.test.ts` | Missing module `src/core/extensionId.ts`: file failed to load, no tests. Key assertion with the key removed from `wxt.config.ts`: 1 failed / 7 passed | 3 passed (synthetic vector; expected ID computed independently with `sha256sum`); manifest test 8 passed | Fixed a `noUncheckedIndexedAccess` typecheck error in the test |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/build/manifest.test.ts`: exit 0, 8 passed. `tests/unit/extension-id.test.ts`: 3 passed |
| Runtime harness command/scenario and exact result | Real `wxt build` inside the test (beforeAll, always rebuilds) and file scan of `.output/chrome-mv3`. `pnpm test` 16 files / 139 passed; `pnpm typecheck`, `pnpm lint` (53 files), `pnpm depcruise` (9 modules), `pnpm build`, `pnpm check:repo-policy --all`, `pnpm secretlint`, `pnpm check:deps` all exit 0. `pnpm build:e2e` builds to `.output/chrome-mv3-e2e` |
| Rollback boundary | `git revert` of the two commits: `wxt.config.ts`, `src/entrypoints/**`, `public/_locales/**`, `src/env.d.ts`, `src/core/extensionId.ts`, `scripts/gen-extension-key.ts`, `docs/extension-id.txt`, the manifest and ID tests, and the new dependencies (react, react-dom, zod, @wxt-dev/module-react, @types/react, @types/react-dom) |

### Extension ID

`gdbagkohkkddjlfgjipednbgopalegpp` (documented in `docs/extension-id.txt`). The private key was generated once at `~/.config/cv-tracker-extension/extension-key.pem` (directory 700, file 600), outside the repository; it was never printed. The owner must back it up outside this machine. `*.pem` is gitignored.

### Deviations

1. Dependencies added: `react`, `react-dom`, `zod` (runtime), `@wxt-dev/module-react`, `@types/react`, `@types/react-dom` (dev), all exact pins. Task 0.19 requires the React module and `z.config`, but no earlier task installed them.
2. `publicDir: 'public'` in `wxt.config.ts`: WXT defaults to `src/public`, while the task lists `public/_locales/**` at the repository root.
3. Manifest rules live in a pure function `tests/build/manifest-rules.ts` (not listed) so the negative fixtures can prove each failure message without building.
4. The manifest test rebuilds with `pnpm build` in `beforeAll` (180 s timeout) instead of requiring a prior build, so a stale `.output` cannot give a false pass. It also writes into `.output/chrome-mv3`.
5. `src/env.d.ts` declares `ImportMetaEnv.E2E`; `tsconfig.json` gained `jsx: react-jsx`.
6. Manifest `name` is the placeholder `CV Tracker (placeholder name)` through `__MSG_extName__` (open product item, finalize before 7-6). The default suggested shortcut `Alt+Shift+A` is a placeholder.
7. `docs/extension-id.txt` is written by the script. The public key is pasted into `wxt.config.ts` by hand from the script output (the script prints it).
8. The script refuses to overwrite an existing key and refuses a path inside the repository.

### Remaining tasks

- [ ] 0.21 Settings module skeleton, 0.22 typed commands and sender policy, 0.23 background skeleton, `ensureAlarms`, storage access level (follow-up slice)
- [ ] PR 0e, then sub-changes 1 to 7

### Workload / PR boundary

- Mode: stacked PR slice (`auto-chain`, `stacked-to-main`), slice 0d part 1, targets `feat/0c2b-hook-template` until #5 merges.
- Review budget: 399 authored changed lines, under 400.

## Batch 6: PR 0d part 2 - Settings, router, alarms, tasks 0.21-0.23

Branch `feat/0d2-settings-router-alarms`, created from `feat/0d-manifest-router` (stacked-to-main). Local only, not pushed, no PR opened. Tasks complete: 23 of 171 (0.1-0.23); PR 0d is complete.

### Completed tasks

- [x] 0.21 Settings module skeleton (ADR-11, SHELL-8)
- [x] 0.22 Typed commands skeleton and sender policy (ADR-16, SHELL-4)
- [x] 0.23 Background skeleton, `ensureAlarms`, storage access level (SHELL-4, ADR-03, ADR-11)

### Commits

| Commit | Tasks | Message |
|---|---|---|
| `4e35538` | 0.21 | `feat(storage): add Zod-validated settings module with change notifications` |
| `ace85b7` | 0.22 | `feat(messaging): add typed commands, sender policy and message router` |
| `2c95d30` | 0.23 | `feat(background): reconcile alarms idempotently and restrict storage access level` |
| (this commit) | tracking | `docs(openspec): record apply progress for slice 0d part 2` |

### TDD Cycle Evidence

| Task | Test file | RED (observed) | GREEN (observed) | REFACTOR |
|---|---|---|---|---|
| 0.21 | `tests/integration/settings.test.ts` | Missing `src/core/schemas/settings.ts`: file failed to load, no tests | 13 passed | Biome formatting |
| 0.22 | `tests/integration/router.test.ts` | Missing `src/background/router.ts`: file failed to load, no tests | 20 passed; client test added afterwards (21); typecheck fix for `mockResolvedValueOnce` | `ErrorCode` type simplified |
| 0.23 | `tests/integration/alarms.test.ts` | Missing `src/background/alarms.ts`: file failed to load, no tests | 8 passed after stubbing `i18n.getUILanguage` (fake-browser does not implement it) | none |

RED tests share a commit with their GREEN code so no branch commit carries a failing test.

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/integration`: 3 files, 42 tests passed |
| Runtime harness command/scenario and exact result | WXT fake-browser (storage, alarms, runtime). `pnpm test` 19 files / 181 passed; `pnpm typecheck`, `pnpm lint` (63 files), `pnpm depcruise` (17 modules, 20 dependencies), `pnpm build`, `pnpm check:repo-policy --all`, `pnpm secretlint`, `pnpm check:deps` all exit 0 |
| Rollback boundary | `git revert` of the three commits: `src/core/schemas/settings.ts`, `src/storage/settings.ts`, `src/shared/messaging/*`, `src/background/{router,senderPolicy,alarms}.ts`, `src/entrypoints/background.ts` wiring, `tests/integration/*` |

### Deviations

1. `ALARM_DEFS` is empty: the base settings have no schedule or update-check keys (they arrive in sub-changes 6 and 7). `ensureAlarms` and `startAlarms` take an injectable definition list, and the tests gate a fake `beacon-tick` on `notificationsEnabled`. SHELL-4 "alarms re-registered after restart" is proven with that injected definition.
2. WXT forbids an async `main`, so the entrypoint registers the router synchronously and runs the access-level call plus `startAlarms()` in a detached async block. The tests use `vi.waitFor`.
3. `setAccessLevel` failure or absence is swallowed (S6 unresolved; the reader-bundle build test is the fallback). Revisit after spike 1.9.
4. The worker's `setAccessLevel` is cast through a local type because the WXT types may not declare it.
5. `uiLanguage` default comes from `browser.i18n.getUILanguage()` in `src/storage/settings.ts`; the core exposes the pure `resolveUiLanguage`. A corrupt stored object falls back to defaults on read.
6. `outputLanguage` is materialized on first write, so later `uiLanguage` changes do not move it.
7. The `externally_connectable` absence is asserted against the source `wxt.config.ts` manifest object (the built manifest is already covered by the manifest build test).
8. `commands.ts` also exports `responseSchema`, `ERROR_CODES` and the result types so the client validates replies.

### Workload / PR boundary

- Mode: stacked PR slice (`auto-chain`, `stacked-to-main`), slice 0d part 2, targets `feat/0d-manifest-router` until #6 merges.
- Review budget: 583 authored changed lines (581 additions, 2 deletions; lockfile excluded, no tracking-file lines counted), 164 of them source and 419 tests. Over 400; cohesive (three small modules with their tests). Recommend `size:exception` or splitting 0.23 into its own PR.

### Remaining tasks

- (done in Batch 7) PR 0e

## Batch 7: PR 0e - i18n, Playwright, CI, public docs, tasks 0.24-0.27 (+0.28 docs)

Three stacked slices, all local only (not pushed, no PR opened), each under 400 authored lines (lockfile excluded):

| Branch | From | Tasks | Commit | Authored lines |
|---|---|---|---|---|
| `feat/0e-i18n-playwright` | `feat/0d2c-alarms` | 0.24, 0.25 | `caca7ed` i18n; `a967b20` e2e | 192 + 95 = 287 |
| `feat/0e2-ci` | `feat/0e-i18n-playwright` | 0.26 | `aa72b95` | 246 |
| `feat/0e3-docs` | `feat/0e2-ci` | 0.27, 0.28 docs | `37c9357` docs; tracking commit | 308 |

CI and docs were split into two slices because together they were 554 lines.

### Completed tasks

- [x] 0.24 i18n infrastructure, EN + ES (SHELL-8, ADR-19)
- [x] 0.25 Playwright extension loading and stable ID (SHELL-2)
- [x] 0.26 CI, CodeQL, Dependabot (SHELL-7, ADR-27)
- [x] 0.27 Public docs skeleton (SHELL-9, PRIV-6 skeleton, ADR-27)
- [ ] 0.28 stays open: the required-checks documentation is in `CONTRIBUTING.md`; enabling branch protection on `main` is an owner action (no repository setting was changed)

### TDD Cycle Evidence

| Task | Test file | RED (observed) | GREEN (observed) | REFACTOR |
|---|---|---|---|---|
| 0.24 | `tests/unit/i18n.test.ts`, `tests/component/i18n.test.tsx` | Missing `src/ui/i18n/*`: both files failed to load, no tests | 15 passed (parity, 8 language mappings, fallback, store, live switch without remount) | Biome formatting |
| 0.25 | `tests/e2e/install-id.spec.ts` | Mutation RED: with `docs/extension-id.txt` replaced by a wrong ID, `playwright test` gave 1 failed / 1 passed (ID assertion failed). The harness could not exist earlier | 2 passed against the real build (`pnpm e2e`) | none |
| 0.26 | `tests/build/workflows.test.ts` | No `.github/workflows`: file failed (`ENOENT scandir`) | 15 passed | Biome formatting |
| 0.27 | `tests/unit/docs-skeleton.test.ts` | No docs: 21 failed / 21 | 21 passed | Softened a SECURITY.md sentence that claimed a UI warning not yet built |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/unit/i18n.test.ts tests/component/i18n.test.tsx` 15 passed; `pnpm e2e` 2 passed; `tests/build/workflows.test.ts` 15 passed; `tests/unit/docs-skeleton.test.ts` 21 passed |
| Runtime harness | Real headless Chromium (`channel: 'chromium'`) loading the built e2e extension from two temporary folders. Final run on `feat/0e3-docs`: `pnpm test` 23 files / 232 passed; `pnpm typecheck`, `pnpm lint` (73 files), `pnpm depcruise` (21 modules), `pnpm build`, `pnpm e2e`, `pnpm check:repo-policy --all`, `pnpm secretlint`, `pnpm check:deps` all exit 0. `pnpm audit --prod --audit-level high`: no known vulnerabilities. `pnpm test --coverage`: 95.4% lines |
| Rollback boundary | Revert per slice: `src/ui/i18n/*` and tests; `playwright.config.ts`, `tests/e2e/**`, `e2e` script, `@playwright/test`; `.github/workflows/*`, `.github/dependabot.yml`, `.nvmrc`, `@vitest/coverage-v8`, engines bump; public docs and their test |

### Playwright mode

Headless works: `chromium.launchPersistentContext('', { channel: 'chromium', ... })` loads the extension (new headless mode). `xvfb-run` is not installed locally and is not needed. CI uses the same headless mode (no xvfb); `playwright install --with-deps chromium` runs before `pnpm e2e`. If it proves flaky on runners, switch the CI step to `xvfb-run` with a headed launch.

### Pinned actions

`actions/checkout` v7.0.1 `3d3c42e5...`, `pnpm/action-setup` v6.1.0 `ea17c68d...`, `actions/setup-node` v7.1.0 `949feb24...`, `actions/upload-artifact` v7.0.2 `cf430e03...`, `github/codeql-action` v4.38.3 `24c54180...` (resolved with `git ls-remote`; annotated tags use the peeled commit).

### Deviations

1. `src/ui/i18n/index.tsx` (not `index.ts`): the provider and hook contain JSX. `en.ts` also exports `MessageKey`. No Testing Library: the component test uses `react-dom/client` and `act` on jsdom.
2. The settings store is not yet wired to the i18n store; wiring belongs to the first UI that renders translated text. `resolveUiLanguage` (0.21) already covers the `es*`/`en*`/other mapping.
3. The e2e script is `wxt build --mode e2e && playwright test`; the spec copies `.output/chrome-mv3-e2e` into two temp folders. An extra spec loads `options.html` under the discovered ID.
4. The Playwright RED is a mutation of the documented ID, since the spec cannot be written before the harness exists.
5. Added `.nvmrc` (24) and raised `engines.node` to `>=22.18` (native type stripping for scripts); `@vitest/coverage-v8` 5.0.3 added for `pnpm test --coverage`.
6. CI adds a Playwright browser install step and a failure-only report upload (not in the task list). CodeQL also runs on pushes to `main`.
7. The CI "build tests" step runs `pnpm vitest run tests/build` after `pnpm build`, matching the design table.
8. 0.28: docs only. Branch protection stays an owner action.

## Batch 9: PR 2a-1 - Ports, cost, text, schemas, tasks 2a.1-2a.4

Slice on branch `feat/2a-1-ports-cost-text-schemas` (from `main` at `bc14e28`), local only, not pushed, no PR opened. Mode: Strict TDD. Cumulative task count after this batch: 31 of 171 (the Status section above was not rewritten here to keep the parallel 0f branch merge-clean; read it together with this batch).

### Completed tasks

- [x] 2a.1 Core ports and catalog types (ADR-01, Contract A)
- [x] 2a.2 Cost math (LLM-8)
- [x] 2a.3 Text normalization and folding (ANALYSIS-3; A2, A3, A16)
- [x] 2a.4 Analysis schemas (ANALYSIS-1, ANALYSIS-10, ANALYSIS-11; A18; defines `Diagnostics`)

### Commits

| Commit | Task | Message |
|---|---|---|
| `4f1e18c` | 2a.1 | `feat(core): add runtime and LLM ports and the catalog type shell` |
| `25fa122` | 2a.2 | `feat(core): add token cost math and token estimate` |
| `eaa94dc` | 2a.3 | `feat(core): add offer text normalization, folding and head-and-tail cap` |
| `31f57e7` | 2a.4 | `feat(core): add analysis schemas with ungrounded-claim diagnostics` |
| (this commit) | tracking | `docs(openspec): record apply progress for slice 2a-1` |

### TDD Cycle Evidence

| Task | Test file | RED (observed) | GREEN (observed) | REFACTOR |
|---|---|---|---|---|
| 2a.1 | `tests/unit/core/ports.test.ts` | `pnpm vitest run tests/unit/core/ports.test.ts`: suite failed to load, `Cannot find module '../../../src/core/pricing/catalog.ts'`, no tests ran | Same command: 9 passed. One first-run failure was a test defect (the catalog comment matched the no-import regex), fixed by checking import lines only | Biome formatting only |
| 2a.2 | `tests/unit/core/cost.test.ts` | Suite failed to load, `Cannot find module '../../../src/core/cost.ts'` | 12 passed (the $0.02 scenario, cached pricing, clamp, zero, `estimated`, `estimateTokens` table) | none |
| 2a.3 | `tests/unit/core/text.test.ts` | Suite failed to load, `Cannot find module '../../../src/core/text.ts'` | 27 passed (NFC, eight invisible characters, whitespace, fold quotes and dashes, words, cap boundaries, hard-cut fallback) | Biome formatting only |
| 2a.4 | `tests/unit/core/schemas/analysis.test.ts` | Suite failed to load, `Cannot find module '../../../../src/core/schemas/analysis.ts'` | 37 passed (strict output, `Diagnostics` bounds and `auditVersion`, result round-trip and field completeness, failure without verdict) | Biome formatting only |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/unit/core`: 4 files, 85 tests passed |
| Runtime harness | N/A for a runtime boundary (pure `src/core` modules, no I/O). Whole-repo gates: `pnpm test` 27 files / 317 passed; `pnpm lint` exit 0; `pnpm typecheck` exit 0; `pnpm depcruise` no violations (27 modules); `pnpm check:repo-policy --all` exit 0 |
| Rollback boundary | Revert the four slice commits: `src/core/ports/{runtime,llm}.ts`, `src/core/pricing/catalog.ts`, `src/core/cost.ts`, `src/core/text.ts`, `src/core/schemas/analysis.ts` and `tests/unit/core/**`. Nothing else imports them yet |

### Deviations and decisions

1. Review size: 1,052 authored lines against the ~360 forecast (about 540 of them in tests, because the tasks require one RED per rule). Cohesive and not trimmed; `size:exception` recommended, or split at commit boundaries (ports + cost, text, schemas).
2. `PRICE_CATALOG` is `Record<ProviderId, { displayName, models }>` with empty `models`; `REAL_PROVIDER_IDS` is its keys. No price was invented; 2b.12 fills the entries.
3. `computeCost` treats `inputTokens` as the total prompt size including cached tokens (uncached = input minus cached, clamped at 0). The design leaves this open; 2b adapters must normalize provider usage to this meaning.
4. `words` returns the token array (design writes `words(...) >= 2`; callers use `.length`). `normalizeOfferText` removes the whole Unicode `Cf` category, a superset of the spec's listed characters.
5. `analysis.ts` defines `Verdict`, `VerdictReason`, `WarningCategory`, `PdfReason` as enum constants and a blob-free PDF shape because `AnalysisResult` needs them before 2a-2 (`CvPdfMeta`) and 2a-4 land; those slices should import or replace them rather than redefine.
6. `ProviderError` also sets `name = 'ProviderError'`; `LLM_ERROR_CLASSES` is an exported const tuple from which `LlmErrorClass` derives.
7. Environment: `pnpm install --frozen-lockfile` and `wxt prepare` were run in the worktree (no `node_modules` or `.wxt` there).

## Batch 10: PR 2a-2 split into 2a-2a and 2a-2b (tasks 2a.5-2a.7)

Slice "PR 2a-2" exceeded the owner policy of about 400 changed lines (about 770 authored lines, tests included), so it is split at work-unit commit boundaries into stacked branches, each green on its own: `feat/2a-2a-profile-version` (base `feat/2a-1c-schemas`) and `feat/2a-2b-prompt-cachekey` (base `feat/2a-2a-profile-version`). Local only, not pushed, no PR opened. Mode: Strict TDD.

### Sub-slice 2a-2a: task 2a.5

- [x] 2a.5 Profile schemas, `profileVersion`, `dealbreakerRefs` (PROFILE-8; A4; defines `CvPdfMeta`, `TitleFilter`)

Commit `34d6df0` `feat(core): add profile schemas, profileVersion and dealbreaker refs` (371 additions, 14 deletions).

| Task | Test file | RED (observed) | GREEN (observed) | REFACTOR |
|---|---|---|---|---|
| 2a.5 | `tests/unit/core/profileVersion.test.ts` | `pnpm vitest run tests/unit/core/profileVersion.test.ts`: suite failed to load, `Cannot find module .../src/core/analysis/profileVersion.ts`, no tests ran | `pnpm vitest run tests/unit/core`: 6 files, 122 passed (determinism, order independence, each version input, PDF/titleFilter/blocklist exclusion, field-shift collision, `dealbreakerRefs`, id patterns, blank statement) | Biome formatting only |
| helper | `tests/unit/core/hash.test.ts` | Written after `src/core/hash.ts` (a four-line `crypto.subtle` wrapper extracted for reuse by the cache key); not a true RED. Covered earlier by the RED of the `profileVersion` suite that imports it; known SHA-256 vectors for `abc` and the empty string pass | 2 passed | none |

### Work Unit Evidence (2a-2a)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/unit/core/profileVersion.test.ts`: 1 file, all tests passed |
| Runtime harness | N/A: pure `src/core` module with no runtime boundary. Whole-repo gates recorded in the return summary |
| Rollback boundary | Revert `34d6df0` and this tracking commit: `src/core/schemas/profile.ts`, `src/core/analysis/profileVersion.ts`, `src/core/hash.ts`, `tests/unit/core/{profileVersion,hash}.test.ts`; `analysis.ts` regains its local `cvPdfMetaSchema` |

### Deviations and decisions (2a-2a)

1. `profileVersion` returns `Promise<string>`, not `string` as Contract I writes it: SHA-256 is `crypto.subtle`, which is asynchronous (the same reason `cacheKey` returns a promise). Callers await it.
2. `dealbreakerRefs` indexes are zero-based (`b-1/d0`). The design only shows `b-2/d1` as an example; the zero-based choice is the literal array index and is stable per version.
3. Id ordering is numeric by sequence (`c-10` after `c-9`) through `sortedClaims` and `sortedBranches` in `profile.ts`; the prompt builder reuses them so the prefix and the version order identically. Tags are sorted in the version and in the prompt.
4. `cvPdfMetaSchema` moved from the 2a-1c placeholder in `analysis.ts` into `profile.ts` (exported, `size` now a non-negative integer) and `analysis.ts` imports it, as the 2a-1 deviation note intended. `language` stays a plain string until the language table lands (2a-4). `CvPdf` is a TypeScript type (`CvPdfMeta & { blob: Blob }`), not a Zod schema.
5. `src/core/hash.ts` (`sha256Hex`) is new and shared by `profileVersion` and `cacheKey`; it is not in the task file list.

### Sub-slice 2a-2b: tasks 2a.6 and 2a.7

- [x] 2a.6 Prompt builder and output schema (ANALYSIS-2, ANALYSIS-3, ANALYSIS-10, ANALYSIS-11; ADR-14, ADR-29; A18)
- [x] 2a.7 Cache key (ANALYSIS-9; interpretation (a))

Commits on `feat/2a-2b-prompt-cachekey` (base `feat/2a-2a-profile-version`): `feat(core): add content-hash analysis cache key` (2a.7), `feat(core): add analysis prompt builder and output JSON schema` (2a.6), and a tracking commit `docs(openspec): record apply progress for slice 2a-2b`.

| Task | Test file | RED (observed) | GREEN (observed) | REFACTOR |
|---|---|---|---|---|
| 2a.7 | `tests/unit/core/analysis/cacheKey.test.ts` | suite failed to load, `Cannot find module .../src/core/analysis/cacheKey.ts` | 7 passed (digest equals `sha256` of the NUL-joined parts, determinism, each of four components, provider-qualified id) | Biome formatting only |
| 2a.6 | `tests/unit/core/analysis/prompt.test.ts` | suite failed to load, `Cannot find module .../src/core/analysis/prompt.ts` | first run 21 of 22 passed; the remaining failure was the snapshot test pinned to a placeholder hash, then pinned to the observed hash: 22 passed. Bump enforcement checked by mutating one rubric character (1 failed) and reverting (22 passed) | Biome formatting only |

### Work Unit Evidence (2a-2b)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/unit/core/analysis/prompt.test.ts tests/unit/core/profileVersion.test.ts`, plus `cacheKey.test.ts` |
| Runtime harness | Prompt snapshot plus version-bump enforcement (template and output JSON schema hash mapped to `PROMPT_VERSION`); no runtime boundary otherwise |
| Rollback boundary | Revert the three 2a-2b commits: `src/core/analysis/{prompt,outputSchema,cacheKey}.ts` and their tests; nothing imports them yet |

### Deviations and decisions (2a-2b)

1. `PROMPT_VERSION` stays `analysis-2` (2a-2 has not merged); the A18 rubric sentence is in prefix block 0 and asserted by a substring test. The pinned snapshot hash is `6dfacf79ac0a6307a489c0a1d4a3d446a0c43d081e6159bf76cc7bafb31b47ef`.
2. `AUDIT_VERSION` is not a cache-key input: `cacheKey` takes exactly four parameters, so the audit version cannot reach it (ADR-29).
3. The snapshot hashes `PROMPT_TEMPLATE` (every authored string, exported) and `offerAnalysisJsonSchema`, not the built prefix, so profile edits never affect it.
4. `outputSchema.ts` derives the provider JSON Schema from `offerAnalysisOutputSchema` with `z.toJSONSchema` and drops `$schema`; a test asserts strictness, all six required fields, and no bounds or `$ref` (LLM-2).
5. Rationale language names live in a small table in `prompt.ts` (`es`, `en`, `ca`); other codes fall back to the bare code. The shared language table arrives in 2a-4 and should replace it.
6. Prompt text is product-authored English; the claims block is `id: statement [sorted tags]`, the branches block lists rules and `<branchId>/d<index>: text` lines, empty sections render `(none)`.
7. Neutralization rewrites `</offer_data` (any case) to `<\/offer_data` keeping the original letter case; attributes are neutralized first and then escaped.

## Batch 11: review fixes on branch `feat/2a-2c-review-fixes` (base `feat/2a-2b-prompt-cachekey`)

Fixes for review-67b40bacb9e78932 only. Commit `89f65e6` `fix(core): pin rendered prompt bytes and reject duplicate profile ids` (152 additions, 11 deletions). Mode: Strict TDD.

| Finding | Test file | RED (observed) | GREEN (observed) |
|---|---|---|---|
| R3-prompt-version-guard-gap | `tests/unit/core/analysis/prompt.test.ts` | snapshot pinned to a placeholder hash failed with the observed rendered hash | pinned `659872f8...5a5f` (fully rendered prefix and variable, languages `es`, `en`, `ca`, `xx`, claims with tags, branches with rules and dealbreakers, hostile offer text and attributes); mutations of `Catalan`, the `rule:` line prefix and the tag join each fail the snapshot (reverted) |
| R3-duplicate-id-order | `tests/unit/core/schemas/profile.test.ts` (new) | 5 failed: duplicate claim and branch ids accepted, tie order depended on insertion, NaN ids unordered | `profileSchema` `superRefine` rejects duplicate ids (malformed ids were already rejected by the patterns); comparator is total: numeric suffix (NaN sorts last), then full id string |

The older template plus output-schema hash test is kept. `pnpm test` 393 passed, lint, typecheck, depcruise and repo-policy green.

## Batch 12: PR 2a-3 split into 2a-3a and 2a-3b (tasks 2a.8-2a.10)

Slice "PR 2a-3" came to about 570 authored lines with tests (production about 170, tests about 400), over the owner policy of about 400, so it is split at work-unit boundaries into stacked branches, each green on its own and never separating code from its tests: `feat/2a-3a-shape-score-placeholders` (base `feat/2a-2c-review-fixes`) and `feat/2a-3b-grounding-walls` (base `feat/2a-3a-shape-score-placeholders`). Local only, not pushed, no PR opened. Mode: Strict TDD.

### Sub-slice 2a-3a: task 2a.8

- [x] 2a.8 RED: steps 1-3 (shape, score, placeholders)

Commit `feat(core): add post-validation steps 1-3 (shape, score, placeholders)` (215 additions). `postValidate` runs steps 1-3 and maps the rest through unchanged until 2a-3b; nothing imports it yet.

| Task | Test file | RED (observed) | GREEN (observed) | REFACTOR |
|---|---|---|---|---|
| 2a.8 | `tests/unit/core/analysis/postValidate.shape.test.ts` | suite failed to load, `Cannot find module .../src/core/analysis/postValidate.ts`, no tests ran | 29 passed (shape, three bad scores, boundaries 0 and 100, 18 placeholder spellings, requirement and wall text, "string theory" kept, placeholder before grounding, score reported before placeholder) | none needed |

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/unit/core/analysis/postValidate.shape.test.ts`: 1 file, 29 passed |
| Runtime harness | N/A: pure `src/core` module with no runtime boundary |
| Rollback boundary | Revert the 2a-3a commit: `src/core/analysis/postValidate.ts` and `tests/unit/core/analysis/postValidate.shape.test.ts` |

### Sub-slice 2a-3b: tasks 2a.9 and 2a.10

- [x] 2a.9 RED: steps 4-8 (grounding, nothing strong, claim ids, walls, branch)
- [x] 2a.10 GREEN: `postValidate`

Commit `feat(core): add post-validation steps 4-8 (grounding, claims, walls, branch)` (358 additions, 24 deletions) plus this tracking commit. The slice tasks 2a.8-2a.10 are complete.

| Task | Test file | RED (observed) | GREEN (observed) | REFACTOR |
|---|---|---|---|---|
| 2a.9 | `tests/unit/core/analysis/postValidate.rows.test.ts` | against the 2a-3a pass-through: 15 failed, 9 passed (no dropping, no unmatched marking, no branch nulling, no step 5 failure) | see 2a.10 | n/a |
| 2a.10 | same | n/a | 24 passed in the rows file, 53 across both files; whole suite 446 passed. Mutations checked and reverted: strong floor 12 to 11, grounding floor 3 to 2, wall citation ignoring `unmatched` each fail a test | Biome formatting only |

### Work Unit Evidence (2a-3b)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/unit/core/analysis/postValidate`: 2 files, 53 passed |
| Runtime harness | N/A: pure `src/core` module with no runtime boundary |
| Rollback boundary | Revert the 2a-3b commits: restores the 2a-3a pass-through `postValidate.ts` and removes `postValidate.rows.test.ts` |

### Deviations and decisions (2a-3)

1. The context is `{ requestText, snapshot }`; Contract C also lists `fullText`, which no step 1-8 uses, so it is left out until `derive` needs it (2a-5 passes it to `derive`, not to `postValidate`).
2. The result is `{ ok: true, output } | { ok: false, errorClass: 'invalid_output', reason }` with `reason` one of `shape`, `score`, `placeholder`, `no_grounded_requirement`, `no_strong_requirement`, so tests and logs can name the failing step.
3. Diagnostics carry `ungroundedClaims: { count: 0, samples: [], auditVersion: 'audit-1' }` through a local `PENDING_AUDIT_VERSION` constant because `AUDIT_VERSION` does not exist until 2a.26; task 2a.27 replaces it.
4. Wall reasons are checked in the order ungrounded, weak evidence, then citation; each dropped wall is counted once.
5. A fit entry that arrives with no claim ids is also marked `unmatched` (an entry "left with no ids"); fit entries for requirements dropped at grounding are kept as the model sent them, as the spec is silent.
6. An `unmet_must_have` citation resolves against kept `must_have` requirements only, matching fit entries by folded requirement text; a requirement with any matched entry has a claim.
7. Placeholder angle templates are any whole string of the form `<...>` with no nested angle brackets.

## Batch 13: PR 2a-4 split into 2a-4a, 2a-4b and 2a-4c (tasks 2a.11-2a.15 plus advisory follow-ups)

Slice "PR 2a-4" plus the review follow-ups come to about 1,000 authored lines, over the owner policy of about 400, so it is split at work-unit boundaries into stacked branches, each green on its own, never separating code from tests: `feat/2a-4a-verdict-injection` (base `feat/2a-3b-grounding-walls`), `feat/2a-4b-language` (base 2a-4a) and `feat/2a-4c-warnings-pdf` (base 2a-4b). Local only, not pushed, no PR opened. Mode: Strict TDD.

### Sub-slice 2a-4a: tasks 2a.11, 2a.12 and the review-21e71e7d59070ccd follow-ups

- [x] 2a.11 Verdict (ANALYSIS-5; A12, A18)
- [x] 2a.12 Injection signals (ADR-14; A12)

Commits: `test(core): cover wall reason precedence, dropped-requirement counts and fit-side fold` (follow-up, tests only: characterization of existing behavior, so no RED exists; mutating the fit-side fold in `postValidate` makes two tests fail, reverted), `feat(core): add verdict derivation with injection and grounding downgrades`, `feat(core): add EN/ES prompt-injection signal table`.

| Task | Test file | RED (observed) | GREEN (observed) | REFACTOR |
|---|---|---|---|---|
| 2a.11 | `tests/unit/core/verdict.test.ts` | suite failed to load, `Cannot find module .../src/core/analysis/verdict.ts` | 17 passed: thresholds 85/70/69/40/39, wall over any score and over both downgrades, `injection_downgrade`, `grounding_downgrade`, injection precedence, downgrades never touch review/skip/wall, `// @ts-expect-error` proves a `rationale` field does not compile (checked by `pnpm typecheck`) | Biome formatting only |
| 2a.12 | `tests/unit/core/injectionSignals.test.ts` | suite failed to load, `Cannot find module .../src/core/injectionSignals.ts` | 27 passed: 14 EN/ES positives with excerpts, invisible-character folding, signal at the end of a 30,000-character text, distinct and at most 5 excerpts of at most 80 characters, 10 benign negatives | none needed |

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/unit/core/verdict.test.ts tests/unit/core/injectionSignals.test.ts tests/unit/core/analysis/postValidate.rows.test.ts`: all passed |
| Runtime harness | N/A: pure `src/core` modules with no runtime boundary |
| Rollback boundary | Revert the three 2a-4a commits: `src/core/analysis/verdict.ts`, `src/core/injectionSignals.ts` and their tests; the follow-up tests are independent |

Decisions (2a-4a): `deriveVerdict` input is exactly `{ score, acceptedWalls, injectionSuspected, ungroundedClaims }`; `Verdict` and `VerdictReason` types derive from the schema constants. The injection table reports the first match per pattern (distinct excerpts, at most 5, each at most 80 characters, taken from the folded text so the chip text is lowercase). Role-reassignment phrases require a model noun ("you are now an assistant", not "you are now part of a team") to stay precision-first.

### Sub-slice 2a-4b: task 2a.13 and the review-0f7820e1f90ce161 follow-ups

Branch `feat/2a-4b-language` (base `feat/2a-4a-verdict-injection`).

- [x] 2a.13 Language inference (ANALYSIS-6, PROFILE-5; A16)

Commits: `test(core): hash rendered prompt bytes only and document malformed-id ordering`, `feat(core): add language table and deterministic language inference`, `refactor(core): use the shared language table for prompt language names`.

| Task | Test file | RED (observed) | GREEN (observed) | REFACTOR |
|---|---|---|---|---|
| follow-up: per-language prompt hash | `tests/unit/core/analysis/prompt.test.ts` | after removing the language code from the hashed object the pin failed with the new rendered-bytes hash (`f00e6116...fbbfc` against the old `659872f8...5a5f`); the pin was updated, and a mutation of the `Catalan` name fails it (reverted) | 24 passed | none |
| follow-up: malformed-id ordering doc | `tests/unit/core/schemas/profile.test.ts` | doc comment only; a new test backs the corrected text: empty suffix sorts first, non-numeric last | 9 passed | none |
| 2a.13 | `tests/unit/core/language.test.ts` | suite failed to load, `Cannot find module .../src/core/language.ts` | 20 passed: synthetic es/en/ca texts, short text, exactly 20 tokens, mixed text, no signal, company-name case, text beyond the cap, exact `LANG_MIN_SCORE` and `LANG_LEAD_RATIO` boundaries with a synthetic table, marker weight, a registered fourth language | none needed |
| follow-up: shared table in `prompt.ts` | existing prompt snapshot | n/a (refactor guarded by the pinned rendered hash) | 24 passed with the hash unchanged, so `PROMPT_VERSION` stays `analysis-2` | local `LANGUAGE_NAMES` removed |

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/unit/core/language.test.ts tests/unit/core/analysis/prompt.test.ts tests/unit/core/schemas/profile.test.ts`: all passed |
| Runtime harness | N/A: pure `src/core` modules with no runtime boundary |
| Rollback boundary | Revert the three 2a-4b commits independently; `languages.ts` and `language.ts` are imported only by `prompt.ts` (name lookup) |

Decisions (2a-4b): `LanguageEntry` gains a required `name` (English name for the prompt) so the shared table replaces `LANGUAGE_NAMES`; `languageName(code, table)` returns the bare code for an unknown code. The table holds es, en and ca (the synthetic fourth language in the test is a fourth entry). Word lists are space-separated strings split at load, with shared function words listed in both Spanish and Catalan so they cancel and the markers decide.

### Sub-slice 2a-4c: tasks 2a.14 and 2a.15

Branch `feat/2a-4c-warnings-pdf` (base `feat/2a-4b-language`).

- [x] 2a.14 Apply warnings (ANALYSIS-7; A16)
- [x] 2a.15 PDF pick (ANALYSIS-8)

Commits: `feat(core): add recommended CV PDF pick`, `feat(core): add EN/ES apply-instruction warnings`.

| Task | Test file | RED (observed) | GREEN (observed) | REFACTOR |
|---|---|---|---|---|
| 2a.15 | `tests/unit/core/analysis/pickPdf.test.ts` | suite failed to load, `Cannot find module .../src/core/analysis/pickPdf.ts` | 8 passed: exact pairs, `no_branch` before `language_unknown` before `no_pdf_for_language`, alternatives are that branch's PDFs only, no substitution, empty branch, duplicate pair resolved newest-first independent of input order | none needed |
| 2a.14 | `tests/unit/core/applyWarnings.test.ts` | suite failed to load, `Cannot find module .../src/core/applyWarnings.ts` | first run 29 of 31 passed; the two failures were the phone scenarios (a trailing word boundary after `call +` rejected the digit), fixed with a lookahead: 31 passed. Mutating `MAX_CUE_GAP` to 1000 fails the proximity test (reverted) | Biome formatting only |

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm vitest run tests/unit/core/applyWarnings.test.ts tests/unit/core/analysis/pickPdf.test.ts`: 2 files, 39 passed |
| Runtime harness | N/A: pure `src/core` modules with no runtime boundary |
| Rollback boundary | Revert the two 2a-4c commits; nothing imports either module yet (`derive` arrives in 2a-5) |

Decisions (2a-4c): a warning needs a directive cue and a category cue in one sentence and within 120 characters; sentences split at `.`, `!`, `?` followed by a capital and at bullet glyphs (the normalized text has no newlines). Email addresses are blanked before the external-site cue so an address domain never fires `external_site`. Warnings come back in order of first appearance, one per category, excerpt taken from the normalized (not folded) text. When a (branch, language) pair has several PDFs, `pickPdf` takes the newest by `addedAt` (id breaks ties); `alternatives` are newest first for the same branch. `pickPdf` with a null branch returns an empty `alternatives` list.
