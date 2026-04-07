import type { WrittenConfigBlock } from '@lodestar/types';
import { pluginStructure } from '@lodestar/plugin-structure';
import { base } from './base';

/** Config for plugin packages — base + paired-files rules */
const plugin: readonly WrittenConfigBlock[] = [
  ...base,
  {
    plugins: [pluginStructure],
    rules: {
      'structure/paired-files': {
        severity: 'error',
        options: {
          pairs: [
            {
              source: 'src/rules/**/*.rule.ts',
              required: '{dir}/{name}.spec.ts',
              message: 'Every .rule.ts must have a corresponding .rule.spec.ts',
            },
          ],
        },
      },
    },
  },
];

export { plugin };
