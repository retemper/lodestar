import { defineConfig } from '@retemper/lodestar';
import { base } from '@repo/lodestar-config';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';
import { pluginStructure } from '@retemper/lodestar-plugin-structure';

export default defineConfig([
  ...base,
  {
    plugins: [pluginArchitecture, pluginStructure],
    rules: {
      'structure/no-loose-files': {
        severity: 'error',
        options: {
          dirs: ['src'],
          allow: ['index.ts'],
        },
      },
      'architecture/layers': {
        severity: 'error',
        options: {
          layers: [
            { name: 'utils', path: 'src/utils/**/*.ts' },
            { name: 'resolvers', path: 'src/resolvers/**/*.ts', canImport: ['utils'] },
            { name: 'providers', path: 'src/providers/**/*.ts', canImport: ['utils', 'resolvers'] },
            { name: 'eslint', path: 'src/eslint/**/*.ts' },
            {
              name: 'engine',
              path: 'src/engine/**/*.ts',
              canImport: ['providers', 'resolvers', 'eslint', 'utils'],
            },
          ],
        },
      },
      'architecture/modules': {
        severity: 'error',
        options: { modules: ['src/utils', 'src/engine', 'src/providers', 'src/eslint'] },
      },
    },
  },
]);
