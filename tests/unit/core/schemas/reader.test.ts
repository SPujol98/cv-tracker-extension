import { describe, expect, it } from 'vitest';
import {
  parseMarkers,
  parseSearchResult,
  READER_CAPS,
} from '../../../../src/core/schemas/reader.ts';

const LINKEDIN_ID = /^\d{1,20}$/;
const repeat = (length: number, char = 'a') => char.repeat(length);

const item = (over: Record<string, unknown> = {}) => ({
  id: '123',
  title: 'Engineer',
  company: 'Example Co',
  ...over,
});
const search = (items: unknown, over: Record<string, unknown> = {}) => ({
  ok: true,
  strategy: 'cards',
  noResults: false,
  data: items,
  ...over,
});
const MARKERS = {
  loginForm: false,
  authwall: false,
  challenge: false,
  contentRoot: true,
  noResults: false,
};

describe('the declared caps (ADR-14 item 7; A19)', () => {
  it('states every cap once', () => {
    expect(READER_CAPS).toEqual({
      id: 64,
      title: 300,
      company: 200,
      location: 200,
      text: 50_000,
      items: 100,
      attempted: 10,
      strategyName: 40,
    });
  });
});

describe('parseMarkers accepts exactly five booleans (PORTAL-3)', () => {
  it('returns the markers for five booleans', () => {
    expect(parseMarkers(MARKERS)).toEqual({ markers: MARKERS, detail: null });
    expect(parseMarkers({ ...MARKERS, authwall: true, contentRoot: false }).markers).toEqual({
      ...MARKERS,
      authwall: true,
      contentRoot: false,
    });
  });

  it.each([
    ['a string in place of a boolean', { ...MARKERS, authwall: 'false' }, ['authwall']],
    ['a number in place of a boolean', { ...MARKERS, loginForm: 0 }, ['loginForm']],
    ['a missing marker', { ...MARKERS, challenge: undefined }, ['challenge']],
    ['an extra key', { ...MARKERS, extra: true }, ['$']],
    ['null', null, ['$']],
  ])('rejects %s by field name only', (_name, raw, fields) => {
    const parsed = parseMarkers(raw);
    expect(parsed.markers).toBeNull();
    expect(parsed.detail).toMatchObject({ count: 1, fields });
  });
});

describe('parseSearchResult strict shape and caps (PRIV-11, PORTAL-3, PORTAL-4)', () => {
  it('parses a valid result and keeps the strategy', () => {
    const { result, detail } = parseSearchResult(
      search([item(), item({ id: '456', location: 'Remote' })]),
      LINKEDIN_ID,
    );
    expect(detail).toBeNull();
    expect(result).toEqual({
      ok: true,
      strategy: 'cards',
      data: [item(), item({ id: '456', location: 'Remote' })],
    });
  });

  it.each([
    ['at the top level', { ...search([item()]), href: 'https://evil.example/' }],
    ['inside an item', search([item({ href: 'https://evil.example/jobs/view/123/' })])],
    ['a URL-like field named canonicalUrl', search([item({ canonicalUrl: 'https://x.example/' })])],
    ['inside one of many items', search([item(), item({ id: '9', extra: 1 }), item({ id: '8' })])],
  ])('fails the whole result for an unknown field %s', (_name, raw) => {
    const { result, detail } = parseSearchResult(raw, LINKEDIN_ID);
    expect(result).toEqual({ ok: false, failure: 'unreadable', attempted: [] });
    expect(detail).not.toBeNull();
  });

  it.each([
    ['id', 64, (n: number) => item({ id: repeat(n, '1') })],
    ['title', 300, (n: number) => item({ title: repeat(n) })],
    ['company', 200, (n: number) => item({ company: repeat(n) })],
    ['location', 200, (n: number) => item({ location: repeat(n) })],
  ])('the %s cap is %i characters (one over fails the whole result)', (field, cap, make) => {
    const pattern = /^\d+$|^.+$/;
    expect(parseSearchResult(search([make(cap)]), pattern).result).toMatchObject({ ok: true });
    const over = parseSearchResult(search([item(), make(cap + 1)]), pattern);
    expect(over.result).toEqual({ ok: false, failure: 'unreadable', attempted: [] });
    expect(over.detail?.fields).toEqual([`data[].${field}`]);
  });

  it('allows 100 items and fails 101', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => item({ id: String(i + 1) }));
    const ok = parseSearchResult(search(many(100)), LINKEDIN_ID).result;
    expect(ok.ok && ok.data).toHaveLength(100);
    const over = parseSearchResult(search(many(101)), LINKEDIN_ID);
    expect(over.result).toEqual({ ok: false, failure: 'unreadable', attempted: [] });
    expect(over.detail?.fields).toEqual(['data']);
  });

  it('rejects a wrong type and a missing required field', () => {
    for (const raw of [
      search([item({ title: 5 })]),
      search([{ id: '1', title: 't' }]),
      search('nope'),
      null,
      [],
    ]) {
      expect(parseSearchResult(raw, LINKEDIN_ID).result).toEqual({
        ok: false,
        failure: 'unreadable',
        attempted: [],
      });
    }
  });
});

