import { describe, expect, it } from 'vitest';
import { REDACTED, redact, redactError } from '../../../src/shared/redact.ts';

// Keys are assembled at runtime so the repository secret scan never sees a key-shaped literal.
const ANTHROPIC_KEY = ['sk', 'ant', 'api03', 'Zx9Qw8Er7Ty6Ui5Op4'].join('-');
const OPENAI_PROJECT_KEY = ['sk', 'proj', 'Ab12Cd34Ef56Gh78Ij90'].join('-');
const OPENAI_LEGACY_KEY = `sk-${'A1b2C3d4E5'.repeat(3)}`;
const USER_KEY = 'user-pasted-opaque-key-value';

describe('redact (PRIV-3)', () => {
  it('masks an explicitly supplied key value wherever it appears', () => {
    const out = redact(`Request failed for ${USER_KEY}; retry with ${USER_KEY}`, [USER_KEY]);
    expect(out).not.toContain(USER_KEY);
    expect(out).toBe(`Request failed for ${REDACTED}; retry with ${REDACTED}`);
  });

  it('masks provider key patterns without being told the key', () => {
    for (const key of [ANTHROPIC_KEY, OPENAI_PROJECT_KEY, OPENAI_LEGACY_KEY]) {
      const out = redact(`401 for key ${key} (see docs)`);
      expect(out).not.toContain(key);
      expect(out).toContain(REDACTED);
      expect(out).toContain('(see docs)');
    }
  });

  it('masks x-api-key and authorization header values, keeping the header name', () => {
    expect(redact(`x-api-key: ${USER_KEY}`)).toBe(`x-api-key: ${REDACTED}`);
    expect(redact(`X-Api-Key=${USER_KEY}`)).toBe(`X-Api-Key=${REDACTED}`);
    expect(redact(`Authorization: Bearer ${USER_KEY}`)).toBe(`Authorization: ${REDACTED}`);
    expect(redact(`{"authorization":"Bearer ${USER_KEY}"}`)).toBe(
      `{"authorization":"${REDACTED}"}`,
    );
    expect(redact(`{"x-api-key":"${USER_KEY}","other":1}`)).toBe(
      `{"x-api-key":"${REDACTED}","other":1}`,
    );
  });

  it('leaves text without secrets untouched and ignores empty secrets', () => {
    expect(redact('Rate limited, retry in 7 s', ['', USER_KEY])).toBe('Rate limited, retry in 7 s');
  });

  it('masks regex metacharacters in a supplied secret literally', () => {
    const key = 'a.b*c+d(e)';
    expect(redact(`oops ${key} oops`, [key])).toBe(`oops ${REDACTED} oops`);
    expect(redact('oops aXbbbcd(e) oops', [key])).toBe('oops aXbbbcd(e) oops');
  });
});

describe('redactError (PRIV-3)', () => {
  it('masks the message of an error', () => {
    expect(redactError(new Error(`bad key ${USER_KEY}`), [USER_KEY])).toBe(`bad key ${REDACTED}`);
  });

  it('masks nested cause messages and keeps the chain readable', () => {
    const inner = new Error(`inner echoed ${ANTHROPIC_KEY}`);
    const outer = new Error('outer failed', { cause: inner });
    const out = redactError(outer);
    expect(out).not.toContain(ANTHROPIC_KEY);
    expect(out).toContain('outer failed');
    expect(out).toContain('inner echoed');
  });

  it('handles non-Error values and cyclic causes', () => {
    expect(redactError(`raw ${USER_KEY}`, [USER_KEY])).toBe(`raw ${REDACTED}`);
    expect(redactError(42)).toBe('42');
    const loop = new Error('loop');
    loop.cause = loop;
    expect(redactError(loop)).toBe('loop');
  });
});
