import { describe, it, expect, afterEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFixtureDir } from './helpers/fixture';
import type { FixtureResult } from './helpers/fixture';
import { runCli } from './helpers/run-cli';

describe('lodestar init E2E', () => {
  const fixtures: FixtureResult[] = [];

  afterEach(async () => {
    for (const f of fixtures) {
      await f.cleanup();
    }
    fixtures.length = 0;
  });

  async function setup() {
    const fixture = await createFixtureDir({});
    fixtures.push(fixture);
    return fixture;
  }

  it('lodestar.config.ts 파일을 생성한다', async () => {
    const { rootDir } = await setup();

    const result = await runCli(['init'], { cwd: rootDir });

    expect(result.exitCode).toBe(0);

    const configContent = await readFile(join(rootDir, 'lodestar.config.ts'), 'utf-8');
    expect(configContent).toContain('defineConfig');
  });

  it('architecture 플러그인을 포함한다', async () => {
    const { rootDir } = await setup();

    await runCli(['init'], { cwd: rootDir });

    const configContent = await readFile(join(rootDir, 'lodestar.config.ts'), 'utf-8');
    expect(configContent).toContain('@retemper/lodestar-plugin-architecture');
    expect(configContent).toContain('pluginArchitecture');
    expect(configContent).toContain('architecture/layers');
  });

  it('유효한 TypeScript import 문을 포함한다', async () => {
    const { rootDir } = await setup();

    await runCli(['init'], { cwd: rootDir });

    const configContent = await readFile(join(rootDir, 'lodestar.config.ts'), 'utf-8');
    expect(configContent).toContain("import { defineConfig } from 'lodestar'");
    expect(configContent).toContain('export default defineConfig(');
  });

  it('생성 성공 메시지를 stderr에 출력한다', async () => {
    const { rootDir } = await setup();

    const result = await runCli(['init'], { cwd: rootDir });

    expect(result.stderr).toContain('Created');
    expect(result.stderr).toContain('lodestar.config.ts');
  });
});
