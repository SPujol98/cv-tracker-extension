// Contract L manifest rules as a pure function, so negative fixtures can prove each failure message.

export const PERMISSIONS = ['storage', 'alarms', 'scripting', 'activeTab', 'sidePanel'];
export const OPTIONAL_PERMISSIONS = ['notifications', 'webRequest'];

// Optional host origins allowed per sub-change (cumulative). Later sub-changes extend this table.
export const ORIGINS_BY_SUBCHANGE: Record<number, string[]> = {
  0: [],
  3: ['https://api.anthropic.com/*', 'https://api.openai.com/*'],
  4: ['https://*.linkedin.com/*'],
  7: ['https://*.infojobs.net/*', 'https://api.github.com/*'],
};
export const CURRENT_SUBCHANGE = 0;

export function allowedOrigins(subchange: number): string[] {
  return Object.entries(ORIGINS_BY_SUBCHANGE)
    .filter(([n]) => Number(n) <= subchange)
    .flatMap(([, origins]) => origins)
    .sort();
}

// Exact top-level key allowlist (SHELL-1, amendment A21). Adding a key needs a written rationale in
// the same PR; a dependency or WXT upgrade that adds another surface (for example
// `web_accessible_resources` or `externally_connectable`) must fail the build test.
export const ALLOWED_MANIFEST_KEYS = [
  'manifest_version',
  'name',
  'description',
  'version',
  'version_name',
  'default_locale',
  'key',
  'minimum_chrome_version',
  'icons',
  'action',
  'background',
  'side_panel',
  'options_ui',
  'options_page',
  'commands',
  'permissions',
  'optional_permissions',
  'optional_host_permissions',
  'host_permissions',
  'content_security_policy',
];

type Json = Record<string, unknown>;

function sameSet(actual: unknown, expected: string[]): boolean {
  const a = [...((actual as string[] | undefined) ?? [])].sort();
  return JSON.stringify(a) === JSON.stringify([...expected].sort());
}

function extras(actual: unknown, expected: string[]): string[] {
  return ((actual as string[] | undefined) ?? []).filter((p) => !expected.includes(p));
}

export function checkManifest(m: Json, subchange = CURRENT_SUBCHANGE): string[] {
  const problems: string[] = [];
  for (const key of Object.keys(m)) {
    if (!ALLOWED_MANIFEST_KEYS.includes(key)) problems.push(`unexpected manifest key: ${key}`);
  }
  if (m.manifest_version !== 3) problems.push('manifest_version must be 3');

  if (!sameSet(m.permissions, PERMISSIONS)) {
    problems.push(`permissions must be exactly ${PERMISSIONS.join(', ')}`);
    for (const p of extras(m.permissions, PERMISSIONS))
      problems.push(`unexpected permission: ${p}`);
  }
  if (!sameSet(m.optional_permissions, OPTIONAL_PERMISSIONS)) {
    problems.push(`optional_permissions must be exactly ${OPTIONAL_PERMISSIONS.join(', ')}`);
    for (const p of extras(m.optional_permissions, OPTIONAL_PERMISSIONS)) {
      problems.push(`unexpected optional permission: ${p}`);
    }
  }
  for (const banned of ['unlimitedStorage', 'contextMenus']) {
    const all = [
      ...((m.permissions as string[]) ?? []),
      ...((m.optional_permissions as string[]) ?? []),
    ];
    if (all.includes(banned)) problems.push(`forbidden permission: ${banned}`);
  }

  const hosts = (m.host_permissions as string[] | undefined) ?? [];
  if (hosts.length > 0) problems.push(`host_permissions must be absent, found ${hosts.join(', ')}`);
  const optionalHosts = (m.optional_host_permissions as string[] | undefined) ?? [];
  if (!sameSet(optionalHosts, allowedOrigins(subchange))) {
    problems.push(`optional_host_permissions must equal the sub-change ${subchange} origin set`);
  }
  for (const h of [...hosts, ...optionalHosts]) {
    if (h === '<all_urls>' || h === '*://*/*')
      problems.push(`wildcard host matches all sites: ${h}`);
  }

  if ('content_scripts' in m) problems.push('content_scripts must be absent');

  const csp = ((m.content_security_policy as Json | undefined)?.extension_pages as string) ?? '';
  if (csp.includes('unsafe-eval')) problems.push('CSP contains unsafe-eval');
  if (/https?:\/\//.test(csp)) problems.push('CSP contains a remote source');

  const action = m.action as Json | undefined;
  if (action?.default_popup !== 'popup.html')
    problems.push('action.default_popup must be popup.html');
  if ((m.side_panel as Json | undefined)?.default_path !== 'sidepanel.html') {
    problems.push('side_panel.default_path must be sidepanel.html');
  }
  if (!(m.commands as Json | undefined)?.['analyze-page'])
    problems.push('commands.analyze-page is missing');
  if (Number(m.minimum_chrome_version) < 116)
    problems.push('minimum_chrome_version must be at least 116');
  return problems;
}
