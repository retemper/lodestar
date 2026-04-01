import { describe, it, expect, vi } from 'vitest';
import type { RuleContext, RuleProviders, Violation, ImportInfo } from '@lodestar/types';
import { noDeepImport } from './no-deep-import.js';

/** Create mock providers for testing deep import detection */
function createMockProviders(
  overrides: {
    glob?: ReturnType<typeof vi.fn>;
    getImports?: ReturnType<typeof vi.fn>;
  } = {},
): RuleProviders {
  return {
    fs: {
      glob: overrides.glob ?? vi.fn().mockResolvedValue([]),
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
      getImports: overrides.getImports ?? vi.fn().mockResolvedValue([]),
      getExports: vi.fn().mockResolvedValue([]),
    },
    config: {
      getPackageJson: vi.fn().mockResolvedValue({}),
      getTsConfig: vi.fn().mockResolvedValue({}),
      getCustomConfig: vi.fn().mockResolvedValue({}),
    },
  };
}

/** Run the no-deep-import rule and return violations */
async function checkDeepImport(
  modules: readonly string[],
  files: readonly string[],
  imports: readonly ImportInfo[],
): Promise<readonly Violation[]> {
  const violations: Violation[] = [];
  const providers = createMockProviders({
    glob: vi.fn().mockResolvedValue(files),
    getImports: vi.fn().mockResolvedValue(imports),
  });
  const ctx: RuleContext = {
    rootDir: '/test',
    options: { modules },
    providers,
    report(partial) {
      violations.push({
        ruleId: 'boundary/no-deep-import',
        message: partial.message,
        location: partial.location,
        severity: 'error',
        fix: partial.fix,
      });
    },
  };
  await noDeepImport.check(ctx);
  return violations;
}

/** Create an import info stub */
function makeImport(source: string, file: string): ImportInfo {
  return { source, specifiers: [], isTypeOnly: false, location: { file, line: 1 } };
}

describe('boundary/no-deep-import', () => {
  it('reports a violation for a relative path referencing module internals', async () => {
    const violations = await checkDeepImport(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('./web/service/internal', 'src/app.ts')],
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('web/service');
  });

  it('does not report a barrel (index) import', async () => {
    const violations = await checkDeepImport(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('./web/service/index', 'src/app.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('does not report an npm package import', async () => {
    const violations = await checkDeepImport(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('react', 'src/app.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('does not report a scoped npm package import', async () => {
    const violations = await checkDeepImport(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('@tanstack/react-query', 'src/app.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('does not report an unrelated relative path', async () => {
    const violations = await checkDeepImport(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('./utils/helper', 'src/app.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('reports a violation for an absolute path referencing module internals', async () => {
    const violations = await checkDeepImport(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('/web/service/internal', 'src/app.ts')],
    );
    expect(violations).toHaveLength(1);
  });

  it('normalizes Windows backslash paths before checking', async () => {
    const violations = await checkDeepImport(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('.\\web\\service\\internal', 'src/app.ts')],
    );
    expect(violations).toHaveLength(1);
  });

  it('does not report an empty source string', async () => {
    const violations = await checkDeepImport(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('', 'src/app.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('reports no violations when there are no deep imports', async () => {
    const violations = await checkDeepImport(
      ['web/service'],
      ['web/service/index.ts'],
      [makeImport('react', 'web/service/index.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('reports no violations when the module list is empty', async () => {
    const violations = await checkDeepImport([], [], []);
    expect(violations).toHaveLength(0);
  });

  it('reports a violation with barrel hint in the message', async () => {
    const violations = await checkDeepImport(
      ['web/service'],
      ['web/service/consumer.ts'],
      [makeImport('./web/service/internal', 'web/service/consumer.ts')],
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('barrel');
  });

  it('has correct rule metadata', () => {
    expect(noDeepImport.name).toBe('boundary/no-deep-import');
    expect(noDeepImport.needs).toStrictEqual(['ast']);
  });
});
