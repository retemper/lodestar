import { defineConfig } from '@retemper/lodestar';
import { adapters, base } from '@repo/lodestar-config';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';
import { pluginStructure } from '@retemper/lodestar-plugin-structure';

export default defineConfig([
  ...base,
  adapters,
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
