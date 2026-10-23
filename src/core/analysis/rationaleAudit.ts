// Candidate-side grounding audit of the rationale (ANALYSIS-11; ADR-29; amendment A18), Contract C
// step 8b and derived step 9b. Pure and deterministic: no provider call, no clock, no locale. This
// file holds the single numeric parsing rule that both the rationale and the evidence corpus go
// through, so a figure written `€50.000` in an offer grounds `50,000 EUR` in a rationale.
//
// Catalan unit words and number words are added in sub-change 7 (task 7.4), which bumps
// `AUDIT_VERSION`; the tables below are EN and ES only.

import {
  type Diagnostics,
  MAX_UNGROUNDED_SAMPLE_CHARS,
  MAX_UNGROUNDED_SAMPLES,
} from '../schemas/analysis.ts';
import type { Profile } from '../schemas/profile.ts';
import { fold } from '../text.ts';
import { dealbreakerRefs } from './profileVersion.ts';

/** Identifies the audit logic; recorded with the ungrounded claims, never a cache-key component. */
export const AUDIT_VERSION = 'audit-2';

/**
 * Every table and extraction constant of the audit. A snapshot test hashes this object and maps the
 * hash to `AUDIT_VERSION`, so changing any entry without a version bump fails (ADR-29).
 */
export interface AuditTables {
  /** Recorded as `ungroundedClaims.auditVersion`. */
  version: string;
  /** Lowercase unit words that make `<number> <unit>` a duration assertion. */
  durationUnits: readonly string[];
  /** Number words in the corpus, mapped to the digits they stand for. */
  numberWords: Readonly<Record<string, string>>;
  currencySigns: string;
  /** Lowercase currency codes. */
  currencyCodes: readonly string[];
  /** Multiplies a number by 1,000 when it directly follows it. */
  thousandsSuffix: string;
  /**
   * A character class source: a number directly after one of these (and not after a currency
   * sign or code) is part of a longer token such as `ES2019` or `Python3`, not an assertion.
   */
  gluedLeft: string;
  /** Calendar years are separator-free 4-digit tokens in this inclusive range. */
  yearMin: number;
  yearMax: number;
  maxSamples: number;
  maxSampleChars: number;
}

export const AUDIT_TABLES: AuditTables = {
  version: AUDIT_VERSION,
  durationUnits: [
    // EN
    'year',
    'years',
    'yr',
    'yrs',
    'month',
    'months',
    'week',
    'weeks',
    'day',
    'days',
    // ES
    'año',
    'años',
    'ano',
    'anos',
    'mes',
    'meses',
    'semana',
    'semanas',
    'día',
    'días',
    'dia',
    'dias',
  ],
  numberWords: {
    // EN
    one: '1',
    two: '2',
    three: '3',
    four: '4',
    five: '5',
    six: '6',
    seven: '7',
    eight: '8',
    nine: '9',
    ten: '10',
    eleven: '11',
    twelve: '12',
    thirteen: '13',
    fourteen: '14',
    fifteen: '15',
    sixteen: '16',
    seventeen: '17',
    eighteen: '18',
    nineteen: '19',
    twenty: '20',
    // ES
    un: '1',
    uno: '1',
    una: '1',
    dos: '2',
    tres: '3',
    cuatro: '4',
    cinco: '5',
    seis: '6',
    siete: '7',
    ocho: '8',
    nueve: '9',
    diez: '10',
    once: '11',
    doce: '12',
    trece: '13',
    catorce: '14',
    quince: '15',
    dieciseis: '16',
    dieciséis: '16',
    diecisiete: '17',
    dieciocho: '18',
    diecinueve: '19',
    veinte: '20',
  },
  currencySigns: '€$£',
  currencyCodes: ['eur', 'usd', 'gbp'],
  thousandsSuffix: 'k',
  gluedLeft: '\\p{L}',
  yearMin: 1950,
  yearMax: 2099,
  maxSamples: MAX_UNGROUNDED_SAMPLES,
  maxSampleChars: MAX_UNGROUNDED_SAMPLE_CHARS,
};

/** Separators that appear inside a numeric token (Contract C, "Step 8b numeric parsing"). */
const NUMERIC_TOKEN = /^\d+(?:[.,]\d+)*$/;
const ALL_ZEROS = /^0+$/;
const TRAILING_PUNCTUATION = /[.,]$/;

/** A thousands group after the first holds exactly this many digits. */
const GROUP_DIGITS = 3;

/** Digits of the first thousands group: 1 to this many. */
const FIRST_GROUP_MAX_DIGITS = 3;

/** An exact decimal string: no leading zeros, no trailing fractional zeros (rule 6). */
function canonical(integer: string, fraction: string): string {
  const whole = integer.replace(/^0+(?=\d)/, '');
  const decimals = fraction.replace(/0+$/, '');
  return decimals === '' ? whole : `${whole}.${decimals}`;
}

