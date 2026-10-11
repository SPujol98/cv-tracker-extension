import { browser } from 'wxt/browser';
import type { Settings } from '../core/schemas/settings.ts';
import { onSettingsChanged, readSettings } from '../storage/settings.ts';

export interface AlarmDef {
  name: string;
  /** The alarm this definition needs for the given settings, or null when it must not exist. */
  plan(settings: Settings): { periodInMinutes: number } | null;
}

/**
 * Every alarm the settings can require (ADR-03). `beacon-tick` joins with the scan schedule in
 * sub-change 6 and `update-check` with the update check in sub-change 7. `queue-wake` is owned by
 * the queue runner and never reconciled here. Fresh installs register nothing (SHELL-4).
 */
export const ALARM_DEFS: AlarmDef[] = [];

/** Idempotently makes the registered alarms match the settings: no duplicates, no extras. */
export async function ensureAlarms(settings: Settings, defs: AlarmDef[] = ALARM_DEFS) {
  const existing = new Map((await browser.alarms.getAll()).map((alarm) => [alarm.name, alarm]));
  for (const def of defs) {
    const wanted = def.plan(settings);
    const current = existing.get(def.name);
    if (!wanted) {
      if (current) await browser.alarms.clear(def.name);
    } else if (current?.periodInMinutes !== wanted.periodInMinutes) {
      await browser.alarms.create(def.name, wanted);
    }
  }
}

/** Reconciles now and on every settings change. Returns an unsubscribe function. */
export async function startAlarms(defs: AlarmDef[] = ALARM_DEFS): Promise<() => void> {
  await ensureAlarms(await readSettings(), defs);
  return onSettingsChanged((settings) => {
    void ensureAlarms(settings, defs);
  });
}
