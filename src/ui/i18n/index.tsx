import { createContext, type ReactNode, useContext, useSyncExternalStore } from 'react';
import type { UiLanguage } from '../../core/schemas/settings.ts';
import { en, type MessageKey } from './en.ts';
import { es } from './es.ts';

export type { MessageKey } from './en.ts';

const CATALOGS: Record<UiLanguage, Record<string, string>> = { en, es };

/** Resolves a key for a language. A missing key falls back to English, then to the key itself. */
export function translate(
  language: UiLanguage,
  key: MessageKey,
  catalog: Record<string, string> = CATALOGS[language],
): string {
  return catalog[key] ?? en[key] ?? key;
}

export interface I18n {
  getLanguage(): UiLanguage;
  setLanguage(language: UiLanguage): void;
  subscribe(listener: () => void): () => void;
  t(key: MessageKey): string;
}

/** A small observable holder so every mounted component follows a language change without reload. */
export function createI18n(initial: UiLanguage): I18n {
  let language = initial;
  const listeners = new Set<() => void>();
  return {
    getLanguage: () => language,
    setLanguage(next) {
      if (next === language) return;
      language = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    t: (key) => translate(language, key),
  };
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ i18n, children }: { i18n: I18n; children: ReactNode }) {
  return <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>;
}

export function useI18n(): { language: UiLanguage; t: (key: MessageKey) => string } {
  const i18n = useContext(I18nContext);
  if (!i18n) throw new Error('useI18n must be used inside an I18nProvider');
  const language = useSyncExternalStore(i18n.subscribe, i18n.getLanguage);
  return { language, t: (key) => translate(language, key) };
}
