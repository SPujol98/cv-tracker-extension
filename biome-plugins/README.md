# Biome GritQL plugins

Source-ban rules that Biome's built-in rules do not cover. Each plugin is registered in the
`plugins` array of `biome.json` and is exercised by a positive and a negative fixture test under
`tests/lint-fixtures/`.

| Plugin | Bans | Requirement |
|---|---|---|
| `no-new-function.grit` | `new Function(...)` | SHELL-5 |
| `no-html-sinks.grit` | `.innerHTML =`, `.outerHTML =`, `insertAdjacentHTML`, `document.write(ln)` | PRIV-4 |
| `no-send-beacon.grit` | `navigator.sendBeacon(...)` | PRIV-2 |
| `no-forbidden-portal-strings.grit` | String literals containing `/jobs-guest/`, `/job-apply/`, `runSearch`, except in `src/core/guard.ts` and `tests/unit/core/guard.test.ts` | PORTAL-6 |
| `restricted-egress.grit` | Any bare reference to global `fetch` (calls and aliases such as `const f = fetch`), `globalThis`/`self`/`window` member forms of `fetch(...)`, `new XMLHttpRequest()`, `new WebSocket()`, `new EventSource()` and `open(...)`, `chrome.tabs.create/update(...)`, `browser.tabs.create/update(...)`, in production source only (`src/**` minus tests, non-src top-level paths and the root config files), except the five allowlisted modules | PRIV-11 |

## Decision record: GritQL versus the TypeScript-AST fallback

Task 0.6 allows a pattern that Biome 2.5.15 cannot express reliably to move into a small
TypeScript-AST check (`scripts/check-ast-bans.ts`). Every pattern above is expressed reliably in
GritQL, so no fallback script exists. If a later plugin cannot be written in GritQL, record that
single pattern here and implement it in `scripts/check-ast-bans.ts`.

## Notes for plugin authors

- Plugin paths resolve against the directory of the config that Biome loads, including inherited
  entries. A config that extends `biome.json` from another directory must sit next to the plugin
  folder (the root `biome.fixtures.json` does) or carry a copy of it.
- A fixture test must assert that the output does not contain `during loading of plugins`;
  otherwise a plugin that failed to load looks like a rule that fired.
- Plugin `includes` globs need a `**/` prefix (`!**/src/core/guard.ts`); repository-relative globs
  such as `!src/core/guard.ts` are silently ignored by Biome 2.5.15.
- `restricted-egress.grit` allowlist: `src/background/services/providerGateway.ts`,
  `src/background/services/update.ts`, `src/background/scanTabDriver.ts`, `src/e2e/overrides.ts`,
  `src/ui/lib/openBlob.ts`. The paths need not exist yet. Adding a path needs a rationale in the
  same PR; the egress test derives its allowlist matrix from the plugin `includes` in `biome.json`,
  so no test edit is needed.
- Biome 2.5.15 plugin globs match the absolute path and cannot be anchored to the project root, so
  `**/src/**` also matches an ancestor directory named `src`. The plugin `includes` therefore
  exclude every non-src top-level path (`scripts`, `tests`, `docs`, and the explicit root files `wxt.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `.dependency-cruiser.cjs`; a `src/**/x.config.ts` stays in scope); a test
  fails if a tracked source file outside `src/` is not covered by such an exclusion. A production
  directory named `scripts` or `tests` nested under `src/` would be excluded as well.

- Biome 2.5 prints no per-rule diagnostics in `--stdin-file-path` mode, so the egress fixtures are
  copied to their stated path inside a temporary tree and linted as real files.
- Canary: because the globs match absolute paths, a checkout under an ancestor directory named like
  an exclusion (`scripts`, `tests`, `docs`, ...) would silently disable `restricted-egress` for
  `src/`. A test lints a bare `fetch` at the real `src/ui/__egress_canary__.ts` (removed afterwards)
  and fails with "an ancestor directory of this checkout matches a plugin exclusion;
  restricted-egress would be disabled".

### Known limitations of `restricted-egress.grit`

GritQL has no data-flow analysis, so these forms are not reported: rebinding the global object
(`const g = globalThis; g.fetch(...)`), computed access (`globalThis['fetch'](...)`),
a renamed destructure (`const { fetch: f } = globalThis`), and indirect calls (`Reflect.apply`, `eval`).
A shadowing local named `fetch` (a parameter or variable) is reported as a bare reference. The
fixture `known-limitation-global-alias.ts` pins the first two so a change in behaviour is visible.
