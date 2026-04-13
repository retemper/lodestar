import { describe, it, expect } from 'vitest';
import { generateConfigTemplate } from './init';

describe('generateConfigTemplate', () => {
  it('includes defineConfig import', () => {
    const result = generateConfigTemplate();

    expect(result).toContain("import { defineConfig } from '@retemper/lodestar'");
  });

  it('includes export default defineConfig', () => {
    const result = generateConfigTemplate();

    expect(result).toContain('export default defineConfig(');
  });

  it('includes architecture plugin', () => {
    const result = generateConfigTemplate();

    expect(result).toContain('@retemper/lodestar-plugin-architecture');
    expect(result).toContain('pluginArchitecture');
  });

  it('includes layers rule configuration', () => {
    const result = generateConfigTemplate();

    expect(result).toContain('architecture/layers');
    expect(result).toContain('canImport');
  });
});
