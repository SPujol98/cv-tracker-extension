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

  it('survives a malformed percent escape without throwing', () => {
    expect(isAllowedNavigation('https://www.linkedin.com/jobs/view/1/?x=%E0%A4%A')).toBe(true);
    expect(isAllowedNavigation('https://www.linkedin.com/jobs-guest/%E0%A4%A')).toBe(false);
  });
});
