# Biome GritQL plugins

Source-ban rules that Biome's built-in rules do not cover. Each plugin is registered in the
`plugins` array of `biome.json` and is exercised by a positive and a negative fixture test under
`tests/lint-fixtures/`.

| Plugin | Bans | Requirement |
|---|---|---|
| `no-new-function.grit` | `new Function(...)` | SHELL-5 |
| `no-html-sinks.grit` | `.innerHTML =`, `.outerHTML =`, `insertAdjacentHTML`, `document.write(ln)` | PRIV-4 |

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
