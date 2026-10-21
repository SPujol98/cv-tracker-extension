import { describe, expect, it } from 'vitest';
import {
  capHeadTail,
  ELISION_MARKER,
  fold,
  HEAD_CHARS,
  MAX_OFFER_CHARS,
  normalizeOfferText,
  words,
} from '../../../src/core/text.ts';

describe('normalizeOfferText (ANALYSIS-3; A2)', () => {
  it('applies Unicode NFC', () => {
    expect(normalizeOfferText('Café')).toBe('Café');
  });

  it.each([
    ['U+200B', '​'],
    ['U+200C', '‌'],
    ['U+200D', '‍'],
    ['U+2060', '⁠'],
    ['U+FEFF', '﻿'],
    ['U+00AD', '­'],
    ['a bidi control', '‮'],
    ['a tag character', '\u{e0041}'],
  ])('removes %s', (_name, char) => {
    expect(normalizeOfferText(`ig${char}nore`)).toBe('ignore');
  });

  it('joins words that an invisible character split, so grounding and hashing agree', () => {
    expect(normalizeOfferText('send​ a⁠ letter')).toBe('send a letter');
  });

  it('collapses runs of whitespace to one space and trims', () => {
    expect(normalizeOfferText('  one \t two\n\n three   four  ')).toBe('one two three four');
  });

  it('does not cap the length', () => {
    const long = 'word '.repeat(10_000);
    expect(normalizeOfferText(long).length).toBe(long.length - 1);
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeOfferText(' ​\n ')).toBe('');
  });
});

describe('fold (A3)', () => {
  it('lowercases', () => {
    expect(fold('Senior ENGINEER')).toBe('senior engineer');
  });

  it('maps typographic quotes and apostrophes to ASCII', () => {
    expect(fold('“quoted” ‘single’ it’s „base‟')).toBe('"quoted" \'single\' it\'s "base"');
  });

  it('maps typographic dashes to ASCII hyphens', () => {
    expect(fold('a‐b‑c‒d–e—f―g−h')).toBe('a-b-c-d-e-f-g-h');
  });

  it('applies normalization first, so invisible characters and spacing do not matter', () => {
    expect(fold('  Re​act   —  Node ')).toBe('react - node');
  });

  it('treats typographic and ASCII spellings as equal', () => {
    expect(fold('We’re hiring – apply')).toBe(fold("We're hiring - apply"));
  });
});

describe('words', () => {
  it('splits on non-letter, non-digit characters', () => {
    expect(words('senior node.js engineer, remote')).toEqual([
      'senior',
      'node',
      'js',
      'engineer',
      'remote',
    ]);
  });

  it('keeps accented letters and digits inside tokens', () => {
    expect(words('diseño 3d años')).toEqual(['diseño', '3d', 'años']);
  });

  it('returns no tokens for punctuation only', () => {
    expect(words(' -- ... ')).toEqual([]);
  });
});

function numberedWords(chars: number): string {
  let out = '';
  for (let i = 0; out.length < chars; i++) {
    out += `w${String(i).padStart(5, '0')} `;
  }
  return out.slice(0, chars).trimEnd();
}

describe('capHeadTail (ANALYSIS-3; A16)', () => {
  it('exposes the documented constants', () => {
    expect(MAX_OFFER_CHARS).toBe(11_000);
    expect(HEAD_CHARS).toBe(8_000);
    expect(ELISION_MARKER).toBe(' […] ');
  });

  it('leaves text at or under the cap untouched', () => {
    const exact = numberedWords(11_000);
    expect(exact.length).toBeLessThanOrEqual(11_000);
    expect(capHeadTail(exact, 11_000)).toEqual({ text: exact, truncated: false });
    const small = 'a short offer';
    expect(capHeadTail(small, 11_000)).toEqual({ text: small, truncated: false });
  });

  it('truncates text one character over the cap', () => {
    const over = `${'a'.repeat(5_000)} ${'b'.repeat(6_000)}`;
    expect(over.length).toBe(11_001);
    const result = capHeadTail(over, 11_000);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(11_000);
  });

  it('keeps the first 8,000 characters and a tail that fills the rest, cut at whitespace', () => {
    const full = numberedWords(30_000);
    const { text, truncated } = capHeadTail(full, 11_000);
    expect(truncated).toBe(true);
    expect(text.length).toBeLessThanOrEqual(11_000);
    const [head, tail] = text.split(ELISION_MARKER) as [string, string];
    expect(text.split(ELISION_MARKER)).toHaveLength(2);
    // The head is a prefix of the full text that ends at a word boundary within the first 8,000.
    expect(full.startsWith(head)).toBe(true);
    expect(head.length).toBeLessThanOrEqual(8_000);
    expect(head.length).toBeGreaterThan(8_000 - 10);
    expect(full[head.length]).toBe(' ');
    // The tail is a suffix of the full text that starts at a word boundary.
    expect(full.endsWith(tail)).toBe(true);
    expect(full[full.length - tail.length - 1]).toBe(' ');
    expect(tail.length).toBeGreaterThan(11_000 - 8_000 - ELISION_MARKER.length - 10);
    expect(tail.length).toBeLessThanOrEqual(11_000 - 8_000 - ELISION_MARKER.length);
  });

  it('keeps an instruction placed in the last sentence of a long offer', () => {
    const closing = 'Please attach a cover letter.';
    const full = `${numberedWords(30_000)} ${closing}`;
    expect(capHeadTail(full, 11_000).text.endsWith(closing)).toBe(true);
  });

  it('falls back to a hard cut when there is no whitespace to cut at', () => {
    const full = 'x'.repeat(30_000);
    const { text, truncated } = capHeadTail(full, 11_000);
    expect(truncated).toBe(true);
    expect(text.length).toBe(11_000);
    expect(text.startsWith('x'.repeat(8_000))).toBe(true);
    expect(text.endsWith('x'.repeat(2_995))).toBe(true);
  });
});
