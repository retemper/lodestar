import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildHookScript, buildLodestarCommand, normalizeHook, huskyAdapter } from './adapter';

describe('normalizeHook', () => {
  it('converts array to HookDefinition', () => {
    const result = normalizeHook(['lodestar check', 'prettier --write --staged']);
    expect(result).toStrictEqual({
      commands: ['lodestar check', 'prettier --write --staged'],
    });
  });

  it('returns HookDefinition as-is', () => {
    const hook = { commands: ['lodestar check'] };
    const result = normalizeHook(hook);
    expect(result).toStrictEqual(hook);
  });

  it('returns declarative HookDefinition (adapters/rules) as-is', () => {
    const hook = { adapters: ['prettier'], rules: ['structure/*'] };
    const result = normalizeHook(hook);
    expect(result).toStrictEqual(hook);
  });
});

describe('buildHookScript', () => {
  it('generates script with shebang and commands', () => {
    const script = buildHookScript({ commands: ['lodestar check'] });

    expect(script).toContain('#!/usr/bin/env sh');
    expect(script).toContain('lodestar check');
  });

  it('places multiple commands on separate lines', () => {
    const script = buildHookScript({
      commands: ['lodestar check', 'prettier --write --staged'],
    });

    const lines = script.split('\n');
    expect(lines).toContain('lodestar check');
    expect(lines).toContain('prettier --write --staged');
  });
});

describe('buildLodestarCommand', () => {
  it('generates command from a single adapter', () => {
    expect(buildLodestarCommand({ adapters: ['prettier'] })).toBe(
      'npx lodestar check --adapter prettier',
    );
  });

  it('generates command from multiple adapters', () => {
    expect(buildLodestarCommand({ adapters: ['prettier', 'eslint'] })).toBe(
      'npx lodestar check --adapter prettier --adapter eslint',
    );
  });

  it('generates command from rule patterns', () => {
    expect(buildLodestarCommand({ rules: ['structure/*'] })).toBe(
      'npx lodestar check --rule "structure/*"',
    );
  });

  it('combines adapter and rule', () => {
    expect(buildLodestarCommand({ adapters: ['prettier'], rules: ['structure/*'] })).toBe(
      'npx lodestar check --adapter prettier --rule "structure/*"',
    );
  });

  it('returns null when neither adapter nor rule is present', () => {
    expect(buildLodestarCommand({})).toBeNull();
    expect(buildLodestarCommand({ commands: ['echo hi'] })).toBeNull();
  });
});

describe('buildHookScript (declarative)', () => {
  it('generates lodestar command from adapter declarations', () => {
    const script = buildHookScript({ adapters: ['prettier'] });
    expect(script).toContain('npx lodestar check --adapter prettier');
    expect(script).toContain('#!/usr/bin/env sh');
  });

  it('lodestar commands come before raw commands', () => {
    const script = buildHookScript({
      adapters: ['prettier'],
      commands: ['pnpm turbo build'],
    });
    const lines = script.split('\n');
    const lodestarIdx = lines.findIndex((l) => l.includes('npx lodestar check'));
    const buildIdx = lines.findIndex((l) => l.includes('pnpm turbo build'));
    expect(lodestarIdx).toBeLessThan(buildIdx);
  });

  it('behaves the same when only commands are present', () => {
    const script = buildHookScript({ commands: ['echo hello'] });
    expect(script).not.toContain('npx lodestar check');
    expect(script).toContain('echo hello');
  });

  it('empty hook contains only shebang', () => {
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

  it('reports hook-missing violation when hook file does not exist', async () => {
    const rootDir = await createTempDir();
    const adapter = huskyAdapter({
      hooks: { 'pre-commit': ['npx lodestar check'] },
    });

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('husky/setup');
    expect(violations[0].fix).toBeDefined();
  });

  it('reports hook-drift violation when hook content differs from config', async () => {
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

  it('no violation when hook content matches config', async () => {
    const rootDir = await createTempDir();
    const adapter = huskyAdapter({
      hooks: { 'pre-commit': ['npx lodestar check'] },
    });

    // setup first
    await adapter.setup!(rootDir);

    const violations = await adapter.verifySetup!(rootDir);

    expect(violations).toHaveLength(0);
  });

  it('creates missing hook via --fix', async () => {
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

  it('fixes drifted hook via --fix', async () => {
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

  it('setup/verify works with declarative hook config', async () => {
    const rootDir = await createTempDir();
    const adapter = huskyAdapter({
      hooks: {
        'pre-commit': { adapters: ['prettier'] },
        'pre-push': { commands: ['pnpm turbo build'] },
      },
    });

    await adapter.setup!(rootDir);

    const preCommit = await readFile(join(rootDir, '.husky/pre-commit'), 'utf-8');
    expect(preCommit).toContain('npx lodestar check --adapter prettier');

    const prePush = await readFile(join(rootDir, '.husky/pre-push'), 'utf-8');
    expect(prePush).toContain('pnpm turbo build');
    expect(prePush).not.toContain('npx lodestar check');

    const violations = await adapter.verifySetup!(rootDir);
    expect(violations).toHaveLength(0);
  });
});
