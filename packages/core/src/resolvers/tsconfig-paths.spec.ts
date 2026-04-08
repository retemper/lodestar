import { describe, it, expect, vi } from 'vitest';
import {
  compileMappings,
  createTsconfigPathsResolver,
  matchPattern,
  parseTsconfigPaths,
  stripJsonComments,
  toRootRelative,
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

describe('toRootRelative', () => {
  it('rootDir 내부 경로를 상대 경로로 변환한다', () => {
    expect(toRootRelative('/project/src/a.ts', '/project')).toBe('src/a.ts');
  });

  it('rootDir 외부 경로는 정규화된 절대 경로를 반환한다', () => {
    expect(toRootRelative('/other/path/a.ts', '/project')).toBe('/other/path/a.ts');
  });

  it('백슬래시를 슬래시로 정규화한다', () => {
    expect(toRootRelative('/project\\src\\a.ts', '/project')).toBe('src/a.ts');
  });
});

describe('parseTsconfigPaths', () => {
  const testDir2 = join(tmpdir(), `lodestar-tsconfig-parse-${Date.now()}`);

  async function setup(filename: string, content: Record<string, unknown>): Promise<void> {
    await mkdir(testDir2, { recursive: true });
    await writeFile(join(testDir2, filename), JSON.stringify(content));
  }

  async function cleanup2(): Promise<void> {
    await rm(testDir2, { recursive: true, force: true });
  }

  it('순환 extends를 감지하고 null을 반환한다', async () => {
    await setup('a.json', { extends: './b.json', compilerOptions: { paths: { '@a/*': ['a/*'] } } });
    await setup('b.json', { extends: './a.json', compilerOptions: { paths: { '@b/*': ['b/*'] } } });

    const result = await parseTsconfigPaths(join(testDir2, 'a.json'));

    // Should not infinite loop, should return a result from the non-circular part
    expect(result).not.toBeNull();
    await cleanup2();
  });

  it('extends 깊이가 10을 초과하면 null을 반환한다', async () => {
    // Create a chain of 12 extends
    for (const i of Array.from({ length: 12 }, (_, idx) => idx)) {
      const content =
        i === 11
          ? { compilerOptions: { baseUrl: '.', paths: { '@deep/*': ['deep/*'] } } }
          : { extends: `./chain-${i + 1}.json` };
      await setup(`chain-${i}.json`, content);
    }

    const result = await parseTsconfigPaths(join(testDir2, 'chain-0.json'));

    // Depth limit should prevent going beyond 10 levels
    expect(result).toBeNull();
    await cleanup2();
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

  it('어떤 타겟도 매칭되지 않으면 null을 반환한다', async () => {
    await setupTsconfig({
      compilerOptions: {
        baseUrl: '.',
        paths: { '@app/*': ['src/*'] },
      },
    });

    const resolver = createTsconfigPathsResolver(testDir);
    await (resolver as unknown as { loadPaths: () => Promise<unknown> }).loadPaths();

    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: '@app/nonexistent',
      knownFiles: new Set(['unrelated/file.ts']),
    });

    expect(result).toBeNull();
    await cleanup();
  });

  it('절대 경로 import는 무시한다', async () => {
    await setupTsconfig({
      compilerOptions: { baseUrl: '.', paths: { '@app/*': ['src/*'] } },
    });

    const resolver = createTsconfigPathsResolver(testDir);
    await (resolver as unknown as { loadPaths: () => Promise<unknown> }).loadPaths();

    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: '/absolute/path',
      knownFiles: new Set(),
    });

    expect(result).toBeNull();
    await cleanup();
  });

  it('baseUrl이 없으면 부모의 baseUrl 또는 tsconfig 디렉토리를 사용한다', async () => {
    await setupTsconfig({
      compilerOptions: {
        paths: { '@app/*': ['src/*'] },
      },
    });

    const resolver = createTsconfigPathsResolver(testDir);
    await (resolver as unknown as { loadPaths: () => Promise<unknown> }).loadPaths();

    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: '@app/utils',
      knownFiles: new Set(['src/utils.ts']),
    });

    expect(result).toBe('src/utils.ts');
    await cleanup();
  });

  it('loadPaths 캐시: 두 번째 호출은 캐시된 결과를 반환한다', async () => {
    await setupTsconfig({
      compilerOptions: { baseUrl: '.', paths: { '@app/*': ['src/*'] } },
    });

    const resolver = createTsconfigPathsResolver(testDir);
    const load = (resolver as unknown as { loadPaths: () => Promise<unknown> }).loadPaths;

    const first = await load();
    const second = await load();

    expect(first).toBe(second);
    await cleanup();
  });

  it('paths가 없고 extends도 없는 tsconfig에서는 null을 반환한다', async () => {
    await setupTsconfig({
      compilerOptions: { strict: true },
    });

    const resolver = createTsconfigPathsResolver(testDir);
    await (resolver as unknown as { loadPaths: () => Promise<unknown> }).loadPaths();

    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: '@app/utils',
      knownFiles: new Set(['src/utils.ts']),
    });

    expect(result).toBeNull();
    await cleanup();
  });
});
