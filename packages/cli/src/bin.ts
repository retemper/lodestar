/** CLI entry point -- bootstraps the yargs instance and parses process.argv */
import { createCli } from './index';

const cli = createCli();
cli.parse();
