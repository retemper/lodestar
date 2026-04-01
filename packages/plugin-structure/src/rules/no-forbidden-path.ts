import { defineRule } from '@lodestar/types';

/** Prevent certain file/directory patterns from existing */
const noForbiddenPath = defineRule<{ patterns: readonly string[] }>({
  name: 'structure/no-forbidden-path',
  description: 'Forbids files or directories matching given patterns',
  needs: ['fs'],
  schema: {
    type: 'object',
    properties: {
      patterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Glob patterns for forbidden paths',
      },
    },
    required: ['patterns'],
  },
  async check(ctx) {
    for (const pattern of ctx.options.patterns) {
      const matches = await ctx.providers.fs.glob(pattern);
      for (const match of matches) {
        ctx.report({
          message: `Forbidden path found: "${match}" (matched pattern: ${pattern})`,
          location: { file: match },
        });
      }
    }
  },
});

export { noForbiddenPath };
