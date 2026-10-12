import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { z } from 'zod';
import { startAlarms } from '../background/alarms.ts';
import { createRouter } from '../background/router.ts';

// Zod v4 must never attempt `new Function` (SHELL-5): force the interpreted parser path.
z.config({ jitless: true });

// Thin wiring (SHELL-4): everything here re-runs at every service-worker start.
export default defineBackground(() => {
  // Listeners register synchronously so a woken worker never misses the event that woke it.
  const router = createRouter({ runtimeId: browser.runtime.id });
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void router(message, sender).then(sendResponse);
    return true;
  });

  void (async () => {
    // ADR-11: keep chrome.storage.local (settings, API keys) out of injected reader contexts.
    // Support at minimum_chrome_version is verified by spike S6; an unsupported browser must not
    // stop the worker, because the reader bundle build test is the fallback defence.
    try {
      await (
        browser.storage.local as unknown as {
          setAccessLevel(options: { accessLevel: 'TRUSTED_CONTEXTS' }): Promise<void>;
        }
      ).setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
    } catch {
      // Unsupported or failed: continue.
    }
    await startAlarms();
  })();
});
