import { defineRule } from '@lodestar/types';

/** Ensure required directories exist in the project */
const directoryExists = defineRule<{ required: readonly string[] }>({
  name: 'structure/directory-exists',
  description: 'Ensures required directories exist in the project root',
  needs: ['fs'],
  schema: {
    type: 'object',
    properties: {
      required: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of directory paths that must exist',
      },
    },
    required: ['required'],
  },
  async check(ctx) {
    const requiredDirs = ctx.options.required;

    for (const dir of requiredDirs) {
      const exists = await ctx.providers.fs.exists(dir);
      if (!exists) {
        ctx.report({
          message: `Required directory "${dir}" does not exist`,
        });
      }
    }
  },
});

export { directoryExists };
