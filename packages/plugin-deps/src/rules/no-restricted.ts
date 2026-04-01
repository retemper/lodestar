import { defineRule } from '@lodestar/types';

/** Restriction rule for forbidden imports */
interface ImportRestriction {
  readonly from: string;
  readonly to: string;
  readonly message?: string;
}

/** Forbid specific import paths */
const noRestricted = defineRule<{
  restrictions: readonly ImportRestriction[];
}>({
  name: 'deps/no-restricted',
  description: 'Forbids specific import relationships between modules',
  needs: ['ast', 'fs'],
  schema: {
    type: 'object',
    properties: {
      restrictions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['from', 'to'],
        },
      },
    },
    required: ['restrictions'],
  },
  async check(ctx) {
    for (const restriction of ctx.options.restrictions) {
      const files = await ctx.providers.fs.glob(`${restriction.from}/**/*.ts`);

      for (const file of files) {
        const imports = await ctx.providers.ast.getImports(file);

        for (const imp of imports) {
          if (imp.source.includes(restriction.to)) {
            const message =
              restriction.message ??
              `Import from "${restriction.from}" to "${restriction.to}" is restricted`;
            ctx.report({ message, location: imp.location });
          }
        }
      }
    }
  },
});

export { noRestricted };
export type { ImportRestriction };
