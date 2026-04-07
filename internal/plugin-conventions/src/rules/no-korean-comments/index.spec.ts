import { describe, it, expect, vi } from 'vitest';
import { createMockProviders, createTestContext } from '@retemper/lodestar-test-utils';
import { noKoreanComments, findKoreanComments, containsKorean } from './index';

describe('containsKorean', () => {
  it('한글이 포함되면 true를 반환한다', () => {
    expect(containsKorean('// 한글 주석')).toBe(true);
    expect(containsKorean('ㄱㄴㄷ')).toBe(true);
    expect(containsKorean('ㅏㅓㅗ')).toBe(true);
  });

  it('한글이 없으면 false를 반환한다', () => {
    expect(containsKorean('// english comment')).toBe(false);
    expect(containsKorean('const x = 1;')).toBe(false);
    expect(containsKorean('日本語')).toBe(false);
  });
});

describe('findKoreanComments', () => {
  it('한 줄 주석에서 한국어를 찾는다', () => {
    const source = `const x = 1; // 변수 선언\nconst y = 2; // variable`;
    const results = findKoreanComments(source);

    expect(results).toHaveLength(1);
    expect(results[0].line).toBe(1);
    expect(results[0].text).toContain('변수 선언');
  });

  it('블록 주석에서 한국어를 찾는다', () => {
    const source = `/* 이것은 블록 주석입니다 */\nconst x = 1;`;
    const results = findKoreanComments(source);

    expect(results).toHaveLength(1);
    expect(results[0].line).toBe(1);
  });

  it('한국어가 없는 주석은 무시한다', () => {
    const source = `// english comment\n/* block comment */\nconst x = 1;`;
    const results = findKoreanComments(source);

    expect(results).toHaveLength(0);
  });

  it('문자열 안의 한국어는 감지하지 않는다', () => {
    const source = `const msg = '한국어 메시지';\nconst x = 1;`;
    const results = findKoreanComments(source);

    expect(results).toHaveLength(0);
  });

  it('여러 한국어 주석을 모두 찾는다', () => {
    const source = [
      'const a = 1; // 첫 번째',
      'const b = 2; // second',
      'const c = 3; // 세 번째',
    ].join('\n');
    const results = findKoreanComments(source);

    expect(results).toHaveLength(2);
  });
});

describe('conventions/no-korean-comments', () => {
  it('한국어 주석이 있는 파일에서 violation을 보고한다', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/index.ts']),
      readFile: vi.fn().mockResolvedValue('const x = 1; // 변수 선언\n'),
    });
    const { ctx, violations } = createTestContext({}, providers, 'conventions/no-korean-comments');

    await noKoreanComments.check(ctx);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('Korean comment');
    expect(violations[0].location?.file).toBe('src/index.ts');
    expect(violations[0].location?.line).toBe(1);
  });

  it('한국어 주석이 없으면 violation이 없다', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/index.ts']),
      readFile: vi.fn().mockResolvedValue('const x = 1; // variable\n'),
    });
    const { ctx, violations } = createTestContext({}, providers, 'conventions/no-korean-comments');

    await noKoreanComments.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('커스텀 include 패턴을 사용한다', async () => {
    const globFn = vi.fn().mockResolvedValue(['lib/util.ts']);
    const providers = createMockProviders({
      glob: globFn,
      readFile: vi.fn().mockResolvedValue('// clean\n'),
    });
    const { ctx, violations } = createTestContext(
      { include: ['lib/**/*.ts'] },
      providers,
      'conventions/no-korean-comments',
    );

    await noKoreanComments.check(ctx);

    expect(globFn).toHaveBeenCalledWith('lib/**/*.ts');
    expect(violations).toHaveLength(0);
  });

  it('파일이 없으면 violation이 없다', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue([]),
    });
    const { ctx, violations } = createTestContext({}, providers, 'conventions/no-korean-comments');

    await noKoreanComments.check(ctx);

    expect(violations).toHaveLength(0);
  });
});
