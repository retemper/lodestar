import { describe, it, expect, vi } from 'vitest';
import type { RuleContext, RuleProviders, Violation } from '@lodestar/types';
import { fileNaming } from './file-naming.js';

/** Create mock providers for testing naming convention */
function createMockProviders(files: readonly string[]): RuleProviders {
  return {
    fs: {
      glob: vi.fn().mockResolvedValue(files),
      readFile: vi.fn().mockResolvedValue(''),
      exists: vi.fn().mockResolvedValue(true),
      readJson: vi.fn().mockResolvedValue({}),
    },
    graph: {
      getDependencies: vi.fn().mockResolvedValue([]),
      getDependents: vi.fn().mockResolvedValue([]),
      hasCircular: vi.fn().mockResolvedValue(false),
      getModuleGraph: vi.fn().mockResolvedValue({ nodes: new Map() }),
    },
    ast: {
      getSourceFile: vi.fn().mockResolvedValue(null),
      getImports: vi.fn().mockResolvedValue([]),
      getExports: vi.fn().mockResolvedValue([]),
    },
    config: {
      getPackageJson: vi.fn().mockResolvedValue({}),
      getTsConfig: vi.fn().mockResolvedValue({}),
      getCustomConfig: vi.fn().mockResolvedValue({}),
    },
  };
}

/** Run the file-naming rule with a given convention and file list */
async function checkConvention(
  convention: string,
  files: readonly string[],
): Promise<readonly Violation[]> {
  const violations: Violation[] = [];
  const ctx: RuleContext = {
    rootDir: '/test-project',
    options: { convention, include: ['**/*.ts'] },
    providers: createMockProviders(files),
    report(partial) {
      violations.push({
        ruleId: 'structure/file-naming',
        message: partial.message,
        location: partial.location,
        severity: 'error',
        fix: partial.fix,
      });
    },
  };
  await fileNaming.check(ctx);
  return violations;
}

describe('structure/file-naming — kebab-case', () => {
  it('allows a single lowercase word', async () => {
    const violations = await checkConvention('kebab-case', ['src/utils.ts']);
    expect(violations).toHaveLength(0);
  });

  it('allows lowercase words joined by hyphens', async () => {
    const violations = await checkConvention('kebab-case', ['src/my-component.ts']);
    expect(violations).toHaveLength(0);
  });

  it('allows kebab-case with three or more words', async () => {
    const violations = await checkConvention('kebab-case', ['src/my-long-component-name.ts']);
    expect(violations).toHaveLength(0);
  });

  it('allows kebab-case containing numbers', async () => {
    const violations = await checkConvention('kebab-case', ['src/button-v2.ts']);
    expect(violations).toHaveLength(0);
  });

  it('rejects names starting with a number', async () => {
    const violations = await checkConvention('kebab-case', ['src/2button.ts']);
    expect(violations).toHaveLength(1);
  });

  it('rejects names containing uppercase letters', async () => {
    const violations = await checkConvention('kebab-case', ['src/MyComponent.ts']);
    expect(violations).toHaveLength(1);
  });

  it('rejects names containing underscores', async () => {
    const violations = await checkConvention('kebab-case', ['src/my_component.ts']);
    expect(violations).toHaveLength(1);
  });

  it('rejects consecutive hyphens', async () => {
    const violations = await checkConvention('kebab-case', ['src/my--component.ts']);
    expect(violations).toHaveLength(1);
  });

  it('rejects names starting with a hyphen', async () => {
    const violations = await checkConvention('kebab-case', ['src/-component.ts']);
    expect(violations).toHaveLength(1);
  });

  it('rejects names ending with a hyphen', async () => {
    const violations = await checkConvention('kebab-case', ['src/component-.ts']);
    expect(violations).toHaveLength(1);
  });

  it('allows a single lowercase letter', async () => {
    const violations = await checkConvention('kebab-case', ['src/a.ts']);
    expect(violations).toHaveLength(0);
  });
});

