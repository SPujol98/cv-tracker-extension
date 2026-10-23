import { describe, expect, it } from 'vitest';
import { isAllowedNavigation } from '../../../src/core/guard.ts';
import { canonicalFor, mapUrl } from '../../../src/core/registry.ts';

describe('isAllowedNavigation accepts normal portal forms (PORTAL-6)', () => {
  it.each([
    ['a view URL', 'https://www.linkedin.com/jobs/view/3812345678/'],
    [
      'a view URL with a slug and tracking',
      'https://www.linkedin.com/jobs/view/slug-3812345678/?trk=x',
    ],
    ['the apex host', 'https://linkedin.com/jobs/view/3812345678/'],
    ['a country subdomain', 'https://es.linkedin.com/jobs/view/3812345678/'],
    [
      'a search page',
      'https://www.linkedin.com/jobs/search/?keywords=engineer&currentJobId=3812345678',
    ],
  ])('allows %s', (_name, url) => {
    expect(isAllowedNavigation(url)).toBe(true);
  });

  it('allows what canonicalFor builds, and the round trip stays allowed (A19)', () => {
    const built = canonicalFor('linkedin', '123');
    expect(built).not.toBeNull();
    expect(isAllowedNavigation(built ?? '')).toBe(true);
    expect(mapUrl(built ?? '')?.id).toBe('123');
  });
});

