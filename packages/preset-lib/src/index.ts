import { definePreset } from '@lodestar/types';

/** Preset for library projects — enforces structure, naming, and export boundaries */
const presetLib = definePreset({
  name: '@lodestar/preset-lib',
  plugins: ['@lodestar/plugin-structure', '@lodestar/plugin-boundary', '@lodestar/plugin-deps'],
  rules: {
    'structure/directory-exists': {
      severity: 'error',
      options: { required: ['src'] },
    },
    'structure/file-naming': {
      severity: 'error',
      options: { convention: 'kebab-case', include: ['src/**/*.ts'] },
    },
    'boundary/no-deep-import': 'error',
    'deps/no-circular': 'error',
  },
  adapters: {
    eslint: { react: false },
    tsconfig: { base: 'universal' },
  },
});

export default presetLib;
