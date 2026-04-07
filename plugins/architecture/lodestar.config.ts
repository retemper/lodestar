import { defineConfig } from '@retemper/lodestar';
import { plugin } from '@repo/lodestar-config/plugin';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';

export default defineConfig([
  ...plugin,
  {
    plugins: [pluginArchitecture],
    rules: {
      'architecture/layers': {
        severity: 'error',
        options: {
          layers: [
            { name: 'shared', path: 'src/shared/**/*.ts' },
            { name: 'rules', path: 'src/rules/**/*.ts', canImport: ['shared'] },
          ],
        },
      },
    },
  },
]);
