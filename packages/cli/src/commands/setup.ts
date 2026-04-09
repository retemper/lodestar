import type { ArgumentsCamelCase } from 'yargs';
import { resolve } from 'node:path';
import type { WrittenConfigBlock } from '@retemper/lodestar';
import { loadConfigFile, createLogger } from '@retemper/lodestar';

/** Run verifySetup and apply fixes for all adapters */
async function setupCommand(_args: ArgumentsCamelCase<Record<string, unknown>>): Promise<void> {
  const logger = createLogger();
  const rootDir = resolve(process.cwd());

  const config = await loadConfigFile(rootDir);
  if (!config) {
    logger.error(`No lodestar.config.ts found in ${rootDir}`);
    process.exitCode = 1;
    return;
  }

  const blocks: readonly WrittenConfigBlock[] = Array.isArray(config) ? config : [config];
  const adapters = blocks.flatMap((b) => b.adapters ?? []);
  const setupAdapters = adapters.filter((a) => a.verifySetup);

  if (setupAdapters.length === 0) {
    logger.info('No adapters with verifySetup() found.');
    return;
  }

  for (const adapter of setupAdapters) {
    logger.info(`Verifying ${adapter.name} setup...`);
    const violations = await adapter.verifySetup!(rootDir);

    if (violations.length === 0) {
      logger.info(`  ${adapter.name} ✓`);
      continue;
    }

    for (const violation of violations) {
      if (violation.fix) {
        logger.info(`  Fixing: ${violation.message}`);
        await violation.fix.apply();
      } else {
        logger.warn(`  ${violation.message}`);
      }
    }
    logger.info(`  ${adapter.name} done`);
  }
}

export { setupCommand };
