import { describe, expect, it } from 'vitest';
import { resolveUiLanguage } from '../../src/core/schemas/settings.ts';
import { en } from '../../src/ui/i18n/en.ts';
import { es } from '../../src/ui/i18n/es.ts';
import { createI18n, translate } from '../../src/ui/i18n/index.tsx';

describe('catalog parity (SHELL-8)', () => {
  it('has identical key sets in English and Spanish', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it('has no empty values', () => {
    for (const catalog of [en, es]) {
      for (const value of Object.values(catalog)) expect(value.trim()).not.toBe('');
    }
  });
});

describe('default language', () => {
  it.each([
    ['es', 'es'],
    ['es-ES', 'es'],
    ['es-419', 'es'],
    ['en', 'en'],
    ['en-GB', 'en'],
    ['ca', 'en'],
    ['fr-FR', 'en'],
    ['', 'en'],
  ])('maps browser language %j to %j', (tag, expected) => {
    expect(resolveUiLanguage(tag)).toBe(expected);
  });
});

describe('translate', () => {
  it('returns the Spanish text for es', () => {
    expect(translate('es', 'common.save')).toBe(es['common.save']);
  });

  it('falls back to English when a key is missing at runtime', () => {
    const partial = { ...es } as Record<string, string>;
    delete partial['common.save'];
    expect(translate('es', 'common.save', partial)).toBe(en['common.save']);
  });

  it('returns the key itself when no catalog has it', () => {
    expect(translate('en', 'nope' as never)).toBe('nope');
  });
});

describe('createI18n', () => {
  it('notifies subscribers on a language change and stops after unsubscribe', () => {
    const i18n = createI18n('en');
    const seen: string[] = [];
    const off = i18n.subscribe(() => seen.push(i18n.getLanguage()));
    i18n.setLanguage('es');
    i18n.setLanguage('es');
    off();
    i18n.setLanguage('en');
    expect(seen).toEqual(['es']);
    expect(i18n.t('common.save')).toBe(en['common.save']);
  });
});
