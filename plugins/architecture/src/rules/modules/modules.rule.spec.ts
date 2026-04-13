import { describe, it, expect, vi } from 'vitest';
import type { Violation, ImportInfo } from '@retemper/lodestar-types';
import { createMockProviders, createTestContext } from '@retemper/lodestar-test-utils';
import { modules } from './modules.rule';

/** Runs the module boundary rule and returns the list of violations */
async function checkModules(
  modulePaths: readonly string[],
  files: readonly string[],
  imports: readonly ImportInfo[],
): Promise<readonly Violation[]> {
  const providers = createMockProviders({
    glob: vi.fn().mockResolvedValue(files),
    getImports: vi.fn().mockResolvedValue(imports),
  });
  const { ctx, violations } = createTestContext(
    { modules: modulePaths },
    providers,
    'architecture/modules',
  );
  await modules.check(ctx as never);
  return violations;
}

/** Creates an ImportInfo stub */
function makeImport(source: string, file: string): ImportInfo {
  return { source, specifiers: [], isTypeOnly: false, kind: 'static', location: { file, line: 1 } };
}

describe('architecture/modules', () => {
  it('reports violation when directly importing files inside a module', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('./web/service/internal', 'src/app.ts')],
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('web/service');
  });

  it('does not report barrel (index) imports as violations', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('./web/service/index', 'src/app.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('ignores npm package imports', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('react', 'src/app.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('ignores scoped npm package imports', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('@tanstack/react-query', 'src/app.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('ignores unrelated relative path imports', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('./utils/helper', 'src/app.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('reports violation when importing module internals via absolute path', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('/web/service/internal', 'src/app.ts')],
    );
    expect(violations).toHaveLength(1);
  });

  it('normalizes and detects Windows backslash paths', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('.\\web\\service\\internal', 'src/app.ts')],
    );
    expect(violations).toHaveLength(1);
  });

  it('ignores empty source strings', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('', 'src/app.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('no violation when there are no deep imports', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['web/service/index.ts'],
      [makeImport('react', 'web/service/index.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('no violation when module list is empty', async () => {
    const violations = await checkModules([], [], []);
    expect(violations).toHaveLength(0);
  });

  it('includes barrel usage guidance in violation message', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['web/service/consumer.ts'],
      [makeImport('./web/service/internal', 'web/service/consumer.ts')],
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('barrel');
  });

  it('does not report deep imports included in allow option as violations', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/app.ts']),
      getImports: vi
        .fn()
        .mockResolvedValue([
          makeImport('./web/service/testing', 'src/app.ts'),
          makeImport('./web/service/internal', 'src/app.ts'),
        ]),
    });
    const { ctx, violations } = createTestContext(
      { modules: ['web/service'], allow: ['testing'] },
      providers,
      'architecture/modules',
    );

    await modules.check(ctx as never);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('web/service');
    expect(violations[0].message).not.toContain('testing');
  });

  it('reports all deep imports as violations when allow list is empty', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/app.ts']),
      getImports: vi.fn().mockResolvedValue([makeImport('./web/service/internal', 'src/app.ts')]),
    });
    const { ctx, violations } = createTestContext(
      { modules: ['web/service'], allow: [] },
      providers,
      'architecture/modules',
    );

    await modules.check(ctx as never);

    expect(violations).toHaveLength(1);
  });

  it('does not check files matching exclude patterns', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/app.ts', 'src/app.spec.ts']),
      getImports: vi.fn().mockResolvedValue([makeImport('./web/service/internal', 'src/app.ts')]),
    });
    const { ctx, violations } = createTestContext(
      { modules: ['web/service'], exclude: ['*.spec.'] },
      providers,
      'architecture/modules',
    );

    await modules.check(ctx as never);

    expect(violations).toHaveLength(1);
  });

  it('uses include patterns to specify the inspection scope', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['custom/path/app.ts']),
      getImports: vi
        .fn()
        .mockResolvedValue([makeImport('./web/service/internal', 'custom/path/app.ts')]),
    });
    const { ctx, violations } = createTestContext(
      { modules: ['web/service'], include: ['custom/**/*.ts'] },
      providers,
      'architecture/modules',
    );

    await modules.check(ctx as never);

    expect(violations).toHaveLength(1);
  });

  it('has correct rule metadata', () => {
    expect(modules.name).toBe('architecture/modules');
    expect(modules.needs).toStrictEqual(['ast', 'fs']);
  });
});
