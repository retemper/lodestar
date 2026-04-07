import { describe, it, expect } from 'vitest';
import { generateConfigTemplate } from './init';

describe('generateConfigTemplate', () => {
  it('defineConfig import를 포함한다', () => {
    const result = generateConfigTemplate();

    expect(result).toContain("import { defineConfig } from '@retemper/lodestar'");
  });

  it('export default defineConfig을 포함한다', () => {
    const result = generateConfigTemplate();

    expect(result).toContain('export default defineConfig(');
  });

  it('architecture 플러그인을 포함한다', () => {
    const result = generateConfigTemplate();

    expect(result).toContain('@retemper/lodestar-plugin-architecture');
    expect(result).toContain('pluginArchitecture');
  });

  it('layers 규칙 설정을 포함한다', () => {
    const result = generateConfigTemplate();

    expect(result).toContain('architecture/layers');
    expect(result).toContain('canImport');
  });
});
