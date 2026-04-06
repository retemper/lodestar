import { defineConfig } from 'lodestar';
import { pluginArchitecture } from '@lodestar/plugin-architecture';
import { pluginStructure } from '@lodestar/plugin-structure';
import { eslintAdapter } from '@lodestar/adapter-eslint';
import { prettierAdapter } from '@lodestar/adapter-prettier';
import { huskyAdapter } from '@lodestar/adapter-husky';

export default defineConfig([
  {
    plugins: [pluginArchitecture, pluginStructure],
    rules: {
      'architecture/layers': {
        severity: 'error',
        options: {
          layers: [
            { name: 'domain', path: 'src/domain/**/*.ts' },
            {
              name: 'application',
              path: 'src/application/**/*.ts',
              canImport: ['domain', 'shared'],
            },
            {
              name: 'infra',
              path: 'src/infra/**/*.ts',
              canImport: ['domain', 'application', 'shared'],
            },
            { name: 'shared', path: 'src/shared/**/*.ts' },
          ],
        },
      },
      'architecture/no-circular': 'error',
    },
    adapters: [
      eslintAdapter({
        presets: ['strict'],
      }),
      prettierAdapter({
        singleQuote: true,
        semi: true,
        printWidth: 100,
        include: ['**/*.ts'],
      }),
      huskyAdapter({
        hooks: {
          'pre-commit': ['npx lodestar check'],
        },
      }),
    ],
  },
]);
