// Layer rules from design.md "Module Boundaries" (ADR-01). Dependencies point inward: adapters
// import ports from src/core, and src/core never imports an adapter.
// Resolved internal paths are matched, so relative-path bypasses are caught. Package names are
// matched in both forms: resolved (node_modules/<pkg>/) and unresolved (<pkg>).

/** @param {string} names Pipe-separated package names. */
const pkg = (names) => [`^(${names})(/|$)`, `(^|/)node_modules/(${names})/`];

const SRC_LAYERS = 'storage|providers|portals|background|ui|shared|entrypoints';

/**
 * @param {string} name
 * @param {string} comment
 * @param {string} fromPath
 * @param {string[]} toPaths
 * @param {{ fromPathNot?: string, toPathNot?: string }} [extra]
 */
const forbid = (name, comment, fromPath, toPaths, extra = {}) => ({
  name,
  comment,
  severity: 'error',
  from: { path: fromPath, ...(extra.fromPathNot && { pathNot: extra.fromPathNot }) },
  to: { path: toPaths, ...(extra.toPathNot && { pathNot: extra.toPathNot }) },
});

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    forbid(
      'core-isolated',
      'src/core is pure: no adapters, no shell layers, no browser, Dexie, React or WXT packages.',
      '^src/core/',
      [`^src/(${SRC_LAYERS})/`, ...pkg('chrome|dexie|react|wxt')],
    ),
    forbid(
      'providers-portals-separate',
      'Providers and portal adapters never import each other.',
      '^src/providers/',
      ['^src/portals/'],
    ),
    forbid(
      'portals-providers-separate',
      'Providers and portal adapters never import each other.',
      '^src/portals/',
      ['^src/providers/'],
    ),
    forbid(
      'providers-restricted',
      'Providers are plain fetch adapters over core ports.',
      '^src/providers/',
      ['^src/(storage|ui|background)/', ...pkg('chrome|dexie|react')],
    ),
    forbid(
      'portals-restricted',
      'Portal adapters touch chrome only in inject.ts glue.',
      '^src/portals/',
      ['^src/(storage|ui|background)/', ...pkg('dexie|react')],
    ),
    forbid(
      'portals-chrome',
      'Portal adapters touch chrome only in inject.ts glue.',
      '^src/portals/',
      pkg('chrome'),
      { fromPathNot: '^src/portals/[^/]+/inject\\.ts$' },
    ),
    forbid(
      'storage-restricted',
      'Storage never reaches the UI, the worker, or the adapters.',
      '^src/storage/',
      ['^src/(ui|background|providers|portals)/', ...pkg('react')],
    ),
    forbid(
      'shared-restricted',
      'Shared helpers stay free of Dexie, React and the shell layers.',
      '^src/shared/',
      ['^src/(storage|background|ui)/', ...pkg('dexie|react')],
    ),
    forbid(
      'background-restricted',
      'The service worker never imports the UI or React.',
      '^src/background/',
      ['^src/ui/', ...pkg('react')],
    ),
    forbid(
      'ui-restricted',
      'The UI reads storage repos and sends commands; it never reaches adapters, the worker, or secrets.',
      '^src/ui/',
      [
        '^src/(providers|background)/',
        '^src/portals/[^/]+/readers',
        '^src/storage/.*\\.worker\\.ts$',
        '^src/storage/secrets',
      ],
    ),
    forbid(
      'no-import-entrypoints',
      'src/entrypoints is thin wiring and is never imported.',
      '^src/',
      ['^src/entrypoints/'],
      { fromPathNot: '^src/entrypoints/' },
    ),
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    parser: 'swc',
    tsPreCompilationDeps: true,
    exclude: { path: '^tests/' },
    includeOnly: undefined,
  },
};
