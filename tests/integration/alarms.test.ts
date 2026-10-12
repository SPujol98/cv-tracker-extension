import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { type AlarmDef, ensureAlarms, startAlarms } from '../../src/background/alarms.ts';
import background from '../../src/entrypoints/background.ts';
import { writeSettings } from '../../src/storage/settings.ts';

// SHELL-4, ADR-03, ADR-11: idempotent alarm reconciliation and the storage access level.
// The base settings have no schedule yet, so the tests gate a fake alarm on a base setting.
const DEFS: AlarmDef[] = [
  {
    name: 'beacon-tick',
    plan: (settings) => (settings.notificationsEnabled ? { periodInMinutes: 480 } : null),
  },
];

const names = async () => (await fakeBrowser.alarms.getAll()).map((alarm) => alarm.name).sort();

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
  vi.spyOn(fakeBrowser.i18n, 'getUILanguage').mockReturnValue('en');
});

describe('ensureAlarms', () => {
  it('registers no alarm for the default settings', async () => {
    await ensureAlarms(
      { uiLanguage: 'en', outputLanguage: 'en', notificationsEnabled: false },
      DEFS,
    );
    expect(await names()).toEqual([]);
  });

  it('is idempotent: repeated calls leave exactly one alarm', async () => {
    const enabled = { uiLanguage: 'en', outputLanguage: 'en', notificationsEnabled: true } as const;
    await ensureAlarms(enabled, DEFS);
    await ensureAlarms(enabled, DEFS);
    await ensureAlarms(enabled, DEFS);
    const alarms = await fakeBrowser.alarms.getAll();
    expect(alarms.map((a) => a.name)).toEqual(['beacon-tick']);
    expect(alarms[0]?.periodInMinutes).toBe(480);
  });

  it('removes a managed alarm when it is no longer wanted and leaves unmanaged ones', async () => {
    await fakeBrowser.alarms.create('queue-wake', { when: Date.now() + 60_000 });
    const enabled = { uiLanguage: 'en', outputLanguage: 'en', notificationsEnabled: true } as const;
    await ensureAlarms(enabled, DEFS);
    await ensureAlarms({ ...enabled, notificationsEnabled: false }, DEFS);
    expect(await names()).toEqual(['queue-wake']);
  });

  it('updates the period of an existing alarm', async () => {
    const enabled = { uiLanguage: 'en', outputLanguage: 'en', notificationsEnabled: true } as const;
    await ensureAlarms(enabled, DEFS);
    await ensureAlarms(enabled, [{ name: 'beacon-tick', plan: () => ({ periodInMinutes: 60 }) }]);
    expect((await fakeBrowser.alarms.getAll())[0]?.periodInMinutes).toBe(60);
  });
});

describe('startAlarms', () => {
  it('reconciles at start and again on every settings change', async () => {
    const stop = await startAlarms(DEFS);
    expect(await names()).toEqual([]);
    await writeSettings({ notificationsEnabled: true });
    await vi.waitFor(async () => expect(await names()).toEqual(['beacon-tick']));
    await writeSettings({ notificationsEnabled: false });
    await vi.waitFor(async () => expect(await names()).toEqual([]));
    stop();
  });

  it('re-registers the alarm after a worker restart without duplicating it', async () => {
    await writeSettings({ notificationsEnabled: true });
    (await startAlarms(DEFS))();
    (await startAlarms(DEFS))();
    expect(await names()).toEqual(['beacon-tick']);
  });
});

describe('background worker', () => {
  it('sets the TRUSTED_CONTEXTS access level on every start and registers no alarm by default', async () => {
    const setAccessLevel = vi.fn(async () => {});
    (
      fakeBrowser.storage.local as unknown as { setAccessLevel: typeof setAccessLevel }
    ).setAccessLevel = setAccessLevel;
    background.main();
    background.main();
    await vi.waitFor(() => expect(setAccessLevel).toHaveBeenCalledTimes(2));
    expect(setAccessLevel).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' });
    expect(await names()).toEqual([]);
  });

  it('registers the message router even when setAccessLevel is unsupported', async () => {
    background.main();
    expect(fakeBrowser.runtime.onMessage.hasListeners()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await names()).toEqual([]);
  });
});
