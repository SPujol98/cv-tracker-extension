# Apply Progress: extension-v1

Cumulative state of the apply phase. Each batch merges into this file; completed tasks from earlier batches are never dropped.

## Status

- Tasks complete: 4 of 171 (0.1-0.4). Next unit: PR 0b (tasks 0.5-0.9).
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

- [ ] 0.5-0.9 (PR 0b: layer boundaries and source-ban plugins)
- [ ] 0.10-0.17 (PR 0c), 0.18-0.23 (PR 0d), PR 0e, then sub-changes 1 to 7 as listed in `tasks.md`

### Workload / PR boundary

- Mode: stacked PR slice (`auto-chain`, `stacked-to-main`), slice 0a, target `main`.
- Boundary: starts at `main` (`cac12df`, planning commit only) and ends with the Biome base commit plus this tracking commit.
- Review budget: 287 authored changed lines in the three code commits (271 additions, 16 deletions; lockfile excluded). Forecast was about 250; the overage is the config pin and exclusion tests, the fixtures config, and the toolchain files. Under the 400-line budget.
