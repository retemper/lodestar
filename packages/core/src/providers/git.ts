import { execFile } from 'node:child_process';
import type { GitProvider } from '@retemper/lodestar-types';

/** Result of a git command execution */
interface ExecGitResult {
  stdout: string;
  exitCode: number;
}

/**
 * Execute a git command and return its stdout.
 * Uses execFile (not exec) to avoid shell injection.
 *
 * By default, rejects on non-zero exit codes.
 * Set allowNonZero to true to resolve with the exit code instead (for commands
 * like `git merge-base --is-ancestor` that use exit code 1 for "not ancestor").
 */
function execGit(
  args: string[],
  cwd: string,
  allowNonZero = false,
): Promise<ExecGitResult> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (!error) {
        resolve({ stdout: stdout ?? '', exitCode: 0 });
        return;
      }

      // Extract the numeric exit code from the error object.
      // ExecFileException has `code` (string | number | undefined) and may carry
      // a numeric `status` property added by Node when the child exits non-zero.
      const err = error as unknown as Record<string, unknown>;
      const exitCode =
        typeof err.status === 'number'
          ? err.status
          : typeof err.code === 'number'
            ? err.code
            : null;

      if (exitCode !== null && allowNonZero) {
        resolve({ stdout: stdout ?? '', exitCode });
        return;
      }

      reject(error);
    });
  });
}

/** Parse newline-separated git output into a string array, filtering empties */
function parseLines(output: string): string[] {
  return output
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => line.replaceAll('\\', '/'));
}

/**
 * Create a git provider rooted at the given directory.
 * All git commands run with cwd set to rootDir.
 * The provider is read-only — no fetch, commit, push, or checkout operations.
 *
 * @param rootDir - absolute path to the project root (must be inside a git repository)
 */
function createGitProvider(rootDir: string): GitProvider {
  // Lazy validation: verified on first method call, then cached
  let gitAvailable: boolean | null = null;

  async function ensureGit(): Promise<void> {
    if (gitAvailable === true) return;
    if (gitAvailable === false) {
      throw new Error(
        'Git is not available. Ensure git is installed and the project is inside a git repository.',
      );
    }
    try {
      await execGit(['rev-parse', '--git-dir'], rootDir);
      gitAvailable = true;
    } catch {
      gitAvailable = false;
      throw new Error(
        'Git is not available. Ensure git is installed and the project is inside a git repository.',
      );
    }
  }

  return {
    async stagedFiles(): Promise<readonly string[]> {
      await ensureGit();

      // Only return staged files in commit hook context
      const isCommitContext = !!process.env.GIT_INDEX_FILE;
      if (!isCommitContext) {
        return [];
      }

      const { stdout } = await execGit(
        ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
        rootDir,
      );
      return parseLines(stdout);
    },

    async diffFiles(base: string, head?: string): Promise<readonly string[]> {
      await ensureGit();
      const ref = head ? `${base}...${head}` : `${base}...HEAD`;
      const { stdout } = await execGit(
        ['diff', '--name-only', '--diff-filter=ACMR', ref],
        rootDir,
      );
      return parseLines(stdout);
    },

    async diffContent(
      file: string,
      options?: { staged?: boolean; base?: string },
    ): Promise<string> {
      await ensureGit();
      const args = ['diff'];

      if (options?.staged) {
        args.push('--cached');
      } else if (options?.base) {
        args.push(options.base);
      }

      args.push('--', file);
      const { stdout } = await execGit(args, rootDir);
      return stdout;
    },

    async currentBranch(): Promise<string | null> {
      await ensureGit();
      const { stdout } = await execGit(
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        rootDir,
      );
      const branch = stdout.trim();
      // Detached HEAD returns literal "HEAD"
      return branch === 'HEAD' ? null : branch;
    },

    async isAncestor(ancestor: string, descendant?: string): Promise<boolean> {
      await ensureGit();
      const { exitCode } = await execGit(
        ['merge-base', '--is-ancestor', ancestor, descendant ?? 'HEAD'],
        rootDir,
        true,
      );
      return exitCode === 0;
    },
  };
}

export { createGitProvider };
