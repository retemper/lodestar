import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { defineRule } from '@retemper/types';

/** Ensure that required directories or files exist in the project */
const directoryExists = defineRule<{
  readonly required: readonly string[];
}>({
  name: 'structure/directory-exists',
  description:
    'Verifies that required directories or files exist. Each entry is a glob pattern — at least one match must be found.',
  needs: ['fs'],
  schema: {
    type: 'object',
    properties: {
      required: {
        type: 'array',
        items: { type: 'string' },
        description: 'Glob patterns for paths that must exist in the project',
      },
    },
    required: ['required'],
  },
  async check(ctx) {
    const { required } = ctx.options;

    for (const pattern of required) {
      const matches = await ctx.providers.fs.glob(pattern);
      if (matches.length === 0) {
        const isGlob = pattern.includes('*');
        ctx.report({
          message: `Required path "${pattern}" does not exist`,
          fix: isGlob
            ? undefined
            : {
                description: `Create directory "${pattern}"`,
                apply: async () => {
                  await mkdir(join(ctx.rootDir, pattern), { recursive: true });
                },
              },
        });
      }
    }

    ctx.meta(`${required.length} paths checked`);
  },
});

export { directoryExists };
