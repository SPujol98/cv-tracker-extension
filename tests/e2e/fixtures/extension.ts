import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type BrowserContext, test as base, chromium } from '@playwright/test';

/** Output of `pnpm build:e2e` (the E2E define is true; release builds never contain it). */
export const EXTENSION_BUILD_DIR = path.resolve('.output/chrome-mv3-e2e');

/**
 * Launches Chromium with the unpacked extension and returns the context plus its ID.
 * `channel: 'chromium'` selects the new headless mode, which supports extensions.
 */
export async function launchWithExtension(
  extensionDir: string,
): Promise<{ context: BrowserContext; extensionId: string }> {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker', { timeout: 15_000 }));
  const extensionId = new URL(worker.url()).host;
  return { context, extensionId };
}

/** Copies the build into a fresh temporary folder so the folder path differs between runs. */
export async function copyBuildToTempFolder(): Promise<{
  dir: string;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(path.join(tmpdir(), 'cvtracker-e2e-'));
  const dir = path.join(root, 'unpacked');
  await cp(EXTENSION_BUILD_DIR, dir, { recursive: true });
  return { dir, cleanup: () => rm(root, { recursive: true, force: true }) };
}

export const test = base.extend<{ extension: { context: BrowserContext; extensionId: string } }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured first argument.
  extension: async ({}, use) => {
    const folder = await copyBuildToTempFolder();
    const launched = await launchWithExtension(folder.dir);
    await use(launched);
    await launched.context.close();
    await folder.cleanup();
  },
});

export const expect = base.expect;
