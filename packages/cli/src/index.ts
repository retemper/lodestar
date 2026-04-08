import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { checkCommand } from './commands/check';
import { initCommand } from './commands/init';
import { impactCommand } from './commands/impact';
import { graphCommand } from './commands/graph';
import { setupCommand } from './commands/setup';
import { watchCommand } from './commands/watch';

/** Create the lodestar CLI instance */
function createCli() {
  return yargs(hideBin(process.argv))
    .scriptName('lodestar')
    .usage('$0 <command> [options]')
    .command(
      'check',
      'Run architecture rule checks',
      (y) =>
        y
          .option('format', {
            type: 'string',
            default: 'console',
            choices: ['console', 'json', 'sarif', 'junit'],
            describe: 'Output format',
          })
          .option('workspace', {
            type: 'boolean',
            describe: 'Run in workspace mode (auto-detected by default)',
          })
          .option('rule', {
            type: 'array',
            string: true,
            describe: 'Only run specific rules (e.g., --rule naming-convention/file-naming)',
          })
          .option('fix', {
            type: 'boolean',
            default: false,
            describe: 'Auto-fix violations where possible',
          })
          .option('cache', {
            type: 'boolean',
            default: true,
            describe: 'Use disk cache for faster repeated runs (--no-cache to disable)',
          })
          .option('clear-cache', {
            type: 'boolean',
            default: false,
            describe: 'Clear the disk cache before running',
          })
          .option('changed', {
            type: 'string',
            describe: 'Only check files changed since a base ref (default: git status)',
          })
          .option('concurrency', {
            type: 'number',
            describe: 'Max packages to run in parallel in workspace mode (default: 4)',
          }),
      checkCommand,
    )
    .command('init', 'Initialize lodestar.config.ts', () => {}, initCommand)
    .command(
      'impact <file>',
      'Show files affected by changing a file',
      (y) =>
        y
          .positional('file', {
            type: 'string',
            demandOption: true,
            describe: 'Target file to analyze (relative to project root)',
          })
          .option('json', {
            type: 'boolean',
            default: false,
            describe: 'Output as JSON',
          })
          .option('depth', {
            type: 'number',
            describe: 'Limit traversal depth (default: unlimited)',
          }),
      impactCommand,
    )
    .command(
      'graph',
      'Output dependency graph',
      (y) =>
        y
          .option('scope', {
            type: 'string',
            describe: 'Only show files matching this path prefix (e.g. src/domain)',
          })
          .option('format', {
            type: 'string',
            default: 'mermaid',
            choices: ['mermaid', 'dot'] as const,
            describe: 'Output format',
          })
          .option('layers', {
            type: 'boolean',
            default: false,
            describe: 'Show layer-level architecture graph (requires architecture/layers rule)',
          })
          .option('serve', {
            type: 'boolean',
            default: false,
            describe: 'Start interactive graph viewer in the browser',
          })
          .option('port', {
            type: 'number',
            default: 4040,
            describe: 'Port for the interactive graph server',
          }),
      graphCommand,
    )
    .command('setup', 'Run adapter setup (e.g., husky git hooks)', () => {}, setupCommand)
    .command(
      'watch',
      'Watch for file changes and re-run affected rules',
      (y) =>
        y
          .option('format', {
            type: 'string',
            default: 'console',
            choices: ['console', 'json'],
            describe: 'Output format',
          })
          .option('rule', {
            type: 'array',
            string: true,
            describe: 'Only run specific rules',
          })
          .option('fix', {
            type: 'boolean',
            default: false,
            describe: 'Auto-fix violations where possible',
          })
          .option('cache', {
            type: 'boolean',
            default: true,
            describe: 'Use disk cache (--no-cache to disable)',
          })
          .option('debounce', {
            type: 'number',
            default: 300,
            describe: 'Debounce interval in milliseconds',
          }),
      watchCommand,
    )
    .demandCommand(1, 'Please specify a command')
    .strict()
    .help();
}

export { createCli };
export { checkCommand } from './commands/check';
export { initCommand } from './commands/init';
export { impactCommand } from './commands/impact';
export { graphCommand } from './commands/graph';
export { setupCommand } from './commands/setup';
export { watchCommand } from './commands/watch';
export { createConsoleReporter } from './reporters/console';
export { createJsonReporter } from './reporters/json';