describe('isAllowedNavigation rejects disallowed access forms (PORTAL-6)', () => {
  it.each([
    ['guest endpoint in the path', 'https://www.linkedin.com/jobs-guest/jobs/api/x'],
    ['apply endpoint in the path', 'https://www.linkedin.com/job-apply/3812345678'],
    ['runSearch in the path', 'https://www.linkedin.com/jobs/runSearch/x'],
    ['runSearch in the query', 'https://www.linkedin.com/jobs/search/?runSearch=1'],
    ['runSearch in lower case', 'https://www.linkedin.com/jobs/search/?runsearch=1'],
    ['runSearch in upper case', 'https://www.linkedin.com/jobs/RUNSEARCH/x'],
    ['the guest form in upper case', 'https://www.linkedin.com/JOBS-GUEST/x'],
    ['the apply form in mixed case', 'https://www.linkedin.com/Job-Apply/x'],
    ['the guest form in the query', 'https://www.linkedin.com/jobs/view/1/?next=/jobs-guest/x'],
    ['a percent-encoded guest form', 'https://www.linkedin.com/%2Fjobs-guest%2Fx'],
    ['a percent-encoded runSearch', 'https://www.linkedin.com/jobs/run%53earch/x'],
    ['a guest form on a subdomain', 'https://es.linkedin.com/jobs-guest/x'],
  ])('rejects %s', (_name, url) => {
    expect(isAllowedNavigation(url)).toBe(false);
  });

  it.each([
    ['http', 'http://www.linkedin.com/jobs/view/1/'],
    ['a foreign host', 'https://example.com/jobs/view/1/'],
    ['a look-alike suffix host', 'https://linkedin.com.evil.example/jobs/view/1/'],
    ['a look-alike prefix host', 'https://evil-linkedin.com/jobs/view/1/'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a data URL', 'data:text/html,x'],
    ['an unparseable string', 'not a url'],
    ['an empty string', ''],
  ])('rejects %s', (_name, url) => {
    expect(isAllowedNavigation(url)).toBe(false);
  });

  it.each([
    ['a guest form that ends the path', 'https://www.linkedin.com/jobs-guest'],
    ['an apply form that ends the path', 'https://www.linkedin.com/job-apply'],
    ['a guest form followed by a query', 'https://www.linkedin.com/jobs-guest?x=1'],
    ['an apply form followed by a query', 'https://www.linkedin.com/job-apply?x=1'],
    ['a guest form that ends the query', 'https://www.linkedin.com/jobs/view/1/?next=/jobs-guest'],
    [
      'a guest form followed by another parameter',
      'https://www.linkedin.com/jobs/view/1/?n=/jobs-guest&a=1',
    ],
    ['an apply form that ends the query', 'https://www.linkedin.com/jobs/view/1/?next=/job-apply'],
    ['an encoded form that ends the path', 'https://www.linkedin.com/%2Fjobs-guest'],
  ])('rejects %s (R1 trailing forms)', (_name, url) => {
    expect(isAllowedNavigation(url)).toBe(false);
  });

  it.each([
    [
      'a longer segment that starts with the guest form',
      'https://www.linkedin.com/jobs-guestbook/x',
    ],
    ['a longer segment that starts with the apply form', 'https://www.linkedin.com/job-applyx'],
    ['a hyphenated continuation', 'https://www.linkedin.com/jobs-guest-room'],
  ])('allows %s', (_name, url) => {
    expect(isAllowedNavigation(url)).toBe(true);
  });

  describe('percent-decoding policy (R3): decode until stable, at most 3 rounds, fail closed', () => {
    it.each([
      ['double-encoded guest form', 'https://www.linkedin.com/%252Fjobs-guest%252Fx'],
      ['triple-encoded guest form', 'https://www.linkedin.com/%25252Fjobs-guest%25252Fx'],
      ['double-encoded runSearch', 'https://www.linkedin.com/jobs/run%2553earch/x'],
      [
        'double-encoded form in the query',
        'https://www.linkedin.com/jobs/view/1/?n=%252Fjob-apply',
      ],
      [
        'a form that needs four rounds is still unstable at the cap',
        'https://www.linkedin.com/%2525252Fjobs-guest',
      ],
      [
        'any text still changing after the cap',
        'https://www.linkedin.com/jobs/view/1/?q=%2525252541',
      ],
    ])('rejects %s', (_name, url) => {
      expect(isAllowedNavigation(url)).toBe(false);
    });

    it.each([
      [
        'a literal percent sign that decodes once',
        'https://www.linkedin.com/jobs/search/?keywords=100%25',
      ],
      ['a double-encoded harmless value', 'https://www.linkedin.com/jobs/search/?keywords=a%2520b'],
    ])('allows %s', (_name, url) => {
      expect(isAllowedNavigation(url)).toBe(true);
    });
  });

  it('survives a malformed percent escape without throwing', () => {
    expect(isAllowedNavigation('https://www.linkedin.com/jobs/view/1/?x=%E0%A4%A')).toBe(true);
    expect(isAllowedNavigation('https://www.linkedin.com/jobs-guest/%E0%A4%A')).toBe(false);
  });
  describe('a malformed escape never stops the rest of the text from decoding (R1-001)', () => {
    it.each([
      [
        'a stray percent sign before an encoded runSearch',
        'https://www.linkedin.com/jobs/%zz/run%53earch',
      ],
      [
        'a truncated UTF-8 escape before an encoded runSearch',
        'https://www.linkedin.com/jobs/%E0%A4%A/run%53earch/x',
      ],
      [
        'a truncated UTF-8 escape before an encoded guest form',
        'https://www.linkedin.com/%E0%A4%A%2Fjobs-guest%2Fx',
      ],
      [
        'a malformed escape after an encoded apply form',
        'https://www.linkedin.com/jobs/view/1/?n=%2Fjob-apply%zz',
      ],
      [
        'an encoded form beside a malformed escape on the second round',
        'https://www.linkedin.com/jobs/%25zz/run%2553earch',
      ],
    ])('rejects %s', (_name, url) => {
      expect(isAllowedNavigation(url)).toBe(false);
    });

    it.each([
      [
        'a stray percent sign in a harmless query',
        'https://www.linkedin.com/jobs/search/?keywords=%zz&currentJobId=1',
      ],
      [
        'a harmless escape beside a malformed one',
        'https://www.linkedin.com/jobs/search/?keywords=%41%E0%A4%A',
      ],
    ])('allows %s', (_name, url) => {
      expect(isAllowedNavigation(url)).toBe(true);
    });
  });
});

describe('isAllowedNavigation delegates to classifyHost: only a portal host passes (PORTAL-11, A20)', () => {
  const offer = '/jobs/view/3812345678/';
  const withUserinfo = (raw: string): string => {
    const url = new URL(raw);
    url.username = 'someone';
    return url.href;
  };

  it.each([
    ['user information on a portal host', withUserinfo(`https://www.linkedin.com${offer}`)],
    ['user information that names a portal', `https://linkedin.com@evil.example${offer}`],
    ['a suffix look-alike', `https://linkedin.com.evil.com${offer}`],
    ['a prefix look-alike', `https://evil-linkedin.com${offer}`],
    ['a trailing dot', `https://www.linkedin.com.${offer}`],
    ['a punycode host', `https://xn--lnkedin-xyz.com${offer}`],
    ['a Unicode look-alike', `https://l\u0131nkedin.com${offer}`],
    ['http', `http://www.linkedin.com${offer}`],
    ['a non-default port', `https://www.linkedin.com:8443${offer}`],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a data URL', 'data:text/html,x'],
    ['an unparseable string', 'not a url'],
  ])('rejects %s even with a LinkedIn offer path', (_name, url) => {
    expect(isAllowedNavigation(url)).toBe(false);
  });

  it.each([
    ['a known applicant-tracking host', 'https://boards.greenhouse.io/example/jobs/1'],
    ['an unverified host', 'https://careers.example/jobs/1'],
  ])('never allows %s', (_name, url) => {
    expect(isAllowedNavigation(url)).toBe(false);
  });

  it('still rejects the forbidden forms on a valid portal host and accepts the default port', () => {
    expect(isAllowedNavigation('https://www.linkedin.com/jobs-guest/x')).toBe(false);
    expect(isAllowedNavigation('https://www.linkedin.com/job-apply/1')).toBe(false);
    expect(isAllowedNavigation('https://www.linkedin.com/jobs/search/?runSearch=1')).toBe(false);
    expect(isAllowedNavigation(`https://www.linkedin.com:443${offer}`)).toBe(true);
  });
});
