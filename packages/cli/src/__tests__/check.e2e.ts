import { describe, it, expect, afterEach } from 'vitest';
import { createFixtureDir, createFixtureConfig } from './helpers/fixture';
import type { FixtureResult } from './helpers/fixture';
import { runCli } from './helpers/run-cli';

describe('lodestar check E2E', () => {
  const fixtures: FixtureResult[] = [];

  afterEach(async () => {
    for (const f of fixtures) {
      await f.cleanup();
    }
    fixtures.length = 0;
  });

  async function setup(structure: Record<string, string | null> = {}) {
    const fixture = await createFixtureDir(structure);
    fixtures.push(fixture);
    return fixture;
  }

  it('레이어 위반이 있으면 exit code 1을 반환한다', async () => {
    const { rootDir } = await setup({
      'src/domain/entity.ts': "import { repo } from '../infra/repo.ts';",
      'src/infra/repo.ts': 'export const repo = {};',
    });
    await createFixtureConfig(rootDir, {
      plugins: ['@lodestar/plugin-architecture'],
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
    });

    const result = await runCli(['check'], { cwd: rootDir });
    expect(result.exitCode).toBe(1);
  });

  it('위반이 없으면 exit code 0을 반환한다', async () => {
    const { rootDir } = await setup({
      'src/domain/entity.ts': 'export const entity = {};',
      'src/infra/repo.ts': "import { entity } from '../domain/entity.ts';",
    });
    await createFixtureConfig(rootDir, {
      plugins: ['@lodestar/plugin-architecture'],
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
    });

    const result = await runCli(['check'], { cwd: rootDir });
    expect(result.exitCode).toBe(0);
  });

  it('위반 메시지를 stderr에 출력한다', async () => {
    const { rootDir } = await setup({
      'src/domain/entity.ts': "import { repo } from '../infra/repo.ts';",
      'src/infra/repo.ts': 'export const repo = {};',
    });
    await createFixtureConfig(rootDir, {
      plugins: ['@lodestar/plugin-architecture'],
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
    });

    const result = await runCli(['check'], { cwd: rootDir });
    expect(result.stderr).toContain('cannot import');
  });

  it('summary를 stderr에 출력한다', async () => {
    const { rootDir } = await setup({
      'src/domain/entity.ts': "import { repo } from '../infra/repo.ts';",
      'src/infra/repo.ts': 'export const repo = {};',
    });
    await createFixtureConfig(rootDir, {
      plugins: ['@lodestar/plugin-architecture'],
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
    });

    const result = await runCli(['check'], { cwd: rootDir });
    expect(result.stderr).toMatch(/\d+ errors?, \d+ warnings?/);
  });

  it('config 파일이 없으면 에러 메시지를 출력한다', async () => {
    const { rootDir } = await setup({});

    const result = await runCli(['check'], { cwd: rootDir });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No lodestar.config');
  });

  it('warn severity 규칙은 exit code 0을 반환한다', async () => {
    const { rootDir } = await setup({
      'src/domain/entity.ts': "import { repo } from '../infra/repo.ts';",
      'src/infra/repo.ts': 'export const repo = {};',
    });
    await createFixtureConfig(rootDir, {
      plugins: ['@lodestar/plugin-architecture'],
      rules: {
        'architecture/layers': {
          severity: 'warn',
          options: {
            layers: [
              { name: 'domain', path: 'src/domain/**/*.ts' },
              { name: 'infra', path: 'src/infra/**/*.ts', canImport: ['domain'] },
            ],
          },
        },
      },
    });

    const result = await runCli(['check'], { cwd: rootDir });
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('0 errors');
    expect(result.stderr).toContain('1 warning');
  });

  it('여러 규칙을 동시에 실행한다', async () => {
    const { rootDir } = await setup({
      'src/domain/entity.ts': "import { repo } from '../infra/repo.ts';",
      'src/infra/repo.ts': 'export const repo = {};',
      'src/app.ts': "import { internal } from './domain/internal.ts';",
      'src/domain/internal.ts': 'export const internal = {};',
    });
    await createFixtureConfig(rootDir, {
      plugins: ['@lodestar/plugin-architecture'],
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
        'architecture/modules': {
          severity: 'error',
          options: { modules: ['src/domain'] },
        },
      },
    });

    const result = await runCli(['check'], { cwd: rootDir });
    expect(result.exitCode).toBe(1);
  });
});
