import { defineConfig } from '@retemper/lodestar';
import { base } from '@repo/lodestar-config';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';

export default defineConfig([
  ...base,
  {
    plugins: [pluginArchitecture],
    rules: {
      'architecture/layers': {
        severity: 'error',
        options: {
          layers: [
            { name: 'reporters', path: 'src/reporters/**/*.ts' },
            { name: 'commands', path: 'src/commands/**/*.ts', canImport: ['reporters'] },
          ],
        },
      },
    },
  },
]);
