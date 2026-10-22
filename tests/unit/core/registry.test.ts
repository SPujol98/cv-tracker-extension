import { describe, expect, it } from 'vitest';
import {
  canonicalFor,
  canonicalizeGenericUrl,
  hostPermissions,
  isRegistryUrl,
  LINKEDIN_ID_PATTERN,
  mapUrl,
} from '../../../src/core/registry.ts';

const canonical = (id: string) => `https://www.linkedin.com/jobs/view/${id}/`;

describe('canonicalFor (A19, PORTAL-3)', () => {
  it.each([
    ['123', canonical('123')],
    ['1', canonical('1')],
    ['3812345678', canonical('3812345678')],
    ['9'.repeat(20), canonical('9'.repeat(20))],
  ])('builds the canonical detail URL for the id %j', (id, url) => {
    expect(canonicalFor('linkedin', id)).toBe(url);
  });

  it.each([
    ['a space inside', '12 34'],
    ['path traversal', '../x'],
    ['21 digits', '1'.repeat(21)],
    ['an empty string', ''],
    ['a slash', '12/34'],
    ['a query', '123?x=1'],
    ['a fragment', '123#x'],
    ['letters', 'abc'],
    ['a leading sign', '+123'],
    ['a trailing newline', '123\n'],
    ['non-ASCII digits', '١٢٣'],
    ['a full URL', 'https://evil.example/jobs/view/1/'],
  ])('returns null for an id with %s', (_name, id) => {
    expect(canonicalFor('linkedin', id)).toBeNull();
  });

  it('round-trips through mapUrl', () => {
    const url = canonicalFor('linkedin', '123');
    expect(url).not.toBeNull();
    expect(mapUrl(url ?? '')?.id).toBe('123');
  });

  it('exposes the anchored id pattern the adapter will use', () => {
    expect(LINKEDIN_ID_PATTERN.test('123')).toBe(true);
    expect(LINKEDIN_ID_PATTERN.test('123 ')).toBe(false);
    expect(LINKEDIN_ID_PATTERN.test(' 123')).toBe(false);
  });

  it('returns null for a source whose URL shape is not registered yet', () => {
    expect(canonicalFor('infojobs', '123')).toBeNull();
  });
});

