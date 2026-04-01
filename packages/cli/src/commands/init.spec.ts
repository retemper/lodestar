import { describe, it, expect } from 'vitest';
import { generateConfigTemplate } from './init.js';

describe('generateConfigTemplate', () => {
  it('generates a config template with the app preset', () => {
    const result = generateConfigTemplate('app');

    expect(result).toBe(`import { defineConfig } from 'lodestar';

export default defineConfig({
  extends: ['@lodestar/preset-app'],
});
`);
  });

  it('generates a config template with the lib preset', () => {
    const result = generateConfigTemplate('lib');

    expect(result).toContain('@lodestar/preset-lib');
  });

  it('generates a config template with the server preset', () => {
    const result = generateConfigTemplate('server');

    expect(result).toContain('@lodestar/preset-server');
  });

  it('uses a custom preset name as-is', () => {
    const result = generateConfigTemplate('my-custom');

    expect(result).toContain('@lodestar/preset-my-custom');
  });

  it('generated template is valid TypeScript syntax', () => {
    const result = generateConfigTemplate('app');

    expect(result).toContain("import { defineConfig } from 'lodestar'");
    expect(result).toContain('export default defineConfig(');
    expect(result).toContain('extends:');
  });

  it('handles an empty string preset', () => {
    const result = generateConfigTemplate('');

    expect(result).toContain('@lodestar/preset-');
  });
});
