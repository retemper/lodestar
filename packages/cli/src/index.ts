import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { checkCommand } from './commands/check.js';
import { initCommand } from './commands/init.js';

/** Create the lodestar CLI instance */
function createCli() {
  return yargs(hideBin(process.argv))
    .scriptName('lodestar')
    .usage('$0 <command> [options]')
    .command(
      'check',
      'Run architecture rule checks',
      (y) =>
        y.option('format', {
          type: 'string',
          default: 'console',
          choices: ['console', 'json'],
          describe: 'Output format',
        }),
      checkCommand,
    )
    .command(
      'init',
      'Initialize lodestar.config.ts',
      (y) =>
        y.option('preset', {
          type: 'string',
          describe: 'Preset to use (app, lib, server)',
        }),
      initCommand,
    )
    .demandCommand(1, 'Please specify a command')
    .strict()
    .help();
}

export { createCli };
export { checkCommand } from './commands/check.js';
export { initCommand } from './commands/init.js';
export { createConsoleReporter } from './reporters/console.js';
export { createJsonReporter } from './reporters/json.js';
