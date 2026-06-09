// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    files: ['app/readiness.tsx'],
    rules: {
      // This file is intentionally huge and trips the hooks rule recursion.
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    ignores: ['dist/*'],
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
          paths: ['.'],
        },
      },
    },
    rules: {
      // Allow TS path aliases and root aliases like "components/*" or "lib/*".
      'import/no-unresolved': ['error', { ignore: ['^@/', '^app/', '^assets/', '^components/', '^constants/', '^cloudflare/', '^hooks/', '^lib/', '^scripts/', '^supabase/', '^types/'] }],
    },
  },
]);
