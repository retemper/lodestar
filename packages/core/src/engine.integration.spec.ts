import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from './engine';
import { resolveConfig } from '@retemper/config';
import type { WrittenConfig, Violation } from '@retemper/types';

/** Result of creating a test fixture directory */
interface FixtureResult {
  readonly rootDir: string;
  cleanup(): Promise<void>;
}

/** Creates a temporary directory with the given file structure */
async function createFixture(
  structure: Readonly<Record<string, string | null>>,
): Promise<FixtureResult> {
  const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-engine-integration-'));

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

/**
 * Creates a symlink for a workspace package in the fixture's node_modules.
 * Allows resolvePlugins() to import real plugins from the fixture.
 */
async function linkPlugin(fixtureRoot: string, packageName: string): Promise<void> {
  const realPackagePath = join(process.cwd(), 'node_modules', ...packageName.split('/'));
  const targetPath = join(fixtureRoot, 'node_modules', ...packageName.split('/'));
  await mkdir(join(targetPath, '..'), { recursive: true });
  await symlink(realPackagePath, targetPath, 'dir');
}

describe('engine.run() integration test', () => {
  const fixtures: FixtureResult[] = [];

  afterEach(async () => {
    for (const f of fixtures) {
      await f.cleanup();
    }
    fixtures.length = 0;
  });

  async function setup(structure: Record<string, string | null>) {
    const fixture = await createFixture(structure);
    fixtures.push(fixture);
    return fixture;
  }

  it('레이어 위반을 감지하고 보고한다', async () => {
    const { rootDir } = await setup({
      'src/domain/entity.ts': "import { repo } from '../infra/repo.ts';",
      'src/infra/repo.ts': 'export const repo = {};',
    });
    await linkPlugin(rootDir, '@retemper/plugin-architecture');

    const config: WrittenConfig = {
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

    const resolved = resolveConfig(config, rootDir);
    const summary = await run({ config: resolved });

    expect(summary.errorCount).toBe(1);
    expect(summary.violations).toHaveLength(1);
    expect(summary.violations[0].message).toContain('domain');
    expect(summary.violations[0].message).toContain('infra');
  });

  it('위반이 없으면 에러 카운트가 0이다', async () => {
    const { rootDir } = await setup({
      'src/domain/entity.ts': 'export const entity = {};',
      'src/infra/repo.ts': "import { entity } from '../domain/entity.ts';",
    });
    await linkPlugin(rootDir, '@retemper/plugin-architecture');

    const config: WrittenConfig = {
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

    const resolved = resolveConfig(config, rootDir);
    const summary = await run({ config: resolved });

    expect(summary.errorCount).toBe(0);
    expect(summary.warnCount).toBe(0);
  });

  it('severity: off로 설정된 규칙은 실행하지 않는다', async () => {
    const { rootDir } = await setup({
      'src/domain/entity.ts': "import { repo } from '../infra/repo.ts';",
      'src/infra/repo.ts': 'export const repo = {};',
    });
    await linkPlugin(rootDir, '@retemper/plugin-architecture');

    const config: WrittenConfig = {
      plugins: ['@retemper/plugin-architecture'],
      rules: {
        'architecture/layers': 'off',
      },
    };

    const resolved = resolveConfig(config, rootDir);
    const summary = await run({ config: resolved });

    expect(summary.totalRules).toBe(0);
    expect(summary.violations).toHaveLength(0);
  });

  it('reporter 라이프사이클 메서드를 순서대로 호출한다', async () => {
    const { rootDir } = await setup({
      'src/domain/entity.ts': "import { repo } from '../infra/repo.ts';",
      'src/infra/repo.ts': 'export const repo = {};',
    });
    await linkPlugin(rootDir, '@retemper/plugin-architecture');

    const calls: string[] = [];
    const reporter = {
      name: 'test',
      onStart: () => calls.push('start'),
      onViolation: (v: Violation) => calls.push(`violation:${v.ruleId}`),
      onComplete: () => calls.push('complete'),
    };

    const config: WrittenConfig = {
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

    const resolved = resolveConfig(config, rootDir);
    await run({ config: resolved, reporter });

    expect(calls[0]).toBe('start');
    expect(calls[calls.length - 1]).toBe('complete');
    expect(calls).toContain('violation:architecture/layers');
  });
});
