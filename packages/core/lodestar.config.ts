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
            { name: 'utils', path: 'src/{cache,logger,incremental}.ts' },
            { name: 'resolvers', path: 'src/resolvers/**/*.ts', canImport: ['utils'] },
            { name: 'providers', path: 'src/providers/**/*.ts', canImport: ['utils', 'resolvers'] },
            { name: 'eslint', path: 'src/eslint/**/*.ts' },
            {
              name: 'engine',
              path: 'src/{engine,workspace-runner,watcher,composite-reporter,validate}.ts',
              canImport: ['providers', 'resolvers', 'eslint', 'utils'],
            },
          ],
        },
      },
      'architecture/modules': {
        severity: 'error',
        options: { modules: ['src/providers', 'src/eslint'] },
      },
    },
  },
]);
