import type { WrittenConfigBlock } from '@lodestar/types';
import { pluginStructure } from '@lodestar/plugin-structure';
import { base } from './base';

/** 플러그인 패키지용 config — base + paired-files 규칙 */
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
