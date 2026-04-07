import { defineRule } from '@retemper/types';

/** Ensure that certain paths do not exist in the project */
const noForbiddenPath = defineRule<{
  readonly patterns: readonly string[];
}>({
  name: 'structure/no-forbidden-path',
  description:
    'Verifies that forbidden paths do not exist. Each entry is a glob pattern — any match is a violation.',
  needs: ['fs'],
  schema: {
    type: 'object',
    properties: {
      patterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Glob patterns for paths that must NOT exist in the project',
      },
    },
    required: ['patterns'],
  },
  async check(ctx) {
    const { patterns } = ctx.options;

    for (const pattern of patterns) {
      const matches = await ctx.providers.fs.glob(pattern);
      for (const match of matches) {
        ctx.report({
          message: `Forbidden path "${match}" matches pattern "${pattern}"`,
          location: { file: match },
        });
      }
    }

    ctx.meta(`${patterns.length} patterns checked`);
  },
});

export { noForbiddenPath };
