import { dirname, basename, extname, join } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { defineRule } from '@lodestar/types';

/** A pair definition linking source files to required companion files */
interface FilePair {
  /** Glob pattern matching source files */
  readonly source: string;
  /** Template for the required companion file — use {dir} and {name} placeholders */
  readonly required: string;
  /** Optional custom message when the paired file is missing */
  readonly message?: string;
}

/** Build the expected companion path from a source file and a template */
function buildRequiredPath(sourceFile: string, template: string): string {
  const dir = dirname(sourceFile);
  const ext = extname(sourceFile);
  const name = basename(sourceFile, ext);
  return template.replaceAll('{dir}', dir).replaceAll('{name}', name);
}

/** Ensure that source files have required companion files */
const pairedFiles = defineRule<{
  readonly pairs: readonly FilePair[];
}>({
  name: 'structure/paired-files',
  description:
    'Verifies that source files matching a glob have required companion files. Use {dir} and {name} placeholders in the required template.',
  needs: ['fs'],
  schema: {
    type: 'object',
    properties: {
      pairs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'Glob pattern matching source files' },
            required: {
              type: 'string',
              description: 'Template path with {dir} and {name} placeholders',
            },
            message: {
              type: 'string',
              description: 'Custom message when the paired file is missing',
            },
          },
          required: ['source', 'required'],
        },
        description: 'Pair definitions linking source files to required companion files',
      },
    },
    required: ['pairs'],
  },
  async check(ctx) {
    const { pairs } = ctx.options;
    const sourceCount = { value: 0 };

    for (const pair of pairs) {
      const sourceFiles = await ctx.providers.fs.glob(pair.source);
      sourceCount.value += sourceFiles.length;

      for (const sourceFile of sourceFiles) {
        const requiredPath = buildRequiredPath(sourceFile, pair.required);
        const exists = await ctx.providers.fs.exists(requiredPath);

        if (!exists) {
          const message =
            pair.message ?? `File "${sourceFile}" requires a companion file at "${requiredPath}"`;
          const fullPath = join(ctx.rootDir, requiredPath);
          ctx.report({
            message,
            location: { file: sourceFile },
            fix: {
              description: `Create "${requiredPath}"`,
              apply: async () => {
                await mkdir(dirname(fullPath), { recursive: true });
                await writeFile(fullPath, '', 'utf-8');
              },
            },
          });
        }
      }
    }

    ctx.meta(`${sourceCount.value} files, ${pairs.length} pairs`);
  },
});

export { pairedFiles };
export type { FilePair };
