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

  it('returns exit code 1 when there are layer violations', async () => {
    const { rootDir } = await setup({
      'src/domain/entity.ts': "import { repo } from '../infra/repo.ts';",
      'src/infra/repo.ts': 'export const repo = {};',
    });
    await createFixtureConfig(rootDir, {
      plugins: ['@retemper/lodestar-plugin-architecture'],
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

  it('returns exit code 0 when there are no violations', async () => {
    const { rootDir } = await setup({
      'src/domain/entity.ts': 'export const entity = {};',
      'src/infra/repo.ts': "import { entity } from '../domain/entity.ts';",
    });
    await createFixtureConfig(rootDir, {
      plugins: ['@retemper/lodestar-plugin-architecture'],
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

  it('outputs violation messages to stderr', async () => {
    const { rootDir } = await setup({
      'src/domain/entity.ts': "import { repo } from '../infra/repo.ts';",
      'src/infra/repo.ts': 'export const repo = {};',
    });
    await createFixtureConfig(rootDir, {
      plugins: ['@retemper/lodestar-plugin-architecture'],
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

  it('outputs summary to stderr', async () => {
    const { rootDir } = await setup({
      'src/domain/entity.ts': "import { repo } from '../infra/repo.ts';",
      'src/infra/repo.ts': 'export const repo = {};',
    });
    await createFixtureConfig(rootDir, {
      plugins: ['@retemper/lodestar-plugin-architecture'],
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

  it('outputs error message when config file is missing', async () => {
    const { rootDir } = await setup({});

    const result = await runCli(['check'], { cwd: rootDir });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No lodestar.config');
  });

  it('returns exit code 0 for warn severity rules', async () => {
    const { rootDir } = await setup({
      'src/domain/entity.ts': "import { repo } from '../infra/repo.ts';",
      'src/infra/repo.ts': 'export const repo = {};',
    });
    await createFixtureConfig(rootDir, {
      plugins: ['@retemper/lodestar-plugin-architecture'],
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

  it('runs multiple rules simultaneously', async () => {
    const { rootDir } = await setup({
      'src/domain/entity.ts': "import { repo } from '../infra/repo.ts';",
      'src/infra/repo.ts': 'export const repo = {};',
      'src/app.ts': "import { internal } from './domain/internal.ts';",
      'src/domain/internal.ts': 'export const internal = {};',
    });
    await createFixtureConfig(rootDir, {
      plugins: ['@retemper/lodestar-plugin-architecture'],
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
