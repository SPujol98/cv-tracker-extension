import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    setupFiles: ['tests/setup/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      thresholds: { lines: 90 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/{unit,contract,integration}/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['tests/component/**/*.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'build',
          environment: 'node',
          include: ['tests/build/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'lint-fixtures',
          environment: 'node',
          include: ['tests/lint-fixtures/**/*.test.ts'],
        },
      },
    ],
  },
});
