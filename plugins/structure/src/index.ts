import { definePlugin } from '@lodestar/types';
import { directoryExists } from './rules/directory-exists/index';
import { noForbiddenPath } from './rules/no-forbidden-path/index';
import { pairedFiles } from './rules/paired-files/index';

/** Plugin that enforces file system structure rules — directory existence, forbidden paths, and paired file validation */
const pluginStructure = definePlugin(() => ({
  name: '@lodestar/plugin-structure',
  rules: [directoryExists, noForbiddenPath, pairedFiles],
}));

export { pluginStructure };
export { directoryExists } from './rules/directory-exists/index';
export { noForbiddenPath } from './rules/no-forbidden-path/index';
export { pairedFiles } from './rules/paired-files/index';
export type { FilePair } from './rules/paired-files/index';
