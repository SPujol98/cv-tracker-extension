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
| `restricted-egress.grit` | Global `fetch(...)`, `new XMLHttpRequest()`, `new WebSocket()`, `new EventSource()`, `window.open(...)`, `chrome.tabs.create/update(...)`, `browser.tabs.create/update(...)`, in production source only (`src/**` minus `src/**/*.test.ts(x)`), except the five allowlisted modules | PRIV-11 |

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
  same PR and a matching row in `tests/lint-fixtures/gritql-egress.test.ts`. The `**/src/**` glob
  also matches an absolute ancestor directory named `src`, so keep the checkout outside one.
- Biome 2.5 prints no per-rule diagnostics in `--stdin-file-path` mode, so the egress fixtures are
  copied to their stated path inside a temporary tree and linted as real files.
