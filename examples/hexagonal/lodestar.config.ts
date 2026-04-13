import { defineConfig } from '@retemper/lodestar';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';
import { pluginStructure } from '@retemper/lodestar-plugin-structure';
import { eslintAdapter } from '@retemper/lodestar-adapter-eslint';
import { prettierAdapter } from '@retemper/lodestar-adapter-prettier';

export default defineConfig([
  {
    plugins: [pluginArchitecture, pluginStructure],
    rules: {
      'architecture/layers': {
        severity: 'warn',
        options: {
          layers: [
            { name: 'core/domain', path: 'src/core/domain/**/*.ts' },
            { name: 'core/ports', path: 'src/core/ports/**/*.ts', canImport: ['core/domain'] },
            {
              name: 'core/use-cases',
              path: 'src/core/use-cases/**/*.ts',
              canImport: ['core/ports', 'core/domain'],
            },
            {
              name: 'adapters',
              path: 'src/adapters/**/*.ts',
              canImport: ['core/ports', 'core/domain'],
            },
            {
              name: 'config',
              path: 'src/config/**/*.ts',
              canImport: ['core/domain', 'core/ports', 'core/use-cases', 'adapters'],
            },
            {
              name: 'violations',
              path: 'src/violations/**/*.ts',
              canImport: ['core/ports', 'core/domain', 'adapters'],
            },
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
    ],
  },
]);