describe('structure/file-naming — camelCase', () => {
  it('allows a single word starting with lowercase', async () => {
    const violations = await checkConvention('camelCase', ['src/utils.ts']);
    expect(violations).toHaveLength(0);
  });

  it('allows camelCase compound words', async () => {
    const violations = await checkConvention('camelCase', ['src/myComponent.ts']);
    expect(violations).toHaveLength(0);
  });

  it('allows camelCase with three or more words', async () => {
    const violations = await checkConvention('camelCase', ['src/myLongComponentName.ts']);
    expect(violations).toHaveLength(0);
  });

  it('allows camelCase containing numbers', async () => {
    const violations = await checkConvention('camelCase', ['src/buttonV2.ts']);
    expect(violations).toHaveLength(0);
  });

  it('rejects names starting with an uppercase letter', async () => {
    const violations = await checkConvention('camelCase', ['src/MyComponent.ts']);
    expect(violations).toHaveLength(1);
  });

  it('rejects names containing hyphens', async () => {
    const violations = await checkConvention('camelCase', ['src/my-component.ts']);
    expect(violations).toHaveLength(1);
  });

  it('rejects names containing underscores', async () => {
    const violations = await checkConvention('camelCase', ['src/my_component.ts']);
    expect(violations).toHaveLength(1);
  });

  it('allows a single lowercase letter', async () => {
    const violations = await checkConvention('camelCase', ['src/a.ts']);
    expect(violations).toHaveLength(0);
  });
});

describe('structure/file-naming — PascalCase', () => {
  it('allows a single word starting with uppercase', async () => {
    const violations = await checkConvention('PascalCase', ['src/Utils.ts']);
    expect(violations).toHaveLength(0);
  });

  it('allows PascalCase compound words', async () => {
    const violations = await checkConvention('PascalCase', ['src/MyComponent.ts']);
    expect(violations).toHaveLength(0);
  });

  it('allows PascalCase containing numbers', async () => {
    const violations = await checkConvention('PascalCase', ['src/ButtonV2.ts']);
    expect(violations).toHaveLength(0);
  });

  it('rejects names starting with a lowercase letter', async () => {
    const violations = await checkConvention('PascalCase', ['src/myComponent.ts']);
    expect(violations).toHaveLength(1);
  });

  it('rejects names containing hyphens', async () => {
    const violations = await checkConvention('PascalCase', ['src/My-Component.ts']);
    expect(violations).toHaveLength(1);
  });

  it('allows a single uppercase letter', async () => {
    const violations = await checkConvention('PascalCase', ['src/A.ts']);
    expect(violations).toHaveLength(0);
  });
});

describe('structure/file-naming — snake_case', () => {
  it('allows a single word starting with lowercase', async () => {
    const violations = await checkConvention('snake_case', ['src/utils.ts']);
    expect(violations).toHaveLength(0);
  });

  it('allows lowercase words joined by underscores', async () => {
    const violations = await checkConvention('snake_case', ['src/my_component.ts']);
    expect(violations).toHaveLength(0);
  });

  it('allows snake_case with three or more words', async () => {
    const violations = await checkConvention('snake_case', ['src/my_long_component_name.ts']);
    expect(violations).toHaveLength(0);
  });

  it('allows snake_case containing numbers', async () => {
    const violations = await checkConvention('snake_case', ['src/button_v2.ts']);
    expect(violations).toHaveLength(0);
  });

  it('rejects names containing uppercase letters', async () => {
    const violations = await checkConvention('snake_case', ['src/My_component.ts']);
    expect(violations).toHaveLength(1);
  });

  it('rejects consecutive underscores', async () => {
    const violations = await checkConvention('snake_case', ['src/my__component.ts']);
    expect(violations).toHaveLength(1);
  });

  it('rejects names starting with an underscore', async () => {
    const violations = await checkConvention('snake_case', ['src/_component.ts']);
    expect(violations).toHaveLength(1);
  });

  it('rejects names ending with an underscore', async () => {
    const violations = await checkConvention('snake_case', ['src/component_.ts']);
    expect(violations).toHaveLength(1);
  });

  it('allows a single lowercase letter', async () => {
    const violations = await checkConvention('snake_case', ['src/a.ts']);
    expect(violations).toHaveLength(0);
  });
});
