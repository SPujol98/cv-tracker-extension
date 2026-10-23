import { describe, expect, it } from 'vitest';
import { classify } from '../../../src/core/classify.ts';
import type { ClassifyTables, PageMarkers, PageState } from '../../../src/core/ports/portal.ts';

const tables: ClassifyTables = {
  loginUrl: [/\/login(?:\/|$|\?)/],
  authwallUrl: [/\/authwall(?:\/|$|\?)/],
  checkpointUrl: [/\/checkpoint\//],
  rateLimitStatuses: [429, 999],
};

const clean: PageMarkers = {
  loginForm: false,
  authwall: false,
  challenge: false,
  contentRoot: true,
  noResults: false,
};

const BASE = 'https://portal.example/jobs/view/1/';

type Case = [
  name: string,
  url: string,
  status: number | undefined,
  over: Partial<PageMarkers>,
  want: PageState,
];

const table: Case[] = [
  // precedence 1: rate limit beats everything
  ['rate limit beats a login marker', BASE, 429, { loginForm: true }, 'rate_limit'],
  [
    'rate limit 999 beats an authwall URL',
    'https://portal.example/authwall',
    999,
    {},
    'rate_limit',
  ],
  [
    'rate limit beats a checkpoint marker and no content',
    BASE,
    429,
    { challenge: true, contentRoot: false },
    'rate_limit',
  ],
  // precedence 2: login before authwall before checkpoint
  ['login URL', 'https://portal.example/login', undefined, {}, 'login'],
  ['login form marker', BASE, 200, { loginForm: true }, 'login'],
  ['login beats authwall', BASE, undefined, { loginForm: true, authwall: true }, 'login'],
  ['login beats checkpoint', BASE, undefined, { loginForm: true, challenge: true }, 'login'],
  [
    'login URL beats an authwall marker',
    'https://portal.example/login',
    undefined,
    { authwall: true },
    'login',
  ],
  ['authwall URL', 'https://portal.example/authwall?x=1', undefined, {}, 'authwall'],
  ['authwall marker', BASE, undefined, { authwall: true }, 'authwall'],
  ['authwall beats checkpoint', BASE, undefined, { authwall: true, challenge: true }, 'authwall'],
  [
    'authwall URL beats a checkpoint URL order',
    'https://portal.example/authwall',
    undefined,
    { challenge: true },
    'authwall',
  ],
  ['checkpoint URL', 'https://portal.example/checkpoint/challenge', undefined, {}, 'checkpoint'],
  ['challenge marker', BASE, undefined, { challenge: true }, 'checkpoint'],
  [
    'checkpoint beats a missing content root',
    BASE,
    undefined,
    { challenge: true, contentRoot: false },
    'checkpoint',
  ],
  // precedence 5 and 6
  ['no content root is an unreadable shell', BASE, 200, { contentRoot: false }, 'unreadable_shell'],
  ['a normal page is ok', BASE, 200, {}, 'ok'],
  ['no status is ok', BASE, undefined, {}, 'ok'],
  ['a non-rate-limit status is ok', BASE, 500, {}, 'ok'],
  ['no results with a content root is ok', BASE, 200, { noResults: true }, 'ok'],
];

describe('classify precedence (PORTAL-5; A13)', () => {
  it.each(table)('%s', (_name, url, status, over, want) => {
    expect(classify(tables, { url, status, markers: { ...clean, ...over } })).toBe(want);
  });

  it('treats unreadable_shell as a state of its own, not a wall', () => {
    const state = classify(tables, { url: BASE, markers: { ...clean, contentRoot: false } });
    expect(state).toBe('unreadable_shell');
    expect(['login', 'authwall', 'checkpoint', 'rate_limit']).not.toContain(state);
  });

  it('uses the tables it is given, not a fixed list', () => {
    const other: ClassifyTables = { ...tables, rateLimitStatuses: [503], loginUrl: [/\/signin/] };
    expect(classify(other, { url: BASE, status: 503, markers: clean })).toBe('rate_limit');
    expect(classify(other, { url: BASE, status: 429, markers: clean })).toBe('ok');
    expect(classify(other, { url: 'https://portal.example/signin', markers: clean })).toBe('login');
    expect(classify(other, { url: 'https://portal.example/login', markers: clean })).toBe('ok');
  });

  it('is not affected by the state of a global pattern between calls', () => {
    const sticky: ClassifyTables = { ...tables, loginUrl: [/\/login/g] };
    const input = { url: 'https://portal.example/login', markers: clean };
    expect(classify(sticky, input)).toBe('login');
    expect(classify(sticky, input)).toBe('login');
  });
});
