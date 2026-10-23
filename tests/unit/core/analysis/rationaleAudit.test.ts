import { describe, expect, it } from 'vitest';
import {
  AUDIT_TABLES,
  AUDIT_VERSION,
  type AuditTables,
  auditRationale,
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

const audit = (
  rationale: string,
  corpus: string,
  over: { score?: number; ids?: string[]; tables?: AuditTables } = {},
) => auditRationale(rationale, corpus, { score: 50, ids: [], ...over });

describe('auditRationale: durations (ANALYSIS-11)', () => {
  it.each([
    ['5 years', 'We need 5 years of TypeScript.', '6 years'],
    ['3 años', 'Se piden 3 años de experiencia.', '4 años'],
    ['18 months', 'Contract of 18 months.', '12 months'],
    ['2 semanas', 'Periodo de prueba de 2 semanas.', '3 semanas'],
    ['10 days', 'Respond within 10 days.', '9 days'],
  ])(
    '%s is grounded by the number in the corpus and ungrounded otherwise',
    (claim, offer, other) => {
      const rationale = `Candidate has ${claim} of relevant work.`;
      expect(audit(rationale, offer)).toEqual({
        count: 0,
        samples: [],
        auditVersion: AUDIT_VERSION,
      });
      expect(audit(rationale, other)).toEqual({
        count: 1,
        samples: [claim],
        auditVersion: AUDIT_VERSION,
      });
    },
  );

  it.each([
    ['1 year', 'year'],
    ['2 yrs', 'yrs'],
    ['3 months', 'months'],
    ['4 weeks', 'weeks'],
    ['5 days', 'days'],
    ['6 año', 'año'],
    ['7 meses', 'meses'],
    ['8 mes', 'mes'],
    ['9 semana', 'semana'],
    ['10 días', 'días'],
    ['11 dias', 'dias'],
    ['12 AÑOS', 'años in capitals'],
  ])('recognizes the unit word of %s (%s)', (claim) => {
    expect(audit(`About ${claim} here.`, 'nothing numeric').count).toBe(1);
  });

  it('keeps the literal span for a plus sign and a hyphenated unit', () => {
    expect(audit('Needs 3+ years and a 5-year plan.', '').samples).toEqual(['3+ years', '5-year']);
  });

  it('does not extract a number followed by a longer word that starts with a unit', () => {
    expect(audit('Talks to 5 yearsold clients and 3 daylight shifts.', '').count).toBe(0);
  });

  it('treats a final dot as punctuation: `5 years.` is 5', () => {
    expect(audit('Has 5 years.', 'five years').count).toBe(0);
    expect(audit('Has 5 years.', 'six years').samples).toEqual(['5 years']);
  });
});

describe('auditRationale: percentages, money and calendar years', () => {
  it('checks a percentage against the corpus', () => {
    expect(audit('A 40% overlap.', 'You will cut costs by 40%.').count).toBe(0);
    expect(audit('A 40% overlap.', 'You will cut costs by 30%.').samples).toEqual(['40%']);
    expect(audit('A 12,5 % share.', '12.5 per cent').count).toBe(0);
  });

  it.each([
    ['$120k', 'Salary $120,000', 'Salary $100,000'],
    ['€50.000', 'Salary 50,000 EUR', 'Salary 40,000 EUR'],
    ['USD 90000', 'Budget 90.000 dollars', 'Budget 80.000 dollars'],
    ['£40k', 'Pay of 40000', 'Pay of 30000'],
    ['2,5k', 'Bonus 2.500', 'Bonus 2.600'],
    ['1.500 €', 'Rent of 1,500 EUR', 'Rent of 1,600 EUR'],
    ['50,000 EUR', 'Salary €50.000', 'Salary €60.000'],
  ])('money %s is grounded across formats, ungrounded otherwise', (claim, offer, other) => {
    const rationale = `Offers ${claim} per year.`;
    expect(audit(rationale, offer).count).toBe(0);
    expect(audit(rationale, other)).toMatchObject({ count: 1, samples: [claim] });
  });

  it('expands a k suffix on the corpus side too', () => {
    expect(audit('Pays $120,000.', 'Salary 120k').count).toBe(0);
    expect(audit('Pays 120 USD.', 'Salary 120k').count).toBe(1);
  });

  it('extracts calendar years 1950 to 2099 only', () => {
    expect(audit('Since 2019.', 'Founded in 2019.').count).toBe(0);
    expect(audit('Since 2019.', 'Founded in 2018.').samples).toEqual(['2019']);
    expect(audit('Born 1950 and 2099.', '').count).toBe(2);
    expect(audit('Born 1949 and 2100.', '').count).toBe(0);
  });

  it('never reads a token with a separator as a calendar year', () => {
    expect(audit('Pays 2.025 in total.', '').count).toBe(0);
    expect(audit('Pays 2.025 EUR in total.', '').count).toBe(1);
  });
});

describe('auditRationale: number words in the corpus (EN and ES, one to twenty)', () => {
  it('grounds digits by a number word', () => {
    expect(audit('Has 5 years.', 'We need five years.').count).toBe(0);
    expect(audit('Tiene 5 años.', 'Se piden cinco años.').count).toBe(0);
    expect(audit('Has 20 years.', 'Twenty years of experience').count).toBe(0);
    expect(audit('Tiene 16 años.', 'Dieciséis años de experiencia').count).toBe(0);
    expect(audit('Has 1 year.', 'Un año de experiencia').count).toBe(0);
  });

  it('does not ground by a number word above twenty or by an unrelated word', () => {
    expect(audit('Has 21 years.', 'twenty-one years').count).toBe(1);
    expect(audit('Has 30 years.', 'thirty years').count).toBe(1);
  });

  it('does not read number words in the rationale as assertions', () => {
    expect(audit('Has five years.', '').count).toBe(0);
  });
});

describe('auditRationale: exclusions and non-assertions', () => {
  it('never extracts the integer equal to the score', () => {
    expect(audit('Scored 85 with an 85% fit.', '', { score: 85 }).count).toBe(0);
    expect(audit('Scored 85 with an 85% fit.', '', { score: 60 }).count).toBe(1);
  });

  it('never extracts digits inside claim, branch and dealbreaker ids', () => {
    expect(audit('Claims c-12 and c-3 fit; see b-2 and b-2/d1.', '').count).toBe(0);
    expect(audit('See c-5 for 5 years of work.', 'six years').samples).toEqual(['5 years']);
    expect(audit('See k-7 years.', '', { ids: ['k-7'] }).count).toBe(0);
  });

  it('does not read a currency code that ends a longer word as a currency', () => {
    expect(audit('Mentions Europeur 7 things and 5 usdx.', '').count).toBe(0);
    expect(audit('Pays EUR 7 and 5 eur.', '').count).toBe(2);
  });

  it('does not count bare counts', () => {
    expect(audit('Meets 2 of 3 requirements and 4 skills.', '').count).toBe(0);
  });

  it('leaves an unparseable token out: not an assertion, not counted', () => {
    expect(audit('Takes 1.2.3 years or 1,23.4%.', '').count).toBe(0);
  });

  it('does not add an unparseable corpus token to the corpus', () => {
    expect(audit('Has 123 years and 1234 years.', '1.2.3 and 1,23.4 and 12.3456.789').count).toBe(
      2,
    );
  });
});

describe('auditRationale: count and samples', () => {
  it('counts every ungrounded assertion and caps the samples at five', () => {
    const result = audit('1 year, 2 years, 3 years, 4 years, 6 years, 7 years, 8 years.', '');
    expect(result.count).toBe(7);
    expect(result.samples).toEqual(['1 year', '2 years', '3 years', '4 years', '6 years']);
  });

  it('reports a repeated span once in the samples but counts both', () => {
    const result = audit('5 years here and 5 years there.', '');
    expect(result.count).toBe(2);
    expect(result.samples).toEqual(['5 years']);
  });

  it('cuts a sample to 40 characters', () => {
    const result = audit(`Pays USD ${'9'.repeat(60)}.`, '');
    expect(result.count).toBe(1);
    expect(result.samples[0]).toHaveLength(40);
    expect(result.samples[0]?.startsWith('USD 99')).toBe(true);
  });

  it('yields an empty audit for a rationale with no assertions', () => {
    expect(audit('Good overlap with the stack.', 'anything 5')).toEqual({
      count: 0,
      samples: [],
      auditVersion: AUDIT_VERSION,
    });
  });

  it('is pure and deterministic', () => {
    const args = ['Has 5 years and $9k.', 'six years'] as const;
    expect(audit(...args)).toEqual(audit(...args));
    expect(audit(...args).count).toBe(2);
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

  it('uses the tables it is given: an added unit word is extracted', () => {
    const rationale = 'Has 3 anys of work.';
    expect(audit(rationale, '').count).toBe(0);
    const tables = { ...AUDIT_TABLES, durationUnits: [...AUDIT_TABLES.durationUnits, 'anys'] };
    expect(audit(rationale, '', { tables }).count).toBe(1);
  });

  it('records the version of the tables it ran with', () => {
    const tables = { ...AUDIT_TABLES, version: 'audit-test' };
    expect(audit('Nothing here.', '', { tables }).auditVersion).toBe('audit-test');
  });
});
