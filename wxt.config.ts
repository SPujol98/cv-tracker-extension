import { defineConfig } from 'wxt';

// Contract L: required permissions only. Host access is optional and requested at runtime.
export default defineConfig({
  srcDir: 'src',
  publicDir: 'public',
  modules: ['@wxt-dev/module-react'],
  vite: ({ mode }) => ({
    define: { 'import.meta.env.E2E': JSON.stringify(mode === 'e2e') },
  }),
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    minimum_chrome_version: '116',
    permissions: ['storage', 'alarms', 'scripting', 'activeTab', 'sidePanel'],
    optional_permissions: ['notifications', 'webRequest'],
    content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
    commands: {
      'analyze-page': {
        suggested_key: { default: 'Alt+Shift+A' },
        description: '__MSG_commandAnalyzePage__',
      },
    },
  },
});