describe('mapUrl LinkedIn shapes (PORTAL-1)', () => {
  it.each([
    ['a view URL without a slug', 'https://www.linkedin.com/jobs/view/3812345678/'],
    ['a view URL without a trailing slash', 'https://www.linkedin.com/jobs/view/3812345678'],
    [
      'a view URL with a slug',
      'https://www.linkedin.com/jobs/view/senior-engineer-at-example-3812345678/',
    ],
    [
      'a slug containing digits',
      'https://www.linkedin.com/jobs/view/react-18-developer-3812345678',
    ],
    [
      'tracking parameters',
      'https://www.linkedin.com/jobs/view/3812345678/?trackingId=abc&refId=xyz&trk=foo',
    ],
    ['a fragment', 'https://www.linkedin.com/jobs/view/3812345678/#apply'],
    ['the apex host', 'https://linkedin.com/jobs/view/3812345678/'],
    ['a country subdomain', 'https://es.linkedin.com/jobs/view/3812345678/'],
    ['a deeper subdomain', 'https://m.es.linkedin.com/jobs/view/3812345678/'],
    ['an upper-case host', 'https://WWW.LinkedIn.com/jobs/view/3812345678/'],
    ['the default port', 'https://www.linkedin.com:443/jobs/view/3812345678/'],
    [
      'currentJobId on search',
      'https://www.linkedin.com/jobs/search/?keywords=engineer&currentJobId=3812345678',
    ],
    [
      'currentJobId on search-results',
      'https://www.linkedin.com/jobs/search-results/?currentJobId=3812345678&origin=x',
    ],
    [
      'currentJobId on a collection',
      'https://www.linkedin.com/jobs/collections/recommended/?currentJobId=3812345678',
    ],
    [
      'currentJobId on a country subdomain',
      'https://es.linkedin.com/jobs/search/?currentJobId=3812345678',
    ],
  ])('maps %s to the canonical view URL', (_name, url) => {
    expect(mapUrl(url)).toEqual({
      source: 'linkedin',
      id: '3812345678',
      canonicalUrl: canonical('3812345678'),
    });
  });

  it('is idempotent on its own canonical output', () => {
    const first = mapUrl('https://es.linkedin.com/jobs/view/slug-77/?trk=x');
    expect(first).not.toBeNull();
    const second = mapUrl(first?.canonicalUrl ?? '');
    expect(second).toEqual(first);
  });

  it('removes tracking parameters from the canonical URL', () => {
    const mapped = mapUrl('https://www.linkedin.com/jobs/view/55/?trackingId=abc&utm_source=x');
    expect(mapped?.canonicalUrl).toBe(canonical('55'));
    expect(mapped?.canonicalUrl).not.toContain('?');
  });

  it.each([
    ['a non-portal host', 'https://example.com/jobs/1'],
    ['a LinkedIn profile page', 'https://www.linkedin.com/in/someone/'],
    ['a LinkedIn feed page', 'https://www.linkedin.com/feed/'],
    [
      'a search page without currentJobId',
      'https://www.linkedin.com/jobs/search/?keywords=engineer',
    ],
    [
      'a currentJobId that is not numeric',
      'https://www.linkedin.com/jobs/search/?currentJobId=abc',
    ],
    [
      'a 21-digit currentJobId',
      `https://www.linkedin.com/jobs/search/?currentJobId=${'1'.repeat(21)}`,
    ],
    ['a view URL with extra segments', 'https://www.linkedin.com/jobs/view/123/other/'],
    ['a view URL without an id', 'https://www.linkedin.com/jobs/view/'],
    [
      'a slug without digits at the end',
      'https://www.linkedin.com/jobs/view/senior-engineer-at-example/',
    ],
    ['currentJobId on a non-search path', 'https://www.linkedin.com/in/someone/?currentJobId=123'],
    ['http instead of https', 'http://www.linkedin.com/jobs/view/123/'],
    ['a look-alike suffix host', 'https://linkedin.com.evil.example/jobs/view/123/'],
    ['a look-alike prefix host', 'https://evil-linkedin.com/jobs/view/123/'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['an unparseable string', 'not a url'],
    ['an empty string', ''],
  ])('returns null for %s', (_name, url) => {
    expect(mapUrl(url)).toBeNull();
  });
});

describe('hostPermissions derives from the host table (PORTAL-1, Contract L)', () => {
  it('lists the subdomain wildcard for LinkedIn', () => {
    expect(hostPermissions('linkedin')).toEqual(['https://*.linkedin.com/*']);
  });

  it('lists nothing for a source with no registered host yet', () => {
    expect(hostPermissions('infojobs')).toEqual([]);
  });
});

describe('canonicalizeGenericUrl (MANUAL-3)', () => {
  it.each([
    ['lowercases the host', 'https://Example.COM/Path', 'https://example.com/Path'],
    ['drops the fragment', 'https://example.com/a#section', 'https://example.com/a'],
    ['drops the default https port', 'https://example.com:443/a', 'https://example.com/a'],
    ['drops the default http port', 'http://example.com:80/a', 'http://example.com/a'],
    [
      'removes utm_ parameters',
      'https://example.com/a?utm_source=x&id=7&utm_medium=y',
      'https://example.com/a?id=7',
    ],
    [
      'removes utm_ regardless of case',
      'https://example.com/a?UTM_Campaign=x&id=7',
      'https://example.com/a?id=7',
    ],
    [
      'leaves no dangling question mark',
      'https://example.com/a?utm_source=x',
      'https://example.com/a',
    ],
    ['keeps a non-default port', 'https://example.com:8443/a', 'https://example.com:8443/a'],
    [
      'keeps other parameters in order',
      'https://example.com/a?b=2&a=1',
      'https://example.com/a?b=2&a=1',
    ],
  ])('%s', (_name, input, expected) => {
    expect(canonicalizeGenericUrl(input)).toBe(expected);
  });

  it('collapses two URLs that differ only by fragment', () => {
    expect(canonicalizeGenericUrl('https://example.com/job/1#a')).toBe(
      canonicalizeGenericUrl('https://example.com/job/1#b'),
    );
  });

  it('is idempotent', () => {
    const once = canonicalizeGenericUrl('https://Example.com:443/a?utm_x=1&k=2#f');
    expect(canonicalizeGenericUrl(once)).toBe(once);
  });

  it('returns an unparseable input unchanged', () => {
    expect(canonicalizeGenericUrl('not a url')).toBe('not a url');
  });
});

describe('isRegistryUrl is the registry-owned host check the guard uses (PORTAL-6)', () => {
  it.each([
    ['https://www.linkedin.com/anything', true],
    ['https://linkedin.com/', true],
    ['https://es.linkedin.com/x', true],
    ['http://www.linkedin.com/', false],
    ['https://linkedin.com.evil.example/', false],
    ['https://evil-linkedin.com/', false],
    ['https://example.com/', false],
    ['not a url', false],
    ['', false],
  ])('%s -> %s', (url, want) => {
    expect(isRegistryUrl(url)).toBe(want);
  });
});
