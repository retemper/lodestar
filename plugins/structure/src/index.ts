import { definePlugin } from '@retemper/lodestar-types';
import { directoryExists } from './rules/directory-exists/index';
import { noForbiddenPath } from './rules/no-forbidden-path/index';
import { pairedFiles } from './rules/paired-files/index';
import { coChangeRequired } from './rules/co-change-required/index';
import { noLooseFiles } from './rules/no-loose-files/index';

/** Plugin that enforces file system structure rules — directory existence, forbidden paths, paired file validation, and co-change enforcement */
const pluginStructure = definePlugin(() => ({
  name: '@retemper/lodestar-plugin-structure',
  rules: [directoryExists, noForbiddenPath, pairedFiles, coChangeRequired, noLooseFiles],
}));

export { pluginStructure };
export { directoryExists } from './rules/directory-exists/index';
export { noForbiddenPath } from './rules/no-forbidden-path/index';
export { pairedFiles } from './rules/paired-files/index';
export { coChangeRequired } from './rules/co-change-required/index';
export { noLooseFiles } from './rules/no-loose-files/index';
export type { FilePair } from './rules/paired-files/index';
