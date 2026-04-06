import type { WrittenConfigBlock } from '@lodestar/types';
import { pluginArchitecture } from '@lodestar/plugin-architecture';
import { pluginConventions } from '@repo/plugin-conventions';
import { eslintAdapter } from '@lodestar/adapter-eslint';
import { prettierAdapter } from '@lodestar/adapter-prettier';
import { huskyAdapter } from '@lodestar/adapter-husky';
import importX from 'eslint-plugin-import-x';
import unicorn from 'eslint-plugin-unicorn';

/** 모노레포 공통 config — 모든 패키지가 상속 */
const base: readonly WrittenConfigBlock[] = [
  {
    plugins: [pluginArchitecture, pluginConventions],
    rules: {
      'architecture/no-circular': 'error',
      'conventions/no-korean-comments': 'error',
    },
    adapters: [
      eslintAdapter({
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
      }),
      prettierAdapter({
        singleQuote: true,
        trailingComma: 'all',
        semi: true,
        tabWidth: 2,
        printWidth: 100,
      }),
      huskyAdapter({
        hooks: {
          'pre-commit': ['npx lodestar check'],
        },
      }),
    ],
  },
];

export { base };
