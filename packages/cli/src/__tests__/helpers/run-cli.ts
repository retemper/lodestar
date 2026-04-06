import { execFile } from 'node:child_process';
import { resolve } from 'node:path';

/** CLI execution result */
interface CliResult {
  /** Standard output captured from the child process */
  readonly stdout: string;
  /** Standard error captured from the child process */
  readonly stderr: string;
  /** Process exit code (0 = success) */
  readonly exitCode: number;
}

/** CLI execution options */
interface RunCliOptions {
  /** Working directory for the child process */
  readonly cwd: string;
  /** Maximum time to wait before killing the process (defaults to 15 000 ms) */
  readonly timeoutMs?: number;
}

const CLI_BIN = resolve(import.meta.dirname, '../../../dist/bin.js');

/** Monorepo root node_modules — allows child processes to resolve workspace packages */
const MONOREPO_ROOT = resolve(import.meta.dirname, '../../../../..');
const MONOREPO_NODE_MODULES = resolve(MONOREPO_ROOT, 'node_modules');

/**
 * Runs the lodestar CLI as a child process.
 * @param args - CLI arguments (e.g. ['check', '--format', 'json'])
 * @param options - Execution options (cwd is required)
 */
function runCli(args: readonly string[], options: RunCliOptions): Promise<CliResult> {
  return new Promise((res) => {
    execFile(
      'node',
      [CLI_BIN, ...args],
      {
        cwd: options.cwd,
        timeout: options.timeoutMs ?? 15_000,
        env: {
          ...process.env,
          NODE_NO_WARNINGS: '1',
          NODE_PATH: MONOREPO_NODE_MODULES,
        },
      },
      (error, stdout, stderr) => {
        const exitCode =
          error && 'code' in error && typeof error.code === 'number' ? error.code : error ? 1 : 0;
        res({ stdout: stdout.toString(), stderr: stderr.toString(), exitCode });
      },
    );
  });
}

export { runCli, CLI_BIN };
export type { CliResult, RunCliOptions };
