import { defineRule } from '@retemper/lodestar-types';

/** Enforce that changes to watched paths are accompanied by changes to required paths */
const coChangeRequired = defineRule<{
  readonly watch: readonly string[];
  readonly require: readonly string[];
  readonly exclude?: readonly string[];
  readonly message?: string;
}>({
  name: 'structure/co-change-required',
  description:
    'When files matching "watch" patterns are changed, files matching "require" patterns must also be changed.',
  needs: ['git'],
  schema: {
    type: 'object',
    properties: {
      watch: {
        type: 'array',
        items: { type: 'string' },
        description: 'Glob patterns for paths to watch for changes',
      },
      require: {
        type: 'array',
        items: { type: 'string' },
        description: 'Glob patterns for paths that must also be changed',
      },
      exclude: {
        type: 'array',
        items: { type: 'string' },
        description: 'Glob patterns to exclude from watch',
      },
      message: {
        type: 'string',
        description: 'Custom violation message',
      },
    },
    required: ['watch', 'require'],
  },
  async check(ctx) {
    const { git } = ctx.providers;
    const { watch, require: requirePatterns, exclude, message } = ctx.options;

    // Get changed files from staged (commit hook) or diff (CI/manual)
    const staged = await git.stagedFiles();
    const changed = staged.length > 0
      ? [...staged]
      : await git.diffFiles('origin/main').catch(() => [] as string[]);

    if (changed.length === 0) {
      ctx.meta('no changes detected');
      return;
    }

    const { minimatch } = await import('minimatch');

    const watchedChanged = changed.filter(
      (f) =>
        watch.some((p) => minimatch(f, p)) &&
        !(exclude ?? []).some((p) => minimatch(f, p)),
    );

    if (watchedChanged.length === 0) {
      ctx.meta(`${changed.length} files changed, 0 watched`);
      return;
    }

    const requiredChanged = changed.some((f) =>
      requirePatterns.some((p) => minimatch(f, p)),
    );

    if (!requiredChanged) {
      ctx.report({
        message:
          message ??
          `Watched files were changed (${watchedChanged.join(', ')}), but none of the required paths (${requirePatterns.join(', ')}) were updated.`,
      });
    }

    ctx.meta(`${watchedChanged.length} watched, ${changed.length} total`);
  },
});

export { coChangeRequired };