/** Thousands groups: 1-3 digits first, exactly 3 digits for every later group. */
function validGroups(groups: readonly string[]): boolean {
  return groups.every((group, index) =>
    index === 0
      ? group.length >= 1 && group.length <= FIRST_GROUP_MAX_DIGITS
      : group.length === GROUP_DIGITS,
  );
}

const countOf = (text: string, mark: string): number => text.split(mark).length - 1;

/**
 * The value of one numeric token as an exact decimal string, or `null` when the rule cannot parse
 * it (such a token is not an assertion and is not added to the corpus). A trailing `.` or `,` is
 * punctuation. Rules in order: no separator is an integer; both kinds present make the last one
 * the decimal mark (exactly once) and the other the thousands mark; one kind two or more times is
 * a thousands mark; one separator once is a thousands mark only when exactly three digits follow
 * and the integer part is 1-3 digits and not zero, otherwise a decimal mark.
 */
export function parseNumber(raw: string): string | null {
  const token = raw.replace(TRAILING_PUNCTUATION, '');
  if (!NUMERIC_TOKEN.test(token)) return null;
  const dots = countOf(token, '.');
  const commas = countOf(token, ',');
  if (dots === 0 && commas === 0) return canonical(token, '');

  if (dots > 0 && commas > 0) {
    const decimalMark = token.lastIndexOf('.') > token.lastIndexOf(',') ? '.' : ',';
    const thousandsMark = decimalMark === '.' ? ',' : '.';
    if (countOf(token, decimalMark) !== 1) return null;
    const [integer = '', fraction = ''] = token.split(decimalMark);
    const groups = integer.split(thousandsMark);
    return validGroups(groups) ? canonical(groups.join(''), fraction) : null;
  }

  const mark = dots > 0 ? '.' : ',';
  const parts = token.split(mark);
  if (parts.length > 2) return validGroups(parts) ? canonical(parts.join(''), '') : null;
  const [integer = '', fraction = ''] = parts;
  const isThousands =
    fraction.length === GROUP_DIGITS &&
    integer.length <= FIRST_GROUP_MAX_DIGITS &&
    !ALL_ZEROS.test(integer);
  return isThousands ? canonical(integer + fraction, '') : canonical(integer, fraction);
}

/** The `k` suffix: an exact decimal string multiplied by 1,000 by moving the decimal point. */
export function expandK(value: string): string {
  const [integer = '', fraction = ''] = value.split('.');
  const padded = fraction.padEnd(GROUP_DIGITS, '0');
  return canonical(integer + padded.slice(0, GROUP_DIGITS), padded.slice(GROUP_DIGITS));
}

const NUMBER_RUN = /\d+(?:[.,]\d+)*/gu;
const SEPARATOR_FREE_YEAR = /^\d{4}$/;
const WORD_RUN = /\p{L}+/gu;
/** The generic id shapes, so ids of removed claims or branches are ignored as well. */
const ID_SHAPE = /\b[cb]-\d+(?:\/d\d+)?/giu;
/** A word character after a unit or code means it is the start of a longer word. */
const NOT_FOLLOWED_BY_WORD = '(?![\\p{L}\\p{N}])';

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
const blank = (text: string): string => ' '.repeat(text.length);

interface Assertion {
  /** The literal span of the rationale. */
  span: string;
  /** The normalized value as an exact decimal string. */
  value: string;
}

interface Matchers {
  moneyPrefix: RegExp;
  moneySuffix: RegExp;
  thousands: RegExp;
  duration: RegExp;
  gluedLeft: RegExp;
}

function matchersFor(tables: AuditTables): Matchers {
  const signs = `[${escapeRegExp(tables.currencySigns)}]`;
  const codes = tables.currencyCodes.map(escapeRegExp).join('|');
  const units = tables.durationUnits.map(escapeRegExp).join('|');
  return {
    moneyPrefix: new RegExp(
      `(?:${signs}|(?<![\\p{L}\\p{N}])(?:${codes})${NOT_FOLLOWED_BY_WORD})\\s*$`,
      'iu',
    ),
    moneySuffix: new RegExp(`^\\s*(?:${signs}|(?:${codes})${NOT_FOLLOWED_BY_WORD})`, 'iu'),
    thousands: new RegExp(`^${escapeRegExp(tables.thousandsSuffix)}${NOT_FOLLOWED_BY_WORD}`, 'iu'),
    duration: new RegExp(`^\\+?[\\s-]*(?:${units})${NOT_FOLLOWED_BY_WORD}`, 'iu'),
    gluedLeft: new RegExp(`${tables.gluedLeft}$`, 'u'),
  };
}

/** Replaces every id (known or id-shaped) by spaces of the same length, so spans stay aligned. */
function maskIds(text: string, ids: readonly string[]): string {
  let masked = text.replace(ID_SHAPE, blank);
  for (const id of ids) masked = masked.split(id).join(blank(id));
  return masked;
}

