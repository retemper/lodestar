import { definePreset } from '@lodestar/types';

/** Preset for server projects — enforces hexagonal architecture boundaries */
const presetServer = definePreset({
  name: '@lodestar/preset-server',
  plugins: ['@lodestar/plugin-structure', '@lodestar/plugin-boundary', '@lodestar/plugin-deps'],
  rules: {
    'structure/directory-exists': {
      severity: 'error',
      options: { required: ['src'] },
    },
    'structure/no-forbidden-path': {
      severity: 'error',
      options: { patterns: ['src/**/*.tsx', 'src/**/*.jsx'] },
    },
    'boundary/no-cross-layer': {
      severity: 'error',
      options: { layers: ['domain', 'application', 'infrastructure', 'presentation'] },
    },
    'deps/no-circular': 'error',
    'deps/dependency-direction': {
      severity: 'error',
      options: {
        layers: [
          { name: 'domain', pattern: 'src/domain/**/*.ts' },
          { name: 'application', pattern: 'src/application/**/*.ts' },
          { name: 'infrastructure', pattern: 'src/infrastructure/**/*.ts' },
          { name: 'presentation', pattern: 'src/presentation/**/*.ts' },
        ],
      },
    },
  },
  adapters: {
    eslint: { react: false },
    tsconfig: { base: 'server' },
  },
});

export default presetServer;
