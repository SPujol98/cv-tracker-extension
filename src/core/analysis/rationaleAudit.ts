// Candidate-side grounding audit of the rationale (ANALYSIS-11; ADR-29; amendment A18), Contract C
// step 8b and derived step 9b. Pure and deterministic: no provider call, no clock, no locale. This
// file holds the single numeric parsing rule that both the rationale and the evidence corpus go
// through, so a figure written `€50.000` in an offer grounds `50,000 EUR` in a rationale.

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
