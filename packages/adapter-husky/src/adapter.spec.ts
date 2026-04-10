import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildHookScript, buildLodestarCommand, normalizeHook, huskyAdapter } from './adapter';

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

  it('선언적 HookDefinition(adapters/rules)을 그대로 반환한다', () => {
    const hook = { adapters: ['prettier'], rules: ['structure/*'] };
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

describe('buildLodestarCommand', () => {
  it('단일 adapter로 명령어를 생성한다', () => {
    expect(buildLodestarCommand({ adapters: ['prettier'] })).toBe(
      'npx lodestar check --workspace false --adapter prettier',
    );
  });

  it('복수 adapter로 명령어를 생성한다', () => {
    expect(buildLodestarCommand({ adapters: ['prettier', 'eslint'] })).toBe(
      'npx lodestar check --workspace false --adapter prettier --adapter eslint',
    );
  });

  it('rule 패턴으로 명령어를 생성한다', () => {
    expect(buildLodestarCommand({ rules: ['structure/*'] })).toBe(
      'npx lodestar check --workspace false --rule "structure/*"',
    );
  });

  it('adapter와 rule을 조합한다', () => {
    expect(buildLodestarCommand({ adapters: ['prettier'], rules: ['structure/*'] })).toBe(
      'npx lodestar check --workspace false --adapter prettier --rule "structure/*"',
    );
  });

  it('adapter도 rule도 없으면 null을 반환한다', () => {
    expect(buildLodestarCommand({})).toBeNull();
    expect(buildLodestarCommand({ commands: ['echo hi'] })).toBeNull();
  });
});

describe('buildHookScript (declarative)', () => {
  it('adapter 선언으로 lodestar 명령어를 생성한다', () => {
    const script = buildHookScript({ adapters: ['prettier'] });
    expect(script).toContain('npx lodestar check --workspace false --adapter prettier');
    expect(script).toContain('#!/usr/bin/env sh');
  });

  it('lodestar 명령어가 raw commands보다 먼저 온다', () => {
    const script = buildHookScript({
      adapters: ['prettier'],
      commands: ['pnpm turbo build'],
    });
    const lines = script.split('\n');
    const lodestarIdx = lines.findIndex((l) => l.includes('npx lodestar check'));
    const buildIdx = lines.findIndex((l) => l.includes('pnpm turbo build'));
    expect(lodestarIdx).toBeLessThan(buildIdx);
  });

  it('commands만 있으면 기존과 동일하게 동작한다', () => {
    const script = buildHookScript({ commands: ['echo hello'] });
    expect(script).not.toContain('npx lodestar check');
    expect(script).toContain('echo hello');
  });

  it('빈 hook은 shebang만 포함한다', () => {
    const script = buildHookScript({});
    expect(script).toBe('#!/usr/bin/env sh\n\n');
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

  it('선언적 hook config로 setup/verify가 동작한다', async () => {
    const rootDir = await createTempDir();
    const adapter = huskyAdapter({
      hooks: {
        'pre-commit': { adapters: ['prettier'] },
        'pre-push': { commands: ['pnpm turbo build'] },
      },
    });

    await adapter.setup!(rootDir);

    const preCommit = await readFile(join(rootDir, '.husky/pre-commit'), 'utf-8');
    expect(preCommit).toContain('npx lodestar check --workspace false --adapter prettier');

    const prePush = await readFile(join(rootDir, '.husky/pre-push'), 'utf-8');
    expect(prePush).toContain('pnpm turbo build');
    expect(prePush).not.toContain('npx lodestar check');

    const violations = await adapter.verifySetup!(rootDir);
    expect(violations).toHaveLength(0);
  });
});
