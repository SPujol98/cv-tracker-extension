import { describe, expect, it } from 'vitest';
import {
  APPLY_WARNING_EXCERPT_CHARS,
  detectApplyWarnings,
} from '../../../src/core/applyWarnings.ts';

const categories = (text: string) =>
  detectApplyWarnings(text)
    .map((w) => w.category)
    .sort();

describe('detectApplyWarnings scenarios in English (ANALYSIS-7)', () => {
  it('reports email and cover_letter for a request with both', () => {
    expect(categories('Please send your CV and a cover letter to jobs@example.com')).toEqual([
      'cover_letter',
      'email',
    ]);
  });

  it('ignores a bare contact address', () => {
    expect(detectApplyWarnings('Our press contact: press@example.com')).toEqual([]);
  });

  it.each([
    ['Call +1 555 010 0000 to apply', 'phone'],
    ['Apply at careers.example.com/apply', 'external_site'],
    ['Tell us your earliest start date', 'start_date'],
    ['Provide two references', 'reference'],
    ['Include a link to your portfolio', 'portfolio'],
    ['Please state your salary expectations', 'salary_expectation'],
  ])('reports exactly one category for %j', (text, category) => {
    expect(categories(text)).toEqual([category]);
  });

  it('reports the five remaining categories once each from one text', () => {
    const text =
      'Call +1 555 010 0000 to apply. Apply at careers.example.com/apply. Tell us your earliest start date. ' +
      'Provide two references. Include a link to your portfolio.';
    expect(categories(text)).toEqual([
      'external_site',
      'phone',
      'portfolio',
      'reference',
      'start_date',
    ]);
  });
});

describe('detectApplyWarnings scenarios in Spanish (ANALYSIS-7)', () => {
  it('reports email and cover_letter', () => {
    expect(categories('Envía tu CV y una carta de presentación a jobs@example.com')).toEqual([
      'cover_letter',
      'email',
    ]);
  });

  it('ignores a bare contact address', () => {
    expect(detectApplyWarnings('Contacto de prensa: prensa@example.com')).toEqual([]);
  });

  it.each([
    ['Indica tu pretensión salarial en la candidatura', 'salary_expectation'],
    ['Llama al +34 600 000 000 para postular', 'phone'],
    ['Aplica en careers.example.com/apply', 'external_site'],
    ['Indica tu fecha de incorporación', 'start_date'],
    ['Facilita dos referencias', 'reference'],
    ['Incluye un enlace a tu portafolio', 'portfolio'],
  ])('reports exactly one category for %j', (text, category) => {
    expect(categories(text)).toEqual([category]);
  });
});

describe('precision-first negatives', () => {
  it.each([
    'We offer a competitive salary and a flexible start date.',
    'Our recruiters will call you after the review.',
    'Visit our offices in Madrid whenever you like.',
    'Cover letters are not part of our process.',
    'Send your CV. Our portfolio of clients is large.',
    'Ofrecemos un buen salario y fecha de incorporación flexible.',
    'Nuestro equipo te llamará tras la revisión.',
    'You will work with email campaigns and customer references.',
    '',
  ])('does not warn for %j', (text) => {
    expect(detectApplyWarnings(text)).toEqual([]);
  });

  it('needs the directive and the category cue close together in one sentence', () => {
    const far = `Please send your application as soon as you can and ${'with great care '.repeat(12)}including a cover letter.`;
    expect(detectApplyWarnings(far)).toEqual([]);
    expect(categories('Please send a cover letter with great care.')).toEqual(['cover_letter']);
  });
});

describe('result shape', () => {
  it('reports one warning per category, from the first match', () => {
    const first = 'Please send a cover letter.';
    const warnings = detectApplyWarnings(`${first} We also need a cover letter by Friday.`);
    expect(warnings).toEqual([{ category: 'cover_letter', excerpt: first }]);
  });

  it('keeps each excerpt literal and at most 160 characters', () => {
    const text = `Please email your CV to jobs@example.com ${'and then wait patiently '.repeat(20)}for our reply.`;
    const [warning] = detectApplyWarnings(text);
    expect(warning?.category).toBe('email');
    expect(warning?.excerpt.length).toBeLessThanOrEqual(APPLY_WARNING_EXCERPT_CHARS);
    expect(text).toContain(warning?.excerpt);
    expect(warning?.excerpt).toContain('jobs@example.com');
  });

  it('finds a cover-letter request in the tail of a 30,000-character text', () => {
    const text = `${'Regular description sentence. '.repeat(1000)}Please send a cover letter with your CV.`;
    expect(text.length).toBeGreaterThan(30_000);
    expect(categories(text)).toEqual(['cover_letter']);
  });

  it('is independent of invisible characters and extra whitespace', () => {
    expect(categories('Please​   send\n a   cover letter')).toEqual(['cover_letter']);
  });
});
