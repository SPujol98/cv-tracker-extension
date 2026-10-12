import { defineConfig } from '@playwright/test';

// Extensions load only in the full Chromium (new headless mode via `channel: 'chromium'`), not in
// the default headless shell. See tests/e2e/fixtures/extension.ts.
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
});
