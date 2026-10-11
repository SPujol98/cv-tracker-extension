import { defineConfig } from 'wxt';

// Public half of the pinned key pair (ADR-15). The private key lives outside the repository.
const EXTENSION_PUBLIC_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkX7OvQqLtkfe70fnGCg9rT20F4m6YmehhaT/9xVlikAS6B+riS34Mnpq0Jn7VobCj5oA23+uaOnvYnmwCjzvD0hu3QBw/7cUOgQVcxMujgLLbYzd0esmvsVF6E9qYp10JXzNuA1RkzBxbjgQPee3yBX5nczPk85uhgFD4562si0vJwC73a5bhxiJNoVV0aOCUeGrUHbhWuXyI6l470odCPHnlC6/2LJjtKLqd5y8y/7VVSguq9A5H1ZiG1HQH7es46Xh+bs0KJjFM+mR+lkS5hltry/wP0usQyjK4XTbSb4IYo7GMGdMXTOG6Ekwc2+KJfJOEo4YJ9tgcjj8HTtJgwIDAQAB';

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
    key: EXTENSION_PUBLIC_KEY,
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
