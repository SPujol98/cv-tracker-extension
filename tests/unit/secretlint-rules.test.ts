import { afterAll, describe, expect, it } from 'vitest';
import { cleanup, makeRepo, runSecretlint, write } from './repo-policy/helpers.ts';

afterAll(cleanup);

// Samples are assembled at runtime so this file never contains a literal match for the rules it
// tests, and every sample is synthetic (reserved domains, fictional numbers, obviously fake keys).
const filler = 'A1b2C3d4E5f6G7h8I9j0';
const fake = {
  anthropicKey: ['sk', 'ant', `api03-${filler}`].join('-'),
  projectKey: ['sk', 'proj', filler].join('-'),
  genericKey: `${['sk'].join('')}-${filler}`,
  email: ['jane.doe', 'gmail.com'].join('@'),
  phone: ['+34', '612', '345', '678'].join(' '),
  localPhone: ['612', '345', '678'].join(' '),
  dni: `${'12345678'}${'Z'}`,
  nie: `${'X'}${'1234567'}${'L'}`,
};

function scan(content: string) {
  const dir = makeRepo();
  write(dir, 'sample.md', `${content}\n`);
  return runSecretlint(dir, 'sample.md');
}

describe('secretlint detects personal data and keys', () => {
  it.each(Object.entries(fake))('flags %s', (_name, value) => {
    const result = scan(`value: ${value}`);
    expect(result.code).toBe(1);
  });

  it('masks the matched value in the output', () => {
    const result = scan(`value: ${fake.projectKey}`);
    expect(result.code).toBe(1);
    expect(`${result.stdout}${result.stderr}`).not.toContain(fake.projectKey);
  });
});

describe('secretlint allows reserved example values', () => {
  it.each([
    'candidate@example.com',
    'someone@example.org',
    'dev@mail.example.net',
    'user@host.test',
    'bot@localhost.invalid',
    '+1 202 555 0123',
    '+44 7700 900123',
    '+34 600 000 042',
    '600 000 042',
    'plain prose with no personal data',
  ])('passes %s', (value) => {
    expect(scan(`value: ${value}`).code).toBe(0);
  });

  it('does not treat a lookalike domain as reserved', () => {
    expect(scan(`value: ${['x', 'example.com.evil.io'].join('@')}`).code).toBe(1);
  });
});
