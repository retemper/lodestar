import { describe, it, expect, vi } from 'vitest';
import {
  compileMappings,
  matchPattern,
  stripJsonComments,
  createTsconfigPathsResolver,
} from './tsconfig-paths';
import type { PathMapping } from './tsconfig-paths';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('stripJsonComments', () => {
  it('단일행 주석을 제거한다', () => {
    const input = '{\n  "a": 1 // comment\n}';
    expect(JSON.parse(stripJsonComments(input))).toStrictEqual({ a: 1 });
  });

  it('다중행 주석을 제거한다', () => {
    const input = '{\n  /* multi\n  line */\n  "a": 1\n}';
    expect(JSON.parse(stripJsonComments(input))).toStrictEqual({ a: 1 });
  });

  it('주석이 없으면 원본을 반환한다', () => {
    const input = '{"a": 1}';
    expect(stripJsonComments(input)).toBe(input);
  });
});

describe('compileMappings', () => {
  it('와일드카드 패턴을 파싱한다', () => {
    const mappings = compileMappings({ '@app/*': ['src/*'] });

    expect(mappings).toHaveLength(1);
    expect(mappings[0].prefix).toBe('@app/');
    expect(mappings[0].suffix).toBe('');
    expect(mappings[0].hasWildcard).toBe(true);
    expect(mappings[0].targets[0].prefix).toBe('src/');
  });

  it('정확 매칭 패턴을 파싱한다', () => {
    const mappings = compileMappings({ 'exact-match': ['src/exact.ts'] });

    expect(mappings[0].hasWildcard).toBe(false);
    expect(mappings[0].prefix).toBe('exact-match');
  });

  it('여러 타겟을 파싱한다', () => {
    const mappings = compileMappings({ '@lib/*': ['lib/*', 'vendor/*'] });

    expect(mappings[0].targets).toHaveLength(2);
    expect(mappings[0].targets[1].prefix).toBe('vendor/');
  });
});

describe('matchPattern', () => {
  it('와일드카드 패턴을 매칭하고 캡처한다', () => {
    const mapping: PathMapping = {
      prefix: '@app/',
      suffix: '',
      hasWildcard: true,
      targets: [],
    };

    expect(matchPattern('@app/utils', mapping)).toBe('utils');
    expect(matchPattern('@app/deep/path', mapping)).toBe('deep/path');
  });

  it('매칭되지 않으면 null을 반환한다', () => {
    const mapping: PathMapping = {
      prefix: '@app/',
      suffix: '',
      hasWildcard: true,
      targets: [],
    };

    expect(matchPattern('lodash', mapping)).toBeNull();
    expect(matchPattern('@other/pkg', mapping)).toBeNull();
  });

  it('정확 매칭을 처리한다', () => {
    const mapping: PathMapping = {
      prefix: 'config',
      suffix: '',
      hasWildcard: false,
      targets: [],
    };

    expect(matchPattern('config', mapping)).toBe('');
    expect(matchPattern('config/sub', mapping)).toBeNull();
  });

  it('suffix가 있는 패턴을 매칭한다', () => {
    const mapping: PathMapping = {
      prefix: '@test/',
      suffix: '.mock',
      hasWildcard: true,
      targets: [],
    };

    expect(matchPattern('@test/user.mock', mapping)).toBe('user');
    expect(matchPattern('@test/user', mapping)).toBeNull();
  });
});

