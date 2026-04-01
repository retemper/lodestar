import { definePlugin } from '@lodestar/types';
import { noCircular } from './rules/no-circular.js';
import { noRestricted } from './rules/no-restricted.js';
import { dependencyDirection } from './rules/dependency-direction.js';

/** Plugin for dependency graph analysis and enforcement */
const pluginDeps = definePlugin(() => ({
  name: '@lodestar/plugin-deps',
  rules: [noCircular, noRestricted, dependencyDirection],
}));

export default pluginDeps;
export { noCircular, noRestricted, dependencyDirection };
