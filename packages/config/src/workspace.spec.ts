import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverWorkspaces, parsePnpmWorkspaceYaml } from './workspace';

/** Result of creating a test fixture directory */
interface FixtureResult {
  readonly rootDir: string;
  cleanup(): Promise<void>;
}

/** Creates a temporary directory from a file structure map */
async function createFixtureDir(
  structure: Readonly<Record<string, string | null>> = {},
): Promise<FixtureResult> {
  const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-workspace-test-'));

  for (const [relativePath, content] of Object.entries(structure)) {
    const fullPath = join(rootDir, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });

    await (content === null
      ? mkdir(fullPath, { recursive: true })
      : writeFile(fullPath, content, 'utf-8'));
  }

  return {
    rootDir,
    async cleanup() {
      await rm(rootDir, { recursive: true, force: true });
    },
  };
}

describe('parsePnpmWorkspaceYaml', () => {
  it('패키지 패턴을 추출한다', () => {
    const content = `packages:\n  - packages/*\n  - apps/*\n`;
    const result = parsePnpmWorkspaceYaml(content);
    expect(result).toStrictEqual(['packages/*', 'apps/*']);
  });

  it('negation 패턴은 무시한다', () => {
    const content = `packages:\n  - packages/*\n  - '!packages/internal'\n`;
    const result = parsePnpmWorkspaceYaml(content);
    expect(result).toStrictEqual(['packages/*']);
  });

  it('packages 키가 없으면 빈 배열을 반환한다', () => {
    const content = `other:\n  - something\n`;
    const result = parsePnpmWorkspaceYaml(content);
    expect(result).toStrictEqual([]);
  });

  it('빈 문자열이면 빈 배열을 반환한다', () => {
    const result = parsePnpmWorkspaceYaml('');
    expect(result).toStrictEqual([]);
  });

  it('주석과 빈 줄을 건너뛴다', () => {
    const content = `packages:\n  # comment\n\n  - packages/*\n`;
    const result = parsePnpmWorkspaceYaml(content);
    expect(result).toStrictEqual(['packages/*']);
  });

  it('따옴표로 감싼 패턴을 처리한다', () => {
    const content = `packages:\n  - 'packages/*'\n  - "apps/*"\n`;
    const result = parsePnpmWorkspaceYaml(content);
    expect(result).toStrictEqual(['packages/*', 'apps/*']);
  });
});

describe('discoverWorkspaces', () => {
  const fixtures: FixtureResult[] = [];

  afterEach(async () => {
    for (const f of fixtures) {
      await f.cleanup();
    }
    fixtures.length = 0;
  });

  /** Helper that creates a fixture and registers it for cleanup */
  async function setup(structure: Record<string, string | null> = {}) {
    const fixture = await createFixtureDir(structure);
    fixtures.push(fixture);
    return fixture;
  }

  it('pnpm-workspace.yaml에서 워크스페이스 패키지를 탐색한다', async () => {
    const { rootDir } = await setup({
      'pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
      'packages/core/package.json': JSON.stringify({ name: '@my/core' }),
      'packages/cli/package.json': JSON.stringify({ name: '@my/cli' }),
    });

    const packages = await discoverWorkspaces(rootDir);

    expect(packages).toHaveLength(2);
    const names = packages.map((p) => p.name).sort();
    expect(names).toStrictEqual(['@my/cli', '@my/core']);
  });

  it('package.json의 workspaces 필드에서 탐색한다', async () => {
    const { rootDir } = await setup({
      'package.json': JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
      'packages/utils/package.json': JSON.stringify({ name: '@my/utils' }),
    });

    const packages = await discoverWorkspaces(rootDir);

    expect(packages).toHaveLength(1);
    expect(packages[0].name).toBe('@my/utils');
  });

  it('워크스페이스 설정이 없으면 빈 배열을 반환한다', async () => {
    const { rootDir } = await setup({
      'package.json': JSON.stringify({ name: 'single-project' }),
    });

    const packages = await discoverWorkspaces(rootDir);

    expect(packages).toStrictEqual([]);
  });

  it('package.json이 없는 디렉토리는 basename을 이름으로 사용한다', async () => {
    const { rootDir } = await setup({
      'pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
      'packages/no-pkg/src/index.ts': '',
    });

    const packages = await discoverWorkspaces(rootDir);

    expect(packages).toHaveLength(1);
    expect(packages[0].name).toBe('no-pkg');
  });

  it('workspaces 객체 형식({ packages: [...] })을 처리한다', async () => {
    const { rootDir } = await setup({
      'package.json': JSON.stringify({
        name: 'root',
        workspaces: { packages: ['packages/*'] },
      }),
      'packages/lib/package.json': JSON.stringify({ name: '@my/lib' }),
    });

    const packages = await discoverWorkspaces(rootDir);

    expect(packages).toHaveLength(1);
    expect(packages[0].name).toBe('@my/lib');
  });

  it('pnpm-workspace.yaml도 package.json도 없으면 빈 배열을 반환한다', async () => {
    const { rootDir } = await setup({});

    const packages = await discoverWorkspaces(rootDir);

    expect(packages).toStrictEqual([]);
  });

  it('workspaces가 인식할 수 없는 형식이면 빈 배열을 반환한다', async () => {
    const { rootDir } = await setup({
      'package.json': JSON.stringify({ name: 'root', workspaces: 'invalid' }),
    });

    const packages = await discoverWorkspaces(rootDir);

    expect(packages).toStrictEqual([]);
  });

  it('workspaces 배열에 비문자열 항목이 있으면 필터링한다', async () => {
    const { rootDir } = await setup({
      'package.json': JSON.stringify({ name: 'root', workspaces: ['packages/*', 123] }),
      'packages/lib/package.json': JSON.stringify({ name: '@my/lib' }),
    });

    const packages = await discoverWorkspaces(rootDir);

    expect(packages).toHaveLength(1);
    expect(packages[0].name).toBe('@my/lib');
  });

  it('package.json에 name이 없는 워크스페이스 패키지는 basename을 사용한다', async () => {
    const { rootDir } = await setup({
      'pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
      'packages/unnamed/package.json': JSON.stringify({ version: '1.0.0' }),
    });

    const packages = await discoverWorkspaces(rootDir);

    expect(packages).toHaveLength(1);
    expect(packages[0].name).toBe('unnamed');
  });

  it('** 패턴을 사용하는 워크스페이스를 처리한다', async () => {
    const { rootDir } = await setup({
      'pnpm-workspace.yaml': 'packages:\n  - packages/**\n',
      'packages/lib/package.json': JSON.stringify({ name: '@my/lib' }),
    });

    const packages = await discoverWorkspaces(rootDir);

    expect(packages.length).toBeGreaterThanOrEqual(1);
    const names = packages.map((p) => p.name);
    expect(names).toContain('@my/lib');
  });

  it('여러 glob 패턴을 처리한다', async () => {
    const { rootDir } = await setup({
      'pnpm-workspace.yaml': 'packages:\n  - packages/*\n  - apps/*\n',
      'packages/lib/package.json': JSON.stringify({ name: '@my/lib' }),
      'apps/web/package.json': JSON.stringify({ name: '@my/web' }),
    });

    const packages = await discoverWorkspaces(rootDir);

    expect(packages).toHaveLength(2);
    const names = packages.map((p) => p.name).sort();
    expect(names).toStrictEqual(['@my/lib', '@my/web']);
  });
});
