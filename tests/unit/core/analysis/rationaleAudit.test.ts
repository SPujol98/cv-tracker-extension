import { describe, expect, it } from 'vitest';
import {
  AUDIT_TABLES,
  AUDIT_VERSION,
  expandK,
  parseNumber,
} from '../../../../src/core/analysis/rationaleAudit.ts';
import { sha256Hex } from '../../../../src/core/hash.ts';

// Contract C "Step 8b numeric parsing": one row per token of the design table, plus the edges of
// each rule. Values are exact decimal strings (rule 6), never floats.
describe('parseNumber (Contract C, step 8b numeric parsing; ANALYSIS-11)', () => {
  it.each([
    // rule 1: no separator
    ['5', '5'],
    ['2019', '2019'],
    ['007', '7'],
    // rule 4: a single separator, thousands only with exactly three digits after it
    ['50,000', '50000'],
    ['50.000', '50000'],
    ['1.500', '1500'],
    ['2.025', '2025'],
    ['999.999', '999999'],
    ['1.5', '1.5'],
    ['1,5', '1.5'],
    ['0.250', '0.25'],
    ['0,250', '0.25'],
    ['1234.567', '1234.567'],
    ['50.00', '50'],
    ['50', '50'],
    ['3.14159', '3.14159'],
    // rule 3: one separator kind, two or more times
    ['1.234.567', '1234567'],
    ['1,234,567', '1234567'],
    // rule 2: both kinds, the last one is the decimal mark
    ['1.234,56', '1234.56'],
    ['1,234.56', '1234.56'],
    ['1.234.567,89', '1234567.89'],
    // rule 5 and 3: unparseable
    ['1.2.3', null],
    ['1,23.4', null],
    ['1.234.56', null],
    ['1234.567.890', null],
    ['12.3456.789', null],
    ['1,234.56.7', null],
    ['1.234,56,7', null],
    ['', null],
    ['abc', null],
    ['1..2', null],
    ['.5', null],
  ])('%s -> %s', (token, want) => {
    expect(parseNumber(token)).toBe(want);
  });

  it('treats a trailing dot or comma as punctuation (rule: `5 years.`)', () => {
    expect(parseNumber('5.')).toBe('5');
    expect(parseNumber('5,')).toBe('5');
    expect(parseNumber('1.5.')).toBe('1.5');
  });

  it('keeps the thousands reading of a three-digit group even when it could be a decimal', () => {
    // Decided ambiguity: 2.025 is 2025 and so is never a calendar year (rule 7).
    expect(parseNumber('2.025')).toBe('2025');
    expect(parseNumber('0.025')).toBe('0.025');
  });

  it('compares exact decimal strings: 50.00 equals 50 and no float rounding appears', () => {
    expect(parseNumber('50.00')).toBe(parseNumber('50'));
    expect(parseNumber('0.1')).toBe('0.1');
    expect(parseNumber('9007199254740993')).toBe('9007199254740993');
  });
});

describe('expandK multiplies an exact decimal string by 1,000 (the `k` suffix)', () => {
  it.each([
    ['120', '120000'],
    ['2.5', '2500'],
    ['1.2345', '1234.5'],
    ['0.5', '500'],
    ['0.0005', '0.5'],
    ['1', '1000'],
  ])('%s k -> %s', (value, want) => {
    expect(expandK(value)).toBe(want);
  });
});

describe('AUDIT_VERSION tracks the audit tables (ADR-29; the PROMPT_VERSION pattern)', () => {
  // A hash of every table and extraction constant. Changing any entry fails this test until
  // `AUDIT_VERSION` is bumped and the new pair is recorded here.
  const PINNED: Record<string, string> = {
    'audit-1': '66a4068363a45069f30a06bdb7fbe06697795704aaacae06bc7a3559c33a135a',
  };

  it('names the current version', () => {
    expect(AUDIT_VERSION).toBe('audit-1');
  });

  it('maps the table hash to the version', async () => {
    const hash = await sha256Hex(JSON.stringify(AUDIT_TABLES));
    expect(PINNED[AUDIT_VERSION]).toBe(hash);
  });
});
