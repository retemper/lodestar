import { describe, it, expect, vi } from 'vitest';
import type { RuleContext, RuleProviders, Violation } from '@lodestar/types';
import { directoryExists } from './directory-exists.js';
import { noForbiddenPath } from './no-forbidden-path.js';
import { fileNaming } from './file-naming.js';

/** Create mock providers for testing */
function createMockProviders(overrides: Partial<RuleProviders['fs']> = {}): RuleProviders {
  return {
    fs: {
      glob: vi.fn().mockResolvedValue([]),
      readFile: vi.fn().mockResolvedValue(''),
      exists: vi.fn().mockResolvedValue(true),
      readJson: vi.fn().mockResolvedValue({}),
      ...overrides,
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

/** Create a test RuleContext and collect violations into a returned array */
function createTestContext(
  options: Record<string, unknown>,
  providers: RuleProviders,
): { ctx: RuleContext; violations: Violation[] } {
  const violations: Violation[] = [];
  const ctx: RuleContext = {
    rootDir: '/test-project',
    options,
    providers,
    report(partial) {
      violations.push({
        ruleId: 'test',
        message: partial.message,
        location: partial.location,
        severity: 'error',
        fix: partial.fix,
      });
    },
  };
  return { ctx, violations };
}

describe('structure/directory-exists', () => {
  it('reports no violations when all required directories exist', async () => {
    const providers = createMockProviders({
      exists: vi.fn().mockResolvedValue(true),
    });
    const { ctx, violations } = createTestContext({ required: ['src', 'tests'] }, providers);

    await directoryExists.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('reports one violation when a required directory is missing', async () => {
    const exists = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const providers = createMockProviders({ exists });
    const { ctx, violations } = createTestContext({ required: ['src', 'tests'] }, providers);

    await directoryExists.check(ctx);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toBe('Required directory "tests" does not exist');
  });

  it('reports a violation for each missing required directory', async () => {
    const providers = createMockProviders({
      exists: vi.fn().mockResolvedValue(false),
    });
    const { ctx, violations } = createTestContext(
      { required: ['src', 'tests', 'docs'] },
      providers,
    );

    await directoryExists.check(ctx);

    expect(violations).toHaveLength(3);
  });

  it('reports no violations when the required list is empty', async () => {
    const providers = createMockProviders();
    const { ctx, violations } = createTestContext({ required: [] }, providers);

    await directoryExists.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('has correct rule metadata', () => {
    expect(directoryExists.name).toBe('structure/directory-exists');
    expect(directoryExists.needs).toStrictEqual(['fs']);
  });
});

describe('structure/no-forbidden-path', () => {
  it('reports no violations when no forbidden paths are found', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue([]),
    });
    const { ctx, violations } = createTestContext({ patterns: ['**/*.test.tsx'] }, providers);

    await noForbiddenPath.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('reports a violation for each forbidden path found', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/bad.test.tsx', 'src/other.test.tsx']),
    });
    const { ctx, violations } = createTestContext({ patterns: ['**/*.test.tsx'] }, providers);

    await noForbiddenPath.check(ctx);

    expect(violations).toHaveLength(2);
    expect(violations[0].message).toContain('src/bad.test.tsx');
    expect(violations[0].location?.file).toBe('src/bad.test.tsx');
  });

  it('checks multiple patterns independently', async () => {
    const glob = vi.fn().mockResolvedValueOnce(['a.tsx']).mockResolvedValueOnce(['b.jsx']);
    const providers = createMockProviders({ glob });
    const { ctx, violations } = createTestContext(
      { patterns: ['**/*.tsx', '**/*.jsx'] },
      providers,
    );

    await noForbiddenPath.check(ctx);

    expect(violations).toHaveLength(2);
    expect(glob).toHaveBeenCalledTimes(2);
  });

  it('reports no violations when the pattern list is empty', async () => {
    const providers = createMockProviders();
    const { ctx, violations } = createTestContext({ patterns: [] }, providers);

    await noForbiddenPath.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('includes the matched pattern in the violation message', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/secret.env']),
    });
    const { ctx, violations } = createTestContext({ patterns: ['**/*.env'] }, providers);

    await noForbiddenPath.check(ctx);

    expect(violations[0].message).toContain('**/*.env');
  });

  it('has correct rule metadata', () => {
    expect(noForbiddenPath.name).toBe('structure/no-forbidden-path');
    expect(noForbiddenPath.needs).toStrictEqual(['fs']);
  });
});

describe('structure/file-naming', () => {
  it('reports no violations when all files match the convention', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/my-component.ts', 'src/utils.ts']),
    });
    const { ctx, violations } = createTestContext(
      { convention: 'kebab-case', include: ['src/**/*.ts'] },
      providers,
    );

    await fileNaming.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('reports a violation when a file does not match the convention', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/MyComponent.ts', 'src/utils.ts']),
    });
    const { ctx, violations } = createTestContext(
      { convention: 'kebab-case', include: ['src/**/*.ts'] },
      providers,
    );

    await fileNaming.check(ctx);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('MyComponent');
    expect(violations[0].message).toContain('kebab-case');
  });

  it('strips the extension and validates only the basename', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/my-file.spec.ts']),
    });
    const { ctx, violations } = createTestContext(
      { convention: 'kebab-case', include: ['src/**/*.ts'] },
      providers,
    );

    await fileNaming.check(ctx);

    // The implementation only strips the last extension, resulting in 'my-file.spec'
    // which contains a dot and therefore does not match kebab-case, producing 1 violation
    expect(violations).toHaveLength(1);
  });

  it('checks multiple include patterns independently', async () => {
    const glob = vi
      .fn()
      .mockResolvedValueOnce(['src/MyBad.ts'])
      .mockResolvedValueOnce(['lib/AnotherBad.ts']);
    const providers = createMockProviders({ glob });
    const { ctx, violations } = createTestContext(
      { convention: 'kebab-case', include: ['src/**/*.ts', 'lib/**/*.ts'] },
      providers,
    );

    await fileNaming.check(ctx);

    expect(violations).toHaveLength(2);
    expect(glob).toHaveBeenCalledTimes(2);
  });

  it('reports no violations when include is empty', async () => {
    const providers = createMockProviders();
    const { ctx, violations } = createTestContext(
      { convention: 'kebab-case', include: [] },
      providers,
    );

    await fileNaming.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('can validate with PascalCase convention', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/MyComponent.tsx', 'src/button.tsx']),
    });
    const { ctx, violations } = createTestContext(
      { convention: 'PascalCase', include: ['src/**/*.tsx'] },
      providers,
    );

    await fileNaming.check(ctx);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('button');
  });

  it('has correct rule metadata', () => {
    expect(fileNaming.name).toBe('structure/file-naming');
    expect(fileNaming.needs).toStrictEqual(['fs']);
  });
});
