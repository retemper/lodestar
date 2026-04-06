import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildHookScript, normalizeHook, huskyAdapter } from './adapter';

describe('normalizeHook', () => {
  it('배열을 HookDefinition으로 변환한다', () => {
    const result = normalizeHook(['lodestar check', 'prettier --write --staged']);
    expect(result).toStrictEqual({
      commands: ['lodestar check', 'prettier --write --staged'],
    });
  });

  it('HookDefinition은 그대로 반환한다', () => {
    const hook = { commands: ['lodestar check'] };
    const result = normalizeHook(hook);
    expect(result).toStrictEqual(hook);
  });
});

describe('buildHookScript', () => {
  it('shebang과 커맨드를 포함한 스크립트를 생성한다', () => {
    const script = buildHookScript({ commands: ['lodestar check'] });

    expect(script).toContain('#!/usr/bin/env sh');
    expect(script).toContain('lodestar check');
  });

  it('여러 커맨드를 각 줄에 배치한다', () => {
    const script = buildHookScript({
      commands: ['lodestar check', 'prettier --write --staged'],
    });

    const lines = script.split('\n');
    expect(lines).toContain('lodestar check');
    expect(lines).toContain('prettier --write --staged');
  });
});

describe('huskyAdapter verifySetup()', () => {
  const fixtures: string[] = [];

  afterEach(async () => {
    for (const dir of fixtures) {
      await rm(dir, { recursive: true, force: true });
    }
    fixtures.length = 0;
  });

  async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'husky-test-'));
    fixtures.push(dir);
    return dir;
  }

  it('hook 파일이 없으면 hook-missing violation을 보고한다', async () => {
    const rootDir = await createTempDir();
    const adapter = huskyAdapter({
      hooks: { 'pre-commit': ['npx lodestar check'] },
    });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('husky/setup');
    expect(violations[0].fix).toBeDefined();
  });

  it('hook 내용이 config과 다르면 hook-drift violation을 보고한다', async () => {
    const rootDir = await createTempDir();
    await mkdir(join(rootDir, '.husky'), { recursive: true });
    await writeFile(join(rootDir, '.husky/pre-commit'), '#!/bin/sh\necho old\n');

    const adapter = huskyAdapter({
      hooks: { 'pre-commit': ['npx lodestar check'] },
    });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('husky/setup');
    expect(violations[0].message).toContain('differs');
    expect(violations[0].fix).toBeDefined();
  });

  it('hook 내용이 config과 일치하면 violation이 없다', async () => {
    const rootDir = await createTempDir();
    const adapter = huskyAdapter({
      hooks: { 'pre-commit': ['npx lodestar check'] },
    });

    // setup first
    await adapter.setup!(rootDir);

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(0);
  });

  it('--fix로 missing hook을 생성한다', async () => {
    const rootDir = await createTempDir();
    const adapter = huskyAdapter({
      hooks: { 'pre-commit': ['npx lodestar check'] },
    });

    const violations = await adapter.verifySetup!(rootDir);
    expect(violations).toHaveLength(1);

    // apply fix
    await violations[0].fix!.apply();

    const content = await readFile(join(rootDir, '.husky/pre-commit'), 'utf-8');
    expect(content).toContain('npx lodestar check');

    // check again — should pass now
    const after = await adapter.verifySetup!(rootDir);
    expect(after).toHaveLength(0);
  });

  it('--fix로 drift된 hook을 수정한다', async () => {
    const rootDir = await createTempDir();
    await mkdir(join(rootDir, '.husky'), { recursive: true });
    await writeFile(join(rootDir, '.husky/pre-commit'), '#!/bin/sh\necho wrong\n');

    const adapter = huskyAdapter({
      hooks: { 'pre-commit': ['npx lodestar check'] },
    });

    const violations = await adapter.verifySetup!(rootDir);
    expect(violations[0].ruleId).toBe('husky/setup');

    await violations[0].fix!.apply();

    const after = await adapter.verifySetup!(rootDir);
    expect(after).toHaveLength(0);
  });
});
