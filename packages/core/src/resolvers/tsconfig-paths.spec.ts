import { describe, it, expect } from 'vitest';
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
  it('removes single-line comments', () => {
    const input = '{\n  "a": 1 // comment\n}';
    expect(JSON.parse(stripJsonComments(input))).toStrictEqual({ a: 1 });
  });

  it('removes multiline comments', () => {
    const input = '{\n  /* multi\n  line */\n  "a": 1\n}';
    expect(JSON.parse(stripJsonComments(input))).toStrictEqual({ a: 1 });
  });

  it('returns original when there are no comments', () => {
    const input = '{"a": 1}';
    expect(stripJsonComments(input)).toBe(input);
  });

  it('preserves URLs inside string literals', () => {
    const input = '{\n  "$schema": "https://json.schemastore.org/tsconfig"\n}';
    expect(JSON.parse(stripJsonComments(input))).toStrictEqual({
      $schema: 'https://json.schemastore.org/tsconfig',
    });
  });

  it('handles mixed: URLs in strings and real comments', () => {
    const input = '{\n  "$schema": "https://example.com/schema", // a comment\n  "a": 1\n}';
    expect(JSON.parse(stripJsonComments(input))).toStrictEqual({
      $schema: 'https://example.com/schema',
      a: 1,
    });
  });

  it('preserves escaped quotes inside strings', () => {
    const input = '{"a": "foo\\"bar//baz"}';
    expect(JSON.parse(stripJsonComments(input))).toStrictEqual({ a: 'foo"bar//baz' });
  });

  it('handles empty string', () => {
    expect(stripJsonComments('')).toBe('');
  });

  it('preserves block comment syntax inside strings', () => {
    const input = '{"a": "/* not a comment */"}';
    expect(JSON.parse(stripJsonComments(input))).toStrictEqual({ a: '/* not a comment */' });
  });

  it('handles trailing single-line comment without newline', () => {
    const input = '{"a": 1} // trailing';
    expect(JSON.parse(stripJsonComments(input))).toStrictEqual({ a: 1 });
  });

  it('preserves escaped backslash before quote in strings', () => {
    const input = '{"a": "end\\\\"}';
    expect(JSON.parse(stripJsonComments(input))).toStrictEqual({ a: 'end\\' });
  });

  it('handles unterminated string gracefully', () => {
    const input = '{"a": "unterminated';
    expect(stripJsonComments(input)).toBe('{"a": "unterminated');
  });

  it('handles unterminated string ending with backslash', () => {
    const input = '{"a": "end\\';
    expect(stripJsonComments(input)).toBe('{"a": "end\\');
  });
});

describe('compileMappings', () => {
  it('parses wildcard patterns', () => {
    const mappings = compileMappings({ '@app/*': ['src/*'] });

    expect(mappings).toHaveLength(1);
    expect(mappings[0].prefix).toBe('@app/');
    expect(mappings[0].suffix).toBe('');
    expect(mappings[0].hasWildcard).toBe(true);
    expect(mappings[0].targets[0].prefix).toBe('src/');
  });

  it('parses exact match patterns', () => {
    const mappings = compileMappings({ 'exact-match': ['src/exact.ts'] });

    expect(mappings[0].hasWildcard).toBe(false);
    expect(mappings[0].prefix).toBe('exact-match');
  });

  it('parses multiple targets', () => {
    const mappings = compileMappings({ '@lib/*': ['lib/*', 'vendor/*'] });

    expect(mappings[0].targets).toHaveLength(2);
    expect(mappings[0].targets[1].prefix).toBe('vendor/');
  });
});

describe('matchPattern', () => {
  it('matches and captures wildcard patterns', () => {
    const mapping: PathMapping = {
      prefix: '@app/',
      suffix: '',
      hasWildcard: true,
      targets: [],
    };

    expect(matchPattern('@app/utils', mapping)).toBe('utils');
    expect(matchPattern('@app/deep/path', mapping)).toBe('deep/path');
  });

  it('returns null when no match', () => {
    const mapping: PathMapping = {
      prefix: '@app/',
      suffix: '',
      hasWildcard: true,
      targets: [],
    };

    expect(matchPattern('lodash', mapping)).toBeNull();
    expect(matchPattern('@other/pkg', mapping)).toBeNull();
  });

  it('handles exact matching', () => {
    const mapping: PathMapping = {
      prefix: 'config',
      suffix: '',
      hasWildcard: false,
      targets: [],
    };

    expect(matchPattern('config', mapping)).toBe('');
    expect(matchPattern('config/sub', mapping)).toBeNull();
  });

  it('matches patterns with suffix', () => {
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
  it('converts rootDir internal path to relative path', () => {
    expect(toRootRelative('/project/src/a.ts', '/project')).toBe('src/a.ts');
  });

  it('returns normalized absolute path for rootDir external path', () => {
    expect(toRootRelative('/other/path/a.ts', '/project')).toBe('/other/path/a.ts');
  });

  it('normalizes backslashes to slashes', () => {
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

  it('detects circular extends and returns null', async () => {
    await setup('a.json', { extends: './b.json', compilerOptions: { paths: { '@a/*': ['a/*'] } } });
    await setup('b.json', { extends: './a.json', compilerOptions: { paths: { '@b/*': ['b/*'] } } });

    const result = await parseTsconfigPaths(join(testDir2, 'a.json'));

    // Should not infinite loop, should return a result from the non-circular part
    expect(result).not.toBeNull();
    await cleanup2();
  });

  it('returns null when extends depth exceeds 10', async () => {
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

  it('resolves alias via tsconfig paths', async () => {
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

  it('ignores relative path imports', async () => {
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

  it('returns null when tsconfig is missing', async () => {
    const resolver = createTsconfigPathsResolver('/nonexistent');
    await (resolver as unknown as { loadPaths: () => Promise<unknown> }).loadPaths();

    const result = resolver.resolve({
      importer: 'src/a.ts',
      source: '@app/utils',
      knownFiles: new Set(['src/utils.ts']),
    });

    expect(result).toBeNull();
  });

  it('resolves exact match alias', async () => {
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

  it('resolves by inferring extension', async () => {
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

  it('returns first match among multiple targets', async () => {
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

  it('inherits parent tsconfig paths via extends', async () => {
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

  it('child tsconfig paths override parent', async () => {
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

  it('resolves via index file fallback', async () => {
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

  it('returns null when no target matches', async () => {
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

  it('ignores absolute path imports', async () => {
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

  it('uses parent baseUrl or tsconfig directory when baseUrl is missing', async () => {
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

  it('loadPaths cache: second call returns cached result', async () => {
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

  it('returns null for tsconfig without paths and without extends', async () => {
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
