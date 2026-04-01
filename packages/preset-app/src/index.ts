import { definePreset } from '@lodestar/types';

/** Preset for web applications — enforces layered architecture and module boundaries */
const presetApp = definePreset({
  name: '@lodestar/preset-app',
  plugins: [
    '@lodestar/plugin-structure',
    ['@lodestar/plugin-boundary', { manifestFile: 'module.json' }],
    '@lodestar/plugin-deps',
  ],
  rules: {
    'structure/directory-exists': {
      severity: 'error',
      options: { required: ['web/entry', 'web/service', 'universal'] },
    },
    'structure/file-naming': {
      severity: 'error',
      options: { convention: 'kebab-case', include: ['**/*.ts', '**/*.tsx'] },
    },
    'boundary/no-deep-import': {
      severity: 'error',
      options: { modules: ['web/service'] },
    },
    'boundary/no-cross-layer': {
      severity: 'error',
      options: { layers: ['universal', 'server', 'web/service', 'web/entry'] },
    },
    'boundary/manifest-imports': {
      severity: 'error',
      options: { manifestFile: 'module.json' },
    },
    'deps/no-circular': 'error',
  },
  adapters: {
    eslint: { react: true },
    jest: { preset: 'web' },
    prettier: {},
    husky: { preCommit: true },
    tsconfig: { base: 'web' },
  },
});

export default presetApp;
