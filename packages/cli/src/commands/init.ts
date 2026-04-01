import type { ArgumentsCamelCase } from 'yargs';
import { writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

/** Options for the init command */
interface InitOptions {
  readonly preset?: string;
}

/** Initialize a new lodestar.config.ts in the current directory */
async function initCommand(args: ArgumentsCamelCase<InitOptions>): Promise<void> {
  const rootDir = resolve(process.cwd());
  const configPath = join(rootDir, 'lodestar.config.ts');
  const preset = args.preset ?? 'app';

  const content = generateConfigTemplate(preset);
  await writeFile(configPath, content, 'utf-8');

  console.error(`Created ${configPath} with preset: ${preset}`);
}

/** Generate a config template based on preset type */
function generateConfigTemplate(preset: string): string {
  return `import { defineConfig } from 'lodestar';

export default defineConfig({
  extends: ['@lodestar/preset-${preset}'],
});
`;
}

export { initCommand, generateConfigTemplate };
export type { InitOptions };
