import { definePlugin } from '@retemper/types';
import { layers } from './rules/layers/index';
import { modules } from './rules/modules/index';
import { noCircular } from './rules/no-circular/index';
import { noCircularPackages } from './rules/no-circular-packages/index';

/** Plugin that enforces architectural rules — layers, module boundaries, and circular dependency detection */
const pluginArchitecture = definePlugin(() => ({
  name: '@retemper/plugin-architecture',
  rules: [layers, modules, noCircular, noCircularPackages],
}));

export { pluginArchitecture };
export { layers } from './rules/layers/index';
export { modules } from './rules/modules/index';
export { noCircular } from './rules/no-circular/index';
export { noCircularPackages } from './rules/no-circular-packages/index';
export type { LayerDefinition } from './rules/layers/index';
