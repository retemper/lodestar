import type { WrittenConfigBlock } from '@retemper/lodestar-types';
import type { EslintAdapterConfig } from '@retemper/lodestar-adapter-eslint';
import type { PrettierAdapterConfig } from '@retemper/lodestar-adapter-prettier';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';
import { pluginConventions } from '@repo/plugin-conventions';
import importX from 'eslint-plugin-import-x';
import unicorn from 'eslint-plugin-unicorn';

/** Shared rules and plugins — inherited by all packages */
const base: readonly WrittenConfigBlock[] = [
  {
    plugins: [pluginArchitecture, pluginConventions],
    rules: {
      'architecture/no-circular': 'error',
      'conventions/no-korean-comments': 'error',
    },
  },
];

/** Shared ESLint adapter config */
const eslintConfig: EslintAdapterConfig = {
  presets: ['strict'],
  plugins: { 'import-x': importX, unicorn },
  ignores: ['dist/**', 'node_modules/**', 'coverage/**', '**/*.js', '**/*.mjs'],
  rules: {
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    'import-x/no-default-export': 'error',
    'import-x/no-duplicates': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'unicorn/prefer-node-protocol': 'error',
    'unicorn/no-array-for-each': 'error',
    'unicorn/prefer-array-flat-map': 'error',
    'unicorn/prefer-string-replace-all': 'error',
    'unicorn/no-lonely-if': 'error',
    'unicorn/prefer-optional-catch-binding': 'error',
    'unicorn/no-useless-spread': 'error',
    'unicorn/no-useless-undefined': 'error',
    'unicorn/prefer-ternary': 'warn',
    'unicorn/no-negated-condition': 'warn',
  },
  overrides: [
    { files: ['**/lodestar.config.ts'], rules: { 'import-x/no-default-export': 'off' } },
    {
      files: ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
        'unicorn/no-useless-undefined': 'off',
      },
    },
  ],
};

/** Shared Prettier adapter config */
const prettierConfig: PrettierAdapterConfig = {
  singleQuote: true,
  trailingComma: 'all',
  semi: true,
  tabWidth: 2,
  printWidth: 100,
};

export { base, eslintConfig, prettierConfig };
