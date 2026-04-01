import { definePlugin } from '@lodestar/types';
import { noDeepImport } from './rules/no-deep-import.js';
import { noCrossLayer } from './rules/no-cross-layer.js';
import { manifestImports } from './rules/manifest-imports.js';

/** Plugin for enforcing module boundaries */
const pluginBoundary = definePlugin(() => ({
  name: '@lodestar/plugin-boundary',
  rules: [noDeepImport, noCrossLayer, manifestImports],
}));

export default pluginBoundary;
export { noDeepImport, noCrossLayer, manifestImports };
