import { describe, expect, it } from 'vitest';
import { classifyHost, KNOWN_ATS_APEXES } from '../../../src/core/registry.ts';

// PORTAL-11 / Contract E (A20): every spoofing vector fails closed and none may reach `portal`.
describe('classifyHost rejects spoofing vectors without ever yielding portal (PORTAL-11)', () => {
  it.each([
    [
      'user information that names a portal',
      'https://linkedin.com@evil.example/jobs/view/1/',
      'userinfo',
      'evil.example',
    ],
    [
      'a portal apex used as a prefix label',
      'https://linkedin.com.evil.com/',
      'unknown_host',
      'linkedin.com.evil.com',
    ],
    ['a hyphenated look-alike', 'https://evil-linkedin.com/', 'unknown_host', 'evil-linkedin.com'],
    [
      'an encoded dot that WHATWG decodes into a longer host',
      'https://www.linkedin.com%2eevil.com/',
      'unknown_host',
      'www.linkedin.com.evil.com',
    ],
    [
      'a trailing dot',
      'https://www.linkedin.com./jobs/view/1/',
      'trailing_dot',
      'www.linkedin.com.',
    ],
    ['a punycode label', 'https://xn--lnkedin-xyz.com/', 'punycode', 'xn--lnkedin-xyz.com'],
    [
      'a Unicode look-alike (dotless i)',
      'https://lınkedin.com/',
      'punycode',
      'xn--lnkedin-rfb.com',
    ],
    [
      'a punycode label under a portal apex',
      'https://xn--a.www.linkedin.com/',
      'punycode',
      'xn--a.www.linkedin.com',
    ],
    ['http', 'http://www.linkedin.com/jobs/view/1/', 'not_https', 'www.linkedin.com'],
    [
      'a non-default port',
      'https://www.linkedin.com:8443/jobs/view/1/',
      'port',
      'www.linkedin.com',
    ],
    ['a javascript URL', 'javascript:alert(1)', 'not_https', null],
    ['a data URL', 'data:text/html,x', 'not_https', null],
    ['an unparseable string', 'not a url', 'unparseable', null],
    ['an empty string', '', 'unparseable', null],
  ])('%s', (_name, url, reason, host) => {
    expect(classifyHost(url)).toEqual({ kind: 'unverified', host, reason });
  });
});

describe('classifyHost accepts genuine portal hosts (PORTAL-11)', () => {
  it.each([
    ['the LinkedIn apex', 'https://linkedin.com/', 'linkedin', 'linkedin.com'],
    ['the LinkedIn www host', 'https://www.linkedin.com/', 'linkedin', 'www.linkedin.com'],
    ['a LinkedIn country subdomain', 'https://es.linkedin.com/', 'linkedin', 'es.linkedin.com'],
    [
      'an upper-case LinkedIn host',
      'https://WWW.LinkedIn.COM/jobs',
      'linkedin',
      'www.linkedin.com',
    ],
    ['the InfoJobs www host', 'https://www.infojobs.net/', 'infojobs', 'www.infojobs.net'],
    ['an InfoJobs subdomain', 'https://m.infojobs.net/x', 'infojobs', 'm.infojobs.net'],
    ['the explicit default port', 'https://www.linkedin.com:443/', 'linkedin', 'www.linkedin.com'],
  ])('classifies %s as a portal', (_name, url, source, host) => {
    expect(classifyHost(url)).toEqual({ kind: 'portal', source, host });
  });
});

describe('classifyHost known applicant-tracking hosts (PORTAL-11)', () => {
  it('lists a non-empty, lower-case, dot-free-of-edges apex table', () => {
    expect(KNOWN_ATS_APEXES.length).toBeGreaterThan(0);
    for (const apex of KNOWN_ATS_APEXES) {
      expect(apex).toBe(apex.toLowerCase());
      expect(apex.startsWith('.') || apex.endsWith('.')).toBe(false);
    }
  });

  it('classifies every listed apex and a subdomain of it as known_ats', () => {
    for (const apex of KNOWN_ATS_APEXES) {
      expect(classifyHost(`https://${apex}/`)).toEqual({ kind: 'known_ats', host: apex });
      expect(classifyHost(`https://jobs.${apex}/x`)).toEqual({
        kind: 'known_ats',
        host: `jobs.${apex}`,
      });
    }
  });

  it('does not accept look-alikes of a listed apex', () => {
    const [apex = ''] = KNOWN_ATS_APEXES;
    expect(classifyHost(`https://${apex}.evil.example/`)).toMatchObject({
      kind: 'unverified',
      reason: 'unknown_host',
    });
    expect(classifyHost(`https://evil${apex}/`)).toMatchObject({
      kind: 'unverified',
      reason: 'unknown_host',
    });
    expect(classifyHost(`https://${apex}:8443/`)).toMatchObject({
      kind: 'unverified',
      reason: 'port',
    });
  });

  it('classifies an unlisted host as unverified/unknown_host', () => {
    expect(classifyHost('https://careers.example/')).toEqual({
      kind: 'unverified',
      host: 'careers.example',
      reason: 'unknown_host',
    });
    expect(classifyHost('https://127.0.0.1/')).toEqual({
      kind: 'unverified',
      host: '127.0.0.1',
      reason: 'unknown_host',
    });
  });

  it('checks the portal table before the applicant-tracking table', () => {
    expect(classifyHost('https://boards.linkedin.com/')).toMatchObject({ kind: 'portal' });
  });
});
