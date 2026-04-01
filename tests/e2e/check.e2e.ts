import { describe, it, expect, afterEach } from 'vitest';
import { createFixtureDir, createFixtureConfig } from '../helpers/fixture.js';
import type { FixtureResult } from '../helpers/fixture.js';
import { runCli } from '../helpers/run-cli.js';

describe('lodestar check E2E', () => {
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

  it('returns exit code 1 for a project with violations', async () => {
    const { rootDir } = await setup({
      'src/.gitkeep': '',
      // Intentionally omitting 'tests/' directory
    });
    await createFixtureConfig(rootDir, {
      plugins: ['@lodestar/plugin-structure'],
      rules: {
        'structure/directory-exists': {
          severity: 'error',
          options: { required: ['src', 'tests'] },
        },
      },
    });

    const result = await runCli(['check'], { cwd: rootDir });

    expect(result.exitCode).toBe(1);
  });

  it('returns exit code 0 for a project with no violations', async () => {
    const { rootDir } = await setup({
      'src/.gitkeep': '',
      'tests/.gitkeep': '',
    });
    await createFixtureConfig(rootDir, {
      plugins: ['@lodestar/plugin-structure'],
      rules: {
        'structure/directory-exists': {
          severity: 'error',
          options: { required: ['src', 'tests'] },
        },
      },
    });

    const result = await runCli(['check'], { cwd: rootDir });

    expect(result.exitCode).toBe(0);
  });

  it('outputs violation messages to stderr', async () => {
    const { rootDir } = await setup({});
    await createFixtureConfig(rootDir, {
      plugins: ['@lodestar/plugin-structure'],
      rules: {
        'structure/directory-exists': {
          severity: 'error',
          options: { required: ['src'] },
        },
      },
    });

    const result = await runCli(['check'], { cwd: rootDir });

    expect(result.stderr).toContain('Required directory "src" does not exist');
  });

  it('outputs a summary to stderr', async () => {
    const { rootDir } = await setup({});
    await createFixtureConfig(rootDir, {
      plugins: ['@lodestar/plugin-structure'],
      rules: {
        'structure/directory-exists': {
          severity: 'error',
          options: { required: ['src'] },
        },
      },
    });

    const result = await runCli(['check'], { cwd: rootDir });

    expect(result.stderr).toMatch(/\d+ errors?, \d+ warnings?/);
  });

  it('outputs an error message when no config file exists', async () => {
    const { rootDir } = await setup({});

    const result = await runCli(['check'], { cwd: rootDir });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No lodestar.config');
  });

  it('returns exit code 0 for rules configured with warn severity', async () => {
    const { rootDir } = await setup({});
    await createFixtureConfig(rootDir, {
      plugins: ['@lodestar/plugin-structure'],
      rules: {
        'structure/directory-exists': {
          severity: 'warn',
          options: { required: ['missing-dir'] },
        },
      },
    });

    const result = await runCli(['check'], { cwd: rootDir });

    // Warnings are not included in errorCount, so exit 0
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('0 errors');
    expect(result.stderr).toContain('1 warning');
  });

  it('detects forbidden files with the no-forbidden-path rule', async () => {
    const { rootDir } = await setup({
      'src/app.ts': 'export {}',
      'src/temp.log': 'log content',
    });
    await createFixtureConfig(rootDir, {
      plugins: ['@lodestar/plugin-structure'],
      rules: {
        'structure/no-forbidden-path': {
          severity: 'error',
          options: { patterns: ['**/*.log'] },
        },
      },
    });

    const result = await runCli(['check'], { cwd: rootDir });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Forbidden path found');
  });

  it('runs multiple rules simultaneously', async () => {
    const { rootDir } = await setup({
      'src/.gitkeep': '',
      'src/BadFile.ts': 'export {}',
    });
    await createFixtureConfig(rootDir, {
      plugins: ['@lodestar/plugin-structure'],
      rules: {
        'structure/directory-exists': {
          severity: 'error',
          options: { required: ['src', 'tests'] },
        },
        'structure/file-naming': {
          severity: 'error',
          options: { convention: 'kebab-case', include: ['src/**/*.ts'] },
        },
      },
    });

    const result = await runCli(['check'], { cwd: rootDir });

    expect(result.exitCode).toBe(1);
    // directory-exists: missing tests + file-naming: BadFile violation
    expect(result.stderr).toContain('Required directory');
    expect(result.stderr).toContain('kebab-case');
  });
});
