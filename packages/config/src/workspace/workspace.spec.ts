import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
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
    const dir = dirname(fullPath);
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
  it('extracts package patterns', () => {
    const content = `packages:\n  - packages/*\n  - apps/*\n`;
    const result = parsePnpmWorkspaceYaml(content);
    expect(result).toStrictEqual(['packages/*', 'apps/*']);
  });

  it('ignores negation patterns', () => {
    const content = `packages:\n  - packages/*\n  - '!packages/internal'\n`;
    const result = parsePnpmWorkspaceYaml(content);
    expect(result).toStrictEqual(['packages/*']);
  });

  it('returns empty array when packages key is missing', () => {
    const content = `other:\n  - something\n`;
    const result = parsePnpmWorkspaceYaml(content);
    expect(result).toStrictEqual([]);
  });

  it('returns empty array for empty string', () => {
    const result = parsePnpmWorkspaceYaml('');
    expect(result).toStrictEqual([]);
  });

  it('skips comments and blank lines', () => {
    const content = `packages:\n  # comment\n\n  - packages/*\n`;
    const result = parsePnpmWorkspaceYaml(content);
    expect(result).toStrictEqual(['packages/*']);
  });

  it('handles quoted patterns', () => {
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

  it('discovers workspace packages from pnpm-workspace.yaml', async () => {
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

  it('discovers from package.json workspaces field', async () => {
    const { rootDir } = await setup({
      'package.json': JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
      'packages/utils/package.json': JSON.stringify({ name: '@my/utils' }),
    });

    const packages = await discoverWorkspaces(rootDir);

    expect(packages).toHaveLength(1);
    expect(packages[0].name).toBe('@my/utils');
  });

  it('returns empty array when workspace config is missing', async () => {
    const { rootDir } = await setup({
      'package.json': JSON.stringify({ name: 'single-project' }),
    });

    const packages = await discoverWorkspaces(rootDir);

    expect(packages).toStrictEqual([]);
  });

  it('uses basename as name for directories without package.json', async () => {
    const { rootDir } = await setup({
      'pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
      'packages/no-pkg/src/index.ts': '',
    });

    const packages = await discoverWorkspaces(rootDir);

    expect(packages).toHaveLength(1);
    expect(packages[0].name).toBe('no-pkg');
  });

  it('handles workspaces object format ({ packages: [...] })', async () => {
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

  it('returns empty array when neither pnpm-workspace.yaml nor package.json exists', async () => {
    const { rootDir } = await setup({});

    const packages = await discoverWorkspaces(rootDir);

    expect(packages).toStrictEqual([]);
  });

  it('returns empty array when workspaces is an unrecognizable format', async () => {
    const { rootDir } = await setup({
      'package.json': JSON.stringify({ name: 'root', workspaces: 'invalid' }),
    });

    const packages = await discoverWorkspaces(rootDir);

    expect(packages).toStrictEqual([]);
  });

  it('filters out non-string items in workspaces array', async () => {
    const { rootDir } = await setup({
      'package.json': JSON.stringify({ name: 'root', workspaces: ['packages/*', 123] }),
      'packages/lib/package.json': JSON.stringify({ name: '@my/lib' }),
    });

    const packages = await discoverWorkspaces(rootDir);

    expect(packages).toHaveLength(1);
    expect(packages[0].name).toBe('@my/lib');
  });

  it('uses basename for workspace packages without name in package.json', async () => {
    const { rootDir } = await setup({
      'pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
      'packages/unnamed/package.json': JSON.stringify({ version: '1.0.0' }),
    });

    const packages = await discoverWorkspaces(rootDir);

    expect(packages).toHaveLength(1);
    expect(packages[0].name).toBe('unnamed');
  });

  it('handles workspaces using ** pattern', async () => {
    const { rootDir } = await setup({
      'pnpm-workspace.yaml': 'packages:\n  - packages/**\n',
      'packages/lib/package.json': JSON.stringify({ name: '@my/lib' }),
    });

    const packages = await discoverWorkspaces(rootDir);

    expect(packages.length).toBeGreaterThanOrEqual(1);
    const names = packages.map((p) => p.name);
    expect(names).toContain('@my/lib');
  });

  it('handles multiple glob patterns', async () => {
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
