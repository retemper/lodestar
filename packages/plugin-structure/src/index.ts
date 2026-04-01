import { definePlugin } from '@lodestar/types';
import { directoryExists } from './rules/directory-exists.js';
import { noForbiddenPath } from './rules/no-forbidden-path.js';
import { fileNaming } from './rules/file-naming.js';

/** Plugin for validating project directory structure */
const pluginStructure = definePlugin(() => ({
  name: '@lodestar/plugin-structure',
  rules: [directoryExists, noForbiddenPath, fileNaming],
}));

export default pluginStructure;
export { directoryExists, noForbiddenPath, fileNaming };
