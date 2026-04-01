import type { ArgumentsCamelCase } from 'yargs';
import { resolve } from 'node:path';
import { loadConfigFile } from '@lodestar/config';
import { resolveConfig } from '@lodestar/config';
import { run } from '@lodestar/core';
import { createConsoleReporter } from '../reporters/console.js';

/** Options for the check command */
interface CheckOptions {
  readonly config?: string;
  readonly format: string;
}

/** Execute architecture rule checks */
async function checkCommand(args: ArgumentsCamelCase<CheckOptions>): Promise<void> {
  const rootDir = resolve(process.cwd());

  const writtenConfig = await loadConfigFile(rootDir);
  if (!writtenConfig) {
    console.error('No lodestar.config.ts found in', rootDir);
    process.exitCode = 1;
    return;
  }

  const config = resolveConfig(writtenConfig, rootDir);
  const reporter = createConsoleReporter();

  const summary = await run({ config, reporter });

  if (summary.errorCount > 0) {
    process.exitCode = 1;
  }
}

export { checkCommand };
export type { CheckOptions };