describe('parseSearchResult id pattern and noResults (PORTAL-3)', () => {
  it('drops an item whose id fails the pattern and keeps the others', () => {
    const { result } = parseSearchResult(
      search([item({ id: '1' }), item({ id: '12 34' }), item({ id: '../x' }), item({ id: '2' })]),
      LINKEDIN_ID,
    );
    expect(result).toEqual({
      ok: true,
      strategy: 'cards',
      data: [item({ id: '1' }), item({ id: '2' })],
    });
  });

  it('applies a stateful pattern the same way for every item', () => {
    const sticky = /^\d+$/g;
    const items = [item({ id: '1' }), item({ id: '2' }), item({ id: '3' })];
    const { result } = parseSearchResult(search(items), sticky);
    expect(result.ok && result.data.map((entry) => entry.id)).toEqual(['1', '2', '3']);
  });

  it('is unreadable when no valid item remains and noResults is false', () => {
    expect(parseSearchResult(search([item({ id: 'x' })]), LINKEDIN_ID).result).toEqual({
      ok: false,
      failure: 'unreadable',
      attempted: ['cards'],
    });
    expect(parseSearchResult(search([]), LINKEDIN_ID).result).toEqual({
      ok: false,
      failure: 'unreadable',
      attempted: ['cards'],
    });
  });

  it('returns an empty list only when noResults is true', () => {
    expect(parseSearchResult(search([], { noResults: true }), LINKEDIN_ID).result).toEqual({
      ok: true,
      strategy: 'cards',
      data: [],
    });
    expect(
      parseSearchResult(search([item({ id: 'x' })], { noResults: true }), LINKEDIN_ID).result,
    ).toEqual({ ok: true, strategy: 'cards', data: [] });
  });

  it('passes a reader failure through with its attempted strategies', () => {
    expect(
      parseSearchResult(
        { ok: false, failure: 'unreadable', attempted: ['cards', 'list'] },
        LINKEDIN_ID,
      ).result,
    ).toEqual({ ok: false, failure: 'unreadable', attempted: ['cards', 'list'] });
    expect(
      parseSearchResult({ ok: false, failure: 'permission_missing' }, LINKEDIN_ID).result,
    ).toEqual({ ok: false, failure: 'permission_missing' });
  });
});

describe('strategy names and attempted lists (PORTAL-4)', () => {
  const failure = (attempted: unknown[]) => ({ ok: false, failure: 'unreadable', attempted });

  it('allows 10 attempted names of 40 characters and fails 11 names', () => {
    const names = (n: number, length = 40) => Array.from({ length: n }, () => repeat(length));
    expect(parseSearchResult(failure(names(10)), LINKEDIN_ID).result).toEqual(failure(names(10)));
    const over = parseSearchResult(failure(names(11)), LINKEDIN_ID);
    expect(over.result).toEqual(failure([]));
    expect(over.detail?.fields).toEqual(['attempted']);
  });

  it('fails a strategy name of 41 characters, in attempted and in a success result', () => {
    expect(parseSearchResult(failure([repeat(41)]), LINKEDIN_ID).detail?.fields).toEqual([
      'attempted[]',
    ]);
    expect(
      parseSearchResult(search([item()], { strategy: repeat(41) }), LINKEDIN_ID).detail?.fields,
    ).toEqual(['strategy']);
    expect(
      parseSearchResult(search([item()], { strategy: repeat(40) }), LINKEDIN_ID).result,
    ).toMatchObject({ ok: true });
  });
});

describe('a failure message and its logged detail never carry page text (PRIV-11)', () => {
  const CANARY = 'CANARY-PAGE-TEXT-9f3a';

  it('names only the count and the fields for an over-cap value', () => {
    const { detail } = parseSearchResult(
      search([item({ title: `${CANARY}${repeat(400)}`, company: `${CANARY}${repeat(400)}` })]),
      LINKEDIN_ID,
    );
    expect(detail).toEqual({
      count: 2,
      fields: ['data[].company', 'data[].title'],
      message: 'Reader result rejected: 2 issues in data[].company, data[].title.',
    });
    expect(JSON.stringify(detail)).not.toContain(CANARY);
  });

  it('never echoes the name or value of an unknown field', () => {
    const { detail } = parseSearchResult(
      search([item({ [`${CANARY}-key`]: `${CANARY}-value` })]),
      LINKEDIN_ID,
    );
    expect(detail).toEqual({
      count: 1,
      fields: ['data[]'],
      message: 'Reader result rejected: 1 issue in data[].',
    });
    expect(JSON.stringify(detail)).not.toContain(CANARY);
  });
});