/**
 * Quantitative assertions of the rationale: money (a currency sign or code next to the number, or a
 * `k` suffix), percentages, durations and calendar years, in that precedence for one number. Bare
 * counts and the integer equal to `score` are not assertions, nor is a token the parsing rule
 * rejects.
 */
function extractAssertions(
  rationale: string,
  options: { score: number; ids: readonly string[] },
  tables: AuditTables,
): Assertion[] {
  const text = maskIds(rationale, options.ids);
  const match = matchersFor(tables);
  const found: Assertion[] = [];
  for (const run of text.matchAll(NUMBER_RUN)) {
    const token = run[0];
    const parsed = parseNumber(token);
    if (parsed === null || parsed === String(options.score)) continue;
    const start = run.index ?? 0;
    const end = start + token.length;
    const before = text.slice(0, start);
    const after = text.slice(end);

    const prefix = match.moneyPrefix.exec(before);
    if (!prefix && match.gluedLeft.test(before)) continue;
    const thousands = match.thousands.test(after);
    const afterThousands = thousands ? after.slice(tables.thousandsSuffix.length) : after;
    const suffix = match.moneySuffix.exec(afterThousands);
    const recordAssertion = (from: number, to: number, value: string) =>
      found.push({ span: rationale.slice(from, to), value });

    if (prefix || thousands || suffix) {
      const stop =
        end + (thousands ? tables.thousandsSuffix.length : 0) + (suffix?.[0].length ?? 0);
      recordAssertion(
        prefix ? start - prefix[0].length : start,
        stop,
        thousands ? expandK(parsed) : parsed,
      );
      continue;
    }
    const percent = /^\s*%/u.exec(after);
    if (percent) {
      recordAssertion(start, end + percent[0].length, parsed);
      continue;
    }
    const unit = match.duration.exec(after);
    if (unit) {
      recordAssertion(start, end + unit[0].length, parsed);
      continue;
    }
    const year = Number(token);
    if (SEPARATOR_FREE_YEAR.test(token) && year >= tables.yearMin && year <= tables.yearMax) {
      recordAssertion(start, end, parsed);
    }
  }
  return found;
}

/** Every numeric value of the corpus: numbers (a `k` suffix expands them) and number words. */
function corpusValues(corpus: string, tables: AuditTables): Set<string> {
  const text = fold(corpus);
  const { thousands } = matchersFor(tables);
  const values = new Set<string>();
  for (const run of text.matchAll(NUMBER_RUN)) {
    const parsed = parseNumber(run[0]);
    if (parsed === null) continue;
    const after = text.slice((run.index ?? 0) + run[0].length);
    values.add(thousands.test(after) ? expandK(parsed) : parsed);
  }
  for (const word of text.matchAll(WORD_RUN)) {
    const digits = tables.numberWords[word[0]];
    if (digits !== undefined) values.add(digits);
  }
  return values;
}

/**
 * Step 8b and derived step 9b. Counts the quantitative assertions of `rationale` whose value is
 * absent from `corpus` and keeps up to `maxSamples` distinct literal spans of at most
 * `maxSampleChars` characters. `tables` is a test seam (task 7.4 changes the default tables).
 */
export function auditRationale(
  rationale: string,
  corpus: string,
  options: { score: number; ids: readonly string[]; tables?: AuditTables },
): Diagnostics['ungroundedClaims'] {
  const tables = options.tables ?? AUDIT_TABLES;
  const known = corpusValues(corpus, tables);
  const ungrounded = extractAssertions(rationale, options, tables).filter(
    (assertion) => !known.has(assertion.value),
  );
  const samples = [
    ...new Set(ungrounded.map((a) => a.span.trim().slice(0, tables.maxSampleChars))),
  ].slice(0, tables.maxSamples);
  return { count: ungrounded.length, samples, auditVersion: tables.version };
}

/**
 * The evidence corpus: the folded request text plus the folded claim statements and tags, branch
 * names, rules and dealbreakers, one per line. Limited to the inputs of the cache key, so a cache
 * hit rebuilds the same corpus (ADR-29).
 */
export function buildCorpus(requestText: string, snapshot: Profile): string {
  const lines = [requestText];
  for (const claim of snapshot.claims) lines.push(claim.statement, ...claim.tags);
  for (const branch of snapshot.branches)
    lines.push(branch.name, ...branch.rules, ...branch.dealbreakers);
  return lines.map(fold).join('\n');
}

/** The ids whose digits are never assertions: claim and branch ids and dealbreaker references. */
export function snapshotIds(snapshot: Profile): string[] {
  return [
    ...snapshot.claims.map((claim) => claim.id),
    ...snapshot.branches.map((branch) => branch.id),
    ...dealbreakerRefs(snapshot).keys(),
  ];
}
