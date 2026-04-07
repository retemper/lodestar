import { defineConfig } from 'lodestar';
import { pluginArchitecture } from '@retemper/plugin-architecture';
import { pluginStructure } from '@retemper/plugin-structure';
import { eslintAdapter } from '@retemper/adapter-eslint';
import { prettierAdapter } from '@retemper/adapter-prettier';
import { huskyAdapter } from '@retemper/adapter-husky';

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
