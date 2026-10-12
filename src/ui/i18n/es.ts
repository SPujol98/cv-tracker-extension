import type { en, MessageKey } from './en.ts';

/** Spanish catalog. The type makes a missing or extra key a compile error (SHELL-8). */
export const es: Record<keyof typeof en, string> = {
  'common.save': 'Guardar',
  'common.cancel': 'Cancelar',
  'common.close': 'Cerrar',
  'settings.title': 'Ajustes',
  'settings.uiLanguage': 'Idioma de la interfaz',
  'settings.notifications': 'Notificaciones',
  'language.en': 'Inglés',
  'language.es': 'Español',
} satisfies Record<MessageKey, string>;
