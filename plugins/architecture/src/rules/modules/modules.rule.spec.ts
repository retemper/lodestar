import { describe, it, expect, vi } from 'vitest';
import type { Violation, ImportInfo } from '@lodestar/types';
import { createMockProviders, createTestContext } from '@lodestar/test-utils';
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
  return { source, specifiers: [], isTypeOnly: false, location: { file, line: 1 } };
}

describe('architecture/modules', () => {
  it('모듈 내부 파일을 직접 import하면 위반을 보고한다', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('./web/service/internal', 'src/app.ts')],
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('web/service');
  });

  it('배럴(index) import는 위반으로 보고하지 않는다', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('./web/service/index', 'src/app.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('npm 패키지 import는 무시한다', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('react', 'src/app.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('스코프 npm 패키지 import는 무시한다', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('@tanstack/react-query', 'src/app.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('관련 없는 상대경로 import는 무시한다', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('./utils/helper', 'src/app.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('절대경로로 모듈 내부를 import하면 위반을 보고한다', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('/web/service/internal', 'src/app.ts')],
    );
    expect(violations).toHaveLength(1);
  });

  it('Windows 백슬래시 경로를 정규화하여 감지한다', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('.\\web\\service\\internal', 'src/app.ts')],
    );
    expect(violations).toHaveLength(1);
  });

  it('빈 소스 문자열은 무시한다', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['src/app.ts'],
      [makeImport('', 'src/app.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('deep import가 없으면 위반이 없다', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['web/service/index.ts'],
      [makeImport('react', 'web/service/index.ts')],
    );
    expect(violations).toHaveLength(0);
  });

  it('모듈 목록이 비어있으면 위반이 없다', async () => {
    const violations = await checkModules([], [], []);
    expect(violations).toHaveLength(0);
  });

  it('위반 메시지에 배럴 사용 안내를 포함한다', async () => {
    const violations = await checkModules(
      ['web/service'],
      ['web/service/consumer.ts'],
      [makeImport('./web/service/internal', 'web/service/consumer.ts')],
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('barrel');
  });

  it('allow 옵션에 포함된 deep import는 위반으로 보고하지 않는다', async () => {
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

  it('allow 목록이 비어있으면 deep import를 모두 위반으로 보고한다', async () => {
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

  it('exclude 패턴에 매칭되는 파일은 검사하지 않는다', async () => {
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

  it('include 패턴을 사용하여 검사 범위를 지정한다', async () => {
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

  it('올바른 규칙 메타데이터를 가진다', () => {
    expect(modules.name).toBe('architecture/modules');
    expect(modules.needs).toStrictEqual(['ast', 'fs']);
  });
});
