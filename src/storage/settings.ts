import { browser } from 'wxt/browser';
import { resolveUiLanguage, type Settings, settingsSchema } from '../core/schemas/settings.ts';

const KEY = 'settings';

function parse(stored: unknown): Settings {
  const candidate = typeof stored === 'object' && stored !== null ? stored : {};
  const withLanguage = {
    uiLanguage: resolveUiLanguage(browser.i18n.getUILanguage()),
    ...candidate,
  };
  const result = settingsSchema.safeParse(withLanguage);
  // A corrupt stored object falls back to defaults instead of breaking every context.
  return result.success ? result.data : settingsSchema.parse({});
}

export async function readSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(KEY);
  return parse(stored[KEY]);
}

/** Merges a patch into the stored settings; the merged object must validate or nothing is written. */
export async function writeSettings(patch: Partial<Settings>): Promise<Settings> {
  const stored = await browser.storage.local.get(KEY);
  const next = settingsSchema.parse({ ...parse(stored[KEY]), ...patch });
  await browser.storage.local.set({ [KEY]: next });
  return next;
}

/** Subscribes to settings changes from any extension context. Returns an unsubscribe function. */
export function onSettingsChanged(listener: (settings: Settings) => void): () => void {
  const handler = (changes: Record<string, unknown>, area: string) => {
    if (area !== 'local' || !(KEY in changes)) return;
    const change = changes[KEY] as { newValue?: unknown };
    listener(parse(change.newValue));
  };
  browser.storage.onChanged.addListener(handler);
  return () => browser.storage.onChanged.removeListener(handler);
}
