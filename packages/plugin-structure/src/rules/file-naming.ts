import { defineRule } from '@lodestar/types';

/** Naming convention for files */
type NamingConvention = 'kebab-case' | 'camelCase' | 'PascalCase' | 'snake_case';

/** Enforce file naming conventions */
const fileNaming = defineRule<{
  convention: NamingConvention;
  include: readonly string[];
}>({
  name: 'structure/file-naming',
  description: 'Enforces a naming convention for files matching given patterns',
  needs: ['fs'],
  schema: {
    type: 'object',
    properties: {
      convention: {
        type: 'string',
        enum: ['kebab-case', 'camelCase', 'PascalCase', 'snake_case'],
      },
      include: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['convention', 'include'],
  },
  async check(ctx) {
    const { convention, include } = ctx.options;

    for (const pattern of include) {
      const files = await ctx.providers.fs.glob(pattern);
      for (const file of files) {
        const basename =
          file
            .split('/')
            .pop()
            ?.replace(/\.[^.]+$/, '') ?? '';
        if (!matchesConvention(basename, convention)) {
          ctx.report({
            message: `File "${file}" does not match ${convention} naming convention`,
            location: { file },
          });
        }
      }
    }
  },
});

/** Check if a name matches the given convention */
function matchesConvention(name: string, convention: NamingConvention): boolean {
  switch (convention) {
    case 'kebab-case':
      return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);
    case 'camelCase':
      return /^[a-z][a-zA-Z0-9]*$/.test(name);
    case 'PascalCase':
      return /^[A-Z][a-zA-Z0-9]*$/.test(name);
    case 'snake_case':
      return /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name);
  }
}

export { fileNaming };
export type { NamingConvention };
