import { defineConfig } from 'lodestar';
import { base } from '@repo/lodestar-config';
import { pluginArchitecture } from '@lodestar/plugin-architecture';

export default defineConfig([
  ...base,
  {
    plugins: [pluginArchitecture],
    rules: {
      'architecture/layers': {
        severity: 'error',
        options: {
          layers: [
            { name: 'providers', path: 'src/providers/**/*.ts' },
            { name: 'eslint', path: 'src/eslint/**/*.ts' },
            { name: 'engine', path: 'src/*.ts', canImport: ['providers', 'eslint'] },
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
