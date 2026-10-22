import { describe, expect, it } from 'vitest';
import {
  inferLanguage,
  LANG_LEAD_RATIO,
  LANG_MIN_SCORE,
  LANG_MIN_TOKENS,
} from '../../../src/core/language.ts';
import { LANGUAGES, type LanguageEntry, languageName } from '../../../src/core/languages.ts';

const ES =
  'Buscamos una persona con experiencia en el desarrollo de aplicaciones para nuestro equipo. ' +
  'El puesto requiere trabajar con los clientes y también participar en la mejora de los procesos ' +
  'de la empresa. Ofrecemos un contrato estable y formación continua para todas las personas que se incorporan.';

const EN =
  'We are looking for an engineer with experience in building web applications for our team. ' +
  'The position requires working with customers and also taking part in the improvement of the ' +
  'processes of the company. We offer a stable contract and continuous training for all the people who join us.';

const CA =
  "Busquem una persona amb experiència en el desenvolupament d'aplicacions per al nostre equip. " +
  "El lloc de treball requereix col·laborar amb els clients i també participar en la millora dels processos de l'empresa. " +
  "Oferim un contracte estable i formació contínua per a totes les persones que s'incorporen.";

describe('inferLanguage on clear texts (ANALYSIS-6)', () => {
  it.each([
    ['es', ES],
    ['en', EN],
    ['ca', CA],
  ])('infers %s from a synthetic text of about 40 words', (code, text) => {
    expect(inferLanguage(text)).toBe(code);
  });

  it('folds typographic apostrophes and invisible characters before counting', () => {
    expect(inferLanguage(CA.replaceAll("'", '’').replace('persona', 'per​sona'))).toBe('ca');
  });
});

describe('precision-first unknowns', () => {
  it('returns unknown below 20 word tokens, even for obvious text', () => {
    const short = 'Buscamos una persona con experiencia en el equipo de trabajo para la empresa';
    expect(short.split(' ')).toHaveLength(13);
    expect(inferLanguage(short)).toBe('unknown');
    expect(LANG_MIN_TOKENS).toBe(20);
  });

  it('accepts exactly 20 tokens', () => {
    const tokens = 'the team and the company with experience '.repeat(4).trim().split(' ');
    expect(inferLanguage(tokens.slice(0, 20).join(' '))).toBe('en');
    expect(inferLanguage(tokens.slice(0, 19).join(' '))).toBe('unknown');
  });

  it('returns unknown when two languages are about equally present', () => {
    expect(inferLanguage(`${ES} ${EN}`)).toBe('unknown');
  });

  it('returns unknown for text with no language signal at all', () => {
    expect(inferLanguage('zzz '.repeat(40))).toBe('unknown');
  });

  it('is not fooled by one Spanish company name in an English paragraph', () => {
    const text = `${EN} Our client is Banco Ejemplo S.A. and its Madrid office.`;
    expect(inferLanguage(text)).toBe('en');
  });

  it('infers from the whole text it is given, not a capped head', () => {
    const text = `${EN} ${'filler '.repeat(3000)} ${ES} ${ES} ${ES} ${ES}`;
    expect(text.length).toBeGreaterThan(11_000);
    expect(inferLanguage(text)).toBe('es');
  });
});

describe('thresholds are named constants (design: LANG_MIN_SCORE 3, LANG_LEAD_RATIO 1.5)', () => {
  // A synthetic table gives exact control over the scores: stopword hit = 1.
  const table: LanguageEntry[] = [
    { code: 'aa', name: 'Aaish', stopwords: ['alpha'], markers: [] },
    { code: 'bb', name: 'Bbish', stopwords: ['beta'], markers: [] },
  ];
  const text = (alpha: number, beta: number) =>
    [...Array(alpha).fill('alpha'), ...Array(beta).fill('beta'), ...Array(30).fill('zz')].join(' ');

  it('exports the values', () => {
    expect([LANG_MIN_SCORE, LANG_LEAD_RATIO]).toEqual([3, 1.5]);
  });

  it('needs a best score of at least 3', () => {
    expect(inferLanguage(text(2, 0), table)).toBe('unknown');
    expect(inferLanguage(text(3, 0), table)).toBe('aa');
  });

  it('needs the best to lead the runner-up by 1.5 times', () => {
    expect(inferLanguage(text(5, 4), table)).toBe('unknown');
    expect(inferLanguage(text(6, 4), table)).toBe('aa');
    expect(inferLanguage(text(4, 6), table)).toBe('bb');
  });

  it('scores a marker hit as two stopword hits', () => {
    const marked: LanguageEntry[] = [
      { code: 'aa', name: 'Aaish', stopwords: ['alpha'], markers: ['gamma'] },
      { code: 'bb', name: 'Bbish', stopwords: ['beta'], markers: [] },
    ];
    // two markers (4 points) against two stopwords (2 points) leads by 2x
    const t = `gamma gamma beta beta ${'zz '.repeat(30)}`;
    expect(inferLanguage(t, marked)).toBe('aa');
    // one marker plus one stopword is 3 points (the minimum); counting the marker once would give 2
    expect(inferLanguage(`gamma alpha beta beta ${'zz '.repeat(30)}`, marked)).toBe('aa');
  });
});

describe('extensible table (PROFILE-5)', () => {
  const synthetic: LanguageEntry = {
    code: 'xx',
    name: 'Xxish',
    stopwords: ['qux', 'quux', 'corge'],
    markers: ['zorp', 'grault'],
  };
  const text = `qux quux corge zorp grault qux zorp ${'filler '.repeat(20)}`;

  it('does not know the synthetic language by default', () => {
    expect(inferLanguage(text)).toBe('unknown');
  });

  it('returns a registered fourth language through the table parameter', () => {
    expect(inferLanguage(text, [...LANGUAGES, synthetic])).toBe('xx');
  });

  it('still infers the built-in languages with the extra entry present', () => {
    expect(inferLanguage(ES, [...LANGUAGES, synthetic])).toBe('es');
  });
});

describe('language table', () => {
  it('holds es, en and ca with names for the prompt', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(['es', 'en', 'ca']);
    expect(languageName('es')).toBe('Spanish');
    expect(languageName('en')).toBe('English');
    expect(languageName('ca')).toBe('Catalan');
  });

  it('writes a code the table does not name as the bare code', () => {
    expect(languageName('xx')).toBe('xx');
  });

  it('has no word in a stopword or marker list twice per entry, and markers are not stopwords', () => {
    for (const entry of LANGUAGES) {
      const all = [...entry.stopwords, ...entry.markers];
      expect(new Set(all).size).toBe(all.length);
      expect(all.every((word) => word === word.toLowerCase())).toBe(true);
    }
  });
});
