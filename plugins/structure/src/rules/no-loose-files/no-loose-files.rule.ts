import { basename, extname } from 'node:path';
import { defineRule } from '@retemper/lodestar-types';

/** Forbids placing files directly in specified directories — files must live in subdirectories */
const noLooseFiles = defineRule<{
  readonly dirs: readonly string[];
  readonly allow?: readonly string[];
}>({
  name: 'structure/no-loose-files',
  description:
    'Forbids placing files directly in specified directories — files must live in subdirectories.',
  needs: ['fs'],
  schema: {
    type: 'object',
    properties: {
      dirs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Directories that must not contain loose files',
      },
      allow: {
        type: 'array',
        items: { type: 'string' },
        description: 'File names allowed at the directory root (e.g., "index.ts")',
      },
    },
    required: ['dirs'],
  },
  async check(ctx) {
    const allow = new Set(ctx.options.allow ?? []);
    let checked = 0;

    for (const dir of ctx.options.dirs) {
      const entries = await ctx.providers.fs.glob(`${dir}/*`);

      for (const entry of entries) {
        const name = basename(entry);
        if (!extname(name)) continue; // no extension → directory
        if (allow.has(name)) continue;

        checked++;
        ctx.report({
          message: `Loose file "${name}" in ${dir} — move it into a subdirectory`,
          location: { file: entry },
        });
      }
    }

    ctx.meta(`${checked} loose files found`);
  },
});

export { noLooseFiles };
