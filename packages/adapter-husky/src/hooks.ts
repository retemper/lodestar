/** Generate pre-commit hook content */
function generatePreCommitHook(options?: { lint?: boolean; format?: boolean }): string {
  const { lint = true, format = true } = options ?? {};
  const lines = ['#!/usr/bin/env sh', '. "$(dirname -- "$0")/_/husky.sh"', ''];

  if (format) {
    lines.push('pnpm format:check');
  }
  if (lint) {
    lines.push('pnpm lint');
  }
  lines.push('pnpm lodestar check');

  return lines.join('\n');
}

/** Generate commit-msg hook content */
function generateCommitMsgHook(): string {
  return [
    '#!/usr/bin/env sh',
    '. "$(dirname -- "$0")/_/husky.sh"',
    '',
    '# Add commit message validation here',
  ].join('\n');
}

export { generatePreCommitHook, generateCommitMsgHook };