describe('createTsconfigPathsResolver', () => {
  const testDir = join(tmpdir(), `lodestar-tsconfig-test-${Date.now()}`);

  async function setupTsconfig(
    content: Record<string, unknown>,
    filename = 'tsconfig.json',
  ): Promise<void> {
    await mkdir(testDir, { recursive: true });
    await writeFile(join(testDir, filename), JSON.stringify(content));
  }

  async function cleanup(): Promise<void> {
    await rm(testDir, { recursive: true, force: true });
  }

  it('tsconfig paths로 alias를 해석한다', async () => {
    await setupTsconfig({
      compilerOptions: {
        baseUrl: '.',
        paths: { '@app/*': ['src/*'] },
      },
    });

    const resolver = createTsconfigPathsResolver(testDir);
    await (resolver as unknown as { loadPaths: () => Promise<unknown> }).loadPaths();

    const result = resolver.resolve({
      importer: 'src/index.ts',
      source: '@app/utils',
      knownFiles: new Set(['src/utils.ts']),
    });

    expect(result).toBe('src/utils.ts');
    await cleanup();
  });

  it('상대 경로 import는 무시한다', async () => {
    await setupTsconfig({
      compilerOptions: { baseUrl: '.', paths: { '@app/*': ['src/*'] } },
    });

    const resolver = createTsconfigPathsResolver(testDir);
    await (resolver as unknown as { loadPaths: () => Promise<unknown> }).loadPaths();

    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: './b',
      knownFiles: new Set(['src/b.ts']),
    });

    expect(result).toBeNull();
    await cleanup();
  });

  it('tsconfig가 없으면 null을 반환한다', async () => {
    const resolver = createTsconfigPathsResolver('/nonexistent');
    await (resolver as unknown as { loadPaths: () => Promise<unknown> }).loadPaths();

    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: '@app/utils',
      knownFiles: new Set(['src/utils.ts']),
    });

    expect(result).toBeNull();
  });

  it('정확 매칭 alias를 해석한다', async () => {
    await setupTsconfig({
      compilerOptions: {
        baseUrl: '.',
        paths: { config: ['src/config/index.ts'] },
      },
    });

    const resolver = createTsconfigPathsResolver(testDir);
    await (resolver as unknown as { loadPaths: () => Promise<unknown> }).loadPaths();

    const result = resolver.resolve({
      importer: 'src/app.ts',
      source: 'config',
      knownFiles: new Set(['src/config/index.ts']),
    });

    expect(result).toBe('src/config/index.ts');
    await cleanup();
  });

  it('확장자를 추론하여 해석한다', async () => {
    await setupTsconfig({
      compilerOptions: {
        baseUrl: '.',
        paths: { '@lib/*': ['lib/*'] },
      },
    });

    const resolver = createTsconfigPathsResolver(testDir);
    await (resolver as unknown as { loadPaths: () => Promise<unknown> }).loadPaths();

    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: '@lib/helpers',
      knownFiles: new Set(['lib/helpers.ts']),
    });

    expect(result).toBe('lib/helpers.ts');
    await cleanup();
  });

  it('여러 타겟 중 첫 번째 매칭을 반환한다', async () => {
    await setupTsconfig({
      compilerOptions: {
        baseUrl: '.',
        paths: { '@shared/*': ['packages/shared/src/*', 'packages/legacy/*'] },
      },
    });

    const resolver = createTsconfigPathsResolver(testDir);
    await (resolver as unknown as { loadPaths: () => Promise<unknown> }).loadPaths();

    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: '@shared/utils',
      knownFiles: new Set(['packages/legacy/utils.ts']),
    });

    expect(result).toBe('packages/legacy/utils.ts');
    await cleanup();
  });

  it('extends로 부모 tsconfig의 paths를 상속한다', async () => {
    await setupTsconfig(
      { compilerOptions: { baseUrl: '.', paths: { '@base/*': ['base/*'] } } },
      'tsconfig.base.json',
    );
    await setupTsconfig({ extends: './tsconfig.base.json' });

    const resolver = createTsconfigPathsResolver(testDir);
    await (resolver as unknown as { loadPaths: () => Promise<unknown> }).loadPaths();

    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: '@base/util',
      knownFiles: new Set(['base/util.ts']),
    });

    expect(result).toBe('base/util.ts');
    await cleanup();
  });

  it('자식 tsconfig의 paths가 부모를 오버라이드한다', async () => {
    await setupTsconfig(
      { compilerOptions: { baseUrl: '.', paths: { '@app/*': ['old/*'] } } },
      'tsconfig.base.json',
    );
    await setupTsconfig({
      extends: './tsconfig.base.json',
      compilerOptions: { paths: { '@app/*': ['new/*'] } },
    });

    const resolver = createTsconfigPathsResolver(testDir);
    await (resolver as unknown as { loadPaths: () => Promise<unknown> }).loadPaths();

    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: '@app/util',
      knownFiles: new Set(['new/util.ts', 'old/util.ts']),
    });

    expect(result).toBe('new/util.ts');
    await cleanup();
  });

  it('index 파일 fallback으로 해석한다', async () => {
    await setupTsconfig({
      compilerOptions: {
        baseUrl: '.',
        paths: { '@mod/*': ['modules/*'] },
      },
    });

    const resolver = createTsconfigPathsResolver(testDir);
    await (resolver as unknown as { loadPaths: () => Promise<unknown> }).loadPaths();

    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: '@mod/auth',
      knownFiles: new Set(['modules/auth/index.ts']),
    });

    expect(result).toBe('modules/auth/index.ts');
    await cleanup();
  });
});
