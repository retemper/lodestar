import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { runWorkspace } from './workspace-runner';
import type { WrittenConfig, RunSummary } from '@retemper/types';
import type { WorkspacePackage } from '@retemper/config';
import type { WorkspaceReporter } from './workspace-runner';

/** Result of creating a test fixture directory */
interface FixtureResult {
  readonly rootDir: string;
  cleanup(): Promise<void>;
}

/** Creates a temporary monorepo fixture (including pnpm-workspace.yaml) */
async function createMonorepoFixture(
  structure: Readonly<Record<string, string | null>>,
): Promise<FixtureResult> {
  const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-workspace-integration-'));

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

/** Creates a symlink for a workspace plugin in the fixture's node_modules */
async function linkPlugin(fixtureRoot: string, packageName: string): Promise<void> {
  const realPackagePath = join(process.cwd(), 'node_modules', ...packageName.split('/'));
  const targetPath = join(fixtureRoot, 'node_modules', ...packageName.split('/'));
  await mkdir(join(targetPath, '..'), { recursive: true });
  await symlink(realPackagePath, targetPath, 'dir');
}

/** Creates a plugin symlink in a child package's node_modules */
async function linkPluginToPackage(
  fixtureRoot: string,
  packageDir: string,
  packageName: string,
): Promise<void> {
  const realPackagePath = join(process.cwd(), 'node_modules', ...packageName.split('/'));
  const targetPath = join(fixtureRoot, packageDir, 'node_modules', ...packageName.split('/'));
  await mkdir(join(targetPath, '..'), { recursive: true });
  await symlink(realPackagePath, targetPath, 'dir');
}

/** Helper to create an architecture/layers rule configuration */
function makeLayersConfig(): WrittenConfig {
  return {
    plugins: ['@retemper/plugin-architecture'],
    rules: {
      'architecture/layers': {
        severity: 'error',
        options: {
          layers: [
            { name: 'domain', path: 'src/domain/**/*.ts' },
            { name: 'infra', path: 'src/infra/**/*.ts', canImport: ['domain'] },
          ],
        },
      },
    },
  };
}

describe('runWorkspace() integration test', () => {
  const fixtures: FixtureResult[] = [];

  afterEach(async () => {
    for (const f of fixtures) {
      await f.cleanup();
    }
    fixtures.length = 0;
  });

  async function setup(structure: Record<string, string | null>) {
    const fixture = await createMonorepoFixture(structure);
    fixtures.push(fixture);
    return fixture;
  }

  it('루트 config로 모노레포 루트를 검사한다', async () => {
    const { rootDir } = await setup({
      'pnpm-workspace.yaml': 'packages:\n  - "packages/*"',
      'packages/core/package.json': JSON.stringify({ name: '@test/core' }),
      'src/domain/entity.ts': 'export const entity = {};',
      'src/infra/repo.ts': "import { entity } from '../domain/entity.ts';",
    });
    await linkPlugin(rootDir, '@retemper/plugin-architecture');

    const rootConfig = makeLayersConfig();
    const result = await runWorkspace({ rootDir, rootConfig });

    expect(result.rootSummary.errorCount).toBe(0);
  });

  it('패키지를 발견하고 per-package config를 실행한다', async () => {
    const pkgConfig = `
      export default {
        plugins: ['@retemper/plugin-architecture'],
        rules: {
          'architecture/layers': {
            severity: 'error',
            options: {
              layers: [
                { name: 'domain', path: 'src/domain/**/*.ts' },
                { name: 'infra', path: 'src/infra/**/*.ts', canImport: ['domain'] },
              ],
            },
          },
        },
      };
    `;

    const { rootDir } = await setup({
      'pnpm-workspace.yaml': 'packages:\n  - "packages/*"',
      'packages/alpha/package.json': JSON.stringify({ name: '@test/alpha' }),
      'packages/alpha/src/domain/entity.ts': "import { repo } from '../infra/repo.ts';",
      'packages/alpha/src/infra/repo.ts': 'export const repo = {};',
      'packages/alpha/lodestar.config.mjs': pkgConfig,
      'packages/beta/package.json': JSON.stringify({ name: '@test/beta' }),
      'packages/beta/src/domain/entity.ts': 'export const entity = {};',
      'packages/beta/src/infra/repo.ts': "import { entity } from '../domain/entity.ts';",
      'packages/beta/lodestar.config.mjs': pkgConfig,
    });

    await linkPlugin(rootDir, '@retemper/plugin-architecture');
    await linkPluginToPackage(rootDir, 'packages/alpha', '@retemper/plugin-architecture');
    await linkPluginToPackage(rootDir, 'packages/beta', '@retemper/plugin-architecture');

    const rootConfig = makeLayersConfig();
    const result = await runWorkspace({ rootDir, rootConfig });

    expect(result.packages).toHaveLength(2);

    const alphaResult = result.packages.find((p) => p.package.name === '@test/alpha');
    const betaResult = result.packages.find((p) => p.package.name === '@test/beta');

    expect(alphaResult?.summary.errorCount).toBe(1);
    expect(betaResult?.summary.errorCount).toBe(0);
    expect(result.totalErrorCount).toBeGreaterThanOrEqual(1);
  });

  it('자체 config가 없는 패키지는 건너뛴다', async () => {
    const pkgConfig = `
      export default {
        plugins: ['@retemper/plugin-architecture'],
        rules: {
          'architecture/layers': {
            severity: 'error',
            options: {
              layers: [
                { name: 'domain', path: 'src/domain/**/*.ts' },
              ],
            },
          },
        },
      };
    `;

    const { rootDir } = await setup({
      'pnpm-workspace.yaml': 'packages:\n  - "packages/*"',
      'packages/with-config/package.json': JSON.stringify({ name: '@test/with-config' }),
      'packages/with-config/src/domain/entity.ts': 'export const entity = {};',
      'packages/with-config/lodestar.config.mjs': pkgConfig,
      'packages/no-config/package.json': JSON.stringify({ name: '@test/no-config' }),
    });

    await linkPlugin(rootDir, '@retemper/plugin-architecture');
    await linkPluginToPackage(rootDir, 'packages/with-config', '@retemper/plugin-architecture');

    const rootConfig = makeLayersConfig();
    const result = await runWorkspace({ rootDir, rootConfig });

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0].package.name).toBe('@test/with-config');
  });

  it('workspace reporter 라이프사이클 메서드를 호출한다', async () => {
    const pkgConfig = `
      export default {
        plugins: ['@retemper/plugin-architecture'],
        rules: {
          'architecture/layers': {
            severity: 'error',
            options: {
              layers: [
                { name: 'domain', path: 'src/domain/**/*.ts' },
              ],
            },
          },
        },
      };
    `;

    const { rootDir } = await setup({
      'pnpm-workspace.yaml': 'packages:\n  - "packages/*"',
      'packages/app/package.json': JSON.stringify({ name: '@test/app' }),
      'packages/app/src/domain/entity.ts': 'export const entity = {};',
      'packages/app/lodestar.config.mjs': pkgConfig,
    });

    await linkPlugin(rootDir, '@retemper/plugin-architecture');
    await linkPluginToPackage(rootDir, 'packages/app', '@retemper/plugin-architecture');

    const events: string[] = [];
    const reporter: WorkspaceReporter = {
      name: 'test',
      onStart: () => events.push('start'),
      onViolation: () => events.push('violation'),
      onComplete: () => events.push('complete'),
      onPackageStart: (pkg: WorkspacePackage) => events.push(`pkg-start:${pkg.name}`),
      onPackageComplete: (pkg: WorkspacePackage, _summary: RunSummary) =>
        events.push(`pkg-complete:${pkg.name}`),
    };

    const rootConfig = makeLayersConfig();
    await runWorkspace({ rootDir, rootConfig, reporter });

    expect(events).toContain('pkg-start:(root)');
    expect(events).toContain('pkg-complete:(root)');
    expect(events).toContain('pkg-start:@test/app');
    expect(events).toContain('pkg-complete:@test/app');
  });
});
