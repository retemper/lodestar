import { defineConfig } from '@retemper/lodestar';
import { base, eslintConfig, prettierConfig } from '@repo/lodestar-config';
import { eslintAdapter } from '@retemper/lodestar-adapter-eslint';
import { prettierAdapter } from '@retemper/lodestar-adapter-prettier';
import { huskyAdapter } from '@retemper/lodestar-adapter-husky';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';
import { pluginStructure } from '@retemper/lodestar-plugin-structure';

export default defineConfig([
  ...base,
  {
    adapters: [
      eslintAdapter({ ...eslintConfig }),
      prettierAdapter({ ...prettierConfig }),
      huskyAdapter({
        hooks: {
          'pre-commit': {
            adapters: ['prettier'],
            rules: ['structure/*', 'architecture/*'],
          },
          'pre-push': ['pnpm turbo build type-check lodestar', 'pnpm turbo test -- --coverage'],
        },
      }),
    ],
  },
  {
    plugins: [pluginArchitecture, pluginStructure],
    rules: {
      'architecture/no-circular-packages': 'error',
      'structure/no-forbidden-path': {
        severity: 'error',
        options: { patterns: ['**/*.log', '**/.env', '**/.env.*'] },
      },
      'structure/co-change-required': {
        severity: 'warn',
        options: {
          watch: ['packages/types/src/**/*.ts'],
          require: ['packages/test-utils/src/**/*.ts'],
          message: 'types 패키지가 변경되었지만 test-utils가 함께 업데이트되지 않았습니다.',
        },
      },
    },
  },
]);
