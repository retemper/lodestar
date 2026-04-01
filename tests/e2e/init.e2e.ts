import { describe, it, expect, afterEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFixtureDir } from '../helpers/fixture.js';
import type { FixtureResult } from '../helpers/fixture.js';
import { runCli } from '../helpers/run-cli.js';

describe('lodestar init E2E', () => {
  const fixtures: FixtureResult[] = [];

  afterEach(async () => {
    for (const f of fixtures) {
      await f.cleanup();
    }
    fixtures.length = 0;
  });

  /** Helper that creates a fixture and registers it for cleanup */
  async function setup() {
    const fixture = await createFixtureDir({});
    fixtures.push(fixture);
    return fixture;
  }

  it('creates a config file with the default preset (app)', async () => {
    const { rootDir } = await setup();

    const result = await runCli(['init'], { cwd: rootDir });

    expect(result.exitCode).toBe(0);

    const configContent = await readFile(join(rootDir, 'lodestar.config.ts'), 'utf-8');
    expect(configContent).toContain('@lodestar/preset-app');
    expect(configContent).toContain('defineConfig');
  });

  it('creates a lib preset config with the --preset lib option', async () => {
    const { rootDir } = await setup();

    const result = await runCli(['init', '--preset', 'lib'], { cwd: rootDir });

    expect(result.exitCode).toBe(0);

    const configContent = await readFile(join(rootDir, 'lodestar.config.ts'), 'utf-8');
    expect(configContent).toContain('@lodestar/preset-lib');
  });

  it('creates a server preset config with the --preset server option', async () => {
    const { rootDir } = await setup();

    const result = await runCli(['init', '--preset', 'server'], { cwd: rootDir });

    expect(result.exitCode).toBe(0);

    const configContent = await readFile(join(rootDir, 'lodestar.config.ts'), 'utf-8');
    expect(configContent).toContain('@lodestar/preset-server');
  });

  it('generated file contains valid TypeScript import statements', async () => {
    const { rootDir } = await setup();

    await runCli(['init'], { cwd: rootDir });

    const configContent = await readFile(join(rootDir, 'lodestar.config.ts'), 'utf-8');
    expect(configContent).toContain("import { defineConfig } from 'lodestar'");
    expect(configContent).toContain('export default defineConfig(');
  });

  it('outputs a creation success message to stderr', async () => {
    const { rootDir } = await setup();

    const result = await runCli(['init'], { cwd: rootDir });

    expect(result.stderr).toContain('Created');
    expect(result.stderr).toContain('lodestar.config.ts');
  });
});
