import type { ArgumentsCamelCase } from 'yargs';
import { writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

/** Initialize a new lodestar.config.ts in the current directory, then run adapter setup */
async function initCommand(_args: ArgumentsCamelCase<Record<string, unknown>>): Promise<void> {
  const rootDir = resolve(process.cwd());
  const configPath = join(rootDir, 'lodestar.config.ts');

  const content = generateConfigTemplate();
  await writeFile(configPath, content, 'utf-8');
  console.error(`Created ${configPath}`);
}

/** Generate a starter config template */
function generateConfigTemplate(): string {
  return `import { defineConfig } from 'lodestar';
import { pluginArchitecture } from '@lodestar/plugin-architecture';

export default defineConfig({
  plugins: [pluginArchitecture],
  rules: {
    'architecture/layers': {
      severity: 'error',
      options: {
        layers: [
          { name: 'domain', path: 'src/domain/**' },
          { name: 'application', path: 'src/application/**', canImport: ['domain'] },
          { name: 'infra', path: 'src/infra/**', canImport: ['domain', 'application'] },
        ],
      },
    },
  },
});
`;
}

export { initCommand, generateConfigTemplate };
