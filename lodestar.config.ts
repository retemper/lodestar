import { defineConfig } from 'lodestar';
import { adapters, base } from '@repo/lodestar-config';
import { pluginArchitecture } from '@lodestar/plugin-architecture';
import { pluginStructure } from '@lodestar/plugin-structure';

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
    },
  },
]);
