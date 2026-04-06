import type { ArgumentsCamelCase } from 'yargs';
import { resolve } from 'node:path';
import type { WrittenConfigBlock } from 'lodestar';
import { loadConfigFile } from 'lodestar';

/** Run verifySetup and apply fixes for all adapters */
async function setupCommand(_args: ArgumentsCamelCase<Record<string, unknown>>): Promise<void> {
  const rootDir = resolve(process.cwd());

  const config = await loadConfigFile(rootDir);
  if (!config) {
    console.error('No lodestar.config.ts found in', rootDir);
    process.exitCode = 1;
    return;
  }

  const blocks: readonly WrittenConfigBlock[] = Array.isArray(config) ? config : [config];
  const adapters = blocks.flatMap((b) => b.adapters ?? []);
  const setupAdapters = adapters.filter((a) => a.verifySetup);

  if (setupAdapters.length === 0) {
    console.error('No adapters with verifySetup() found.');
    return;
  }

  for (const adapter of setupAdapters) {
    console.error(`Verifying ${adapter.name} setup...`);
    const violations = await adapter.verifySetup!(rootDir);

    if (violations.length === 0) {
      console.error(`  ${adapter.name} ✓`);
      continue;
    }

    for (const violation of violations) {
      if (violation.fix) {
        console.error(`  Fixing: ${violation.message}`);
        await violation.fix.apply();
      } else {
        console.error(`  ${violation.message}`);
      }
    }
    console.error(`  ${adapter.name} done`);
  }
}

export { setupCommand };
