import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { resolveUiLanguage, settingsSchema } from '../../src/core/schemas/settings.ts';
import { onSettingsChanged, readSettings, writeSettings } from '../../src/storage/settings.ts';

// ADR-11, SHELL-8: one Zod-validated settings object in chrome.storage.local.
beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
});

const stubLanguage = (tag: string) =>
  vi.spyOn(fakeBrowser.i18n, 'getUILanguage').mockReturnValue(tag);

describe('resolveUiLanguage', () => {
  it.each([
    ['es', 'es'],
    ['es-ES', 'es'],
    ['en-GB', 'en'],
    ['ca', 'en'],
    ['', 'en'],
  ])('maps %s to %s', (tag, expected) => {
    expect(resolveUiLanguage(tag)).toBe(expected);
  });
});

describe('settings defaults', () => {
  it('starts from defaults with outputLanguage following uiLanguage', async () => {
    stubLanguage('es-ES');
    expect(await readSettings()).toEqual({
      uiLanguage: 'es',
      outputLanguage: 'es',
      notificationsEnabled: false,
    });
  });

  it('falls back to English for an unsupported browser language', async () => {
    stubLanguage('ca');
    expect((await readSettings()).uiLanguage).toBe('en');
  });

  it('keeps an explicit outputLanguage different from the UI language', async () => {
    stubLanguage('en');
    await writeSettings({ uiLanguage: 'es', outputLanguage: 'fr' });
    expect(await readSettings()).toMatchObject({ uiLanguage: 'es', outputLanguage: 'fr' });
  });
});

describe('settings storage', () => {
  it('strips unknown stored keys', async () => {
    stubLanguage('en');
    await fakeBrowser.storage.local.set({
      settings: { uiLanguage: 'es', obsolete: 1, notificationsEnabled: true },
    });
    const settings = await readSettings();
    expect(settings).toEqual({
      uiLanguage: 'es',
      outputLanguage: 'es',
      notificationsEnabled: true,
    });
    expect(settings).not.toHaveProperty('obsolete');
  });

  it('rejects invalid writes and leaves the stored value untouched', async () => {
    stubLanguage('en');
    await writeSettings({ notificationsEnabled: true });
    await expect(writeSettings({ uiLanguage: 'fr' } as never)).rejects.toThrow();
    await expect(writeSettings({ notificationsEnabled: 'yes' } as never)).rejects.toThrow();
    expect((await readSettings()).notificationsEnabled).toBe(true);
    expect((await readSettings()).uiLanguage).toBe('en');
  });

  it('recovers defaults when the stored value is corrupt', async () => {
    stubLanguage('en');
    await fakeBrowser.storage.local.set({ settings: 'garbage' });
    expect((await readSettings()).notificationsEnabled).toBe(false);
  });

  it('notifies subscribers with the new validated settings, and only for settings', async () => {
    stubLanguage('en');
    const listener = vi.fn();
    const stop = onSettingsChanged(listener);
    await fakeBrowser.storage.local.set({ other: 1 });
    expect(listener).not.toHaveBeenCalled();
    await writeSettings({ notificationsEnabled: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ notificationsEnabled: true });
    stop();
    await writeSettings({ notificationsEnabled: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('settingsSchema', () => {
  it('accepts later additive keys without breaking the base object', () => {
    const parsed = settingsSchema.parse({ uiLanguage: 'en' });
    expect(parsed.outputLanguage).toBe('en');
  });
});
