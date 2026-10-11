import { z } from 'zod';

export const UI_LANGUAGES = ['en', 'es'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

/** Maps a browser UI language tag to a supported language: `es*` to `es`, anything else to `en`. */
export function resolveUiLanguage(tag: string): UiLanguage {
  return tag.toLowerCase().startsWith('es') ? 'es' : 'en';
}

/**
 * Base settings (ADR-11). Later sub-changes extend this object additively with provider and
 * keyStatus (3), tos and scan (6), csvMappings and updateCheck (7). Unknown keys are stripped.
 */
export const settingsSchema = z
  .object({
    uiLanguage: z.enum(UI_LANGUAGES).default('en'),
    outputLanguage: z.string().min(1).optional(),
    notificationsEnabled: z.boolean().default(false),
  })
  .transform((settings) => ({
    ...settings,
    outputLanguage: settings.outputLanguage ?? settings.uiLanguage,
  }));

export type Settings = z.output<typeof settingsSchema>;
