import { describe, it, expect } from 'vitest';
import { generatePreCommitHook, generateCommitMsgHook } from './hooks.js';

describe('generatePreCommitHook', () => {
  it('includes format, lint, and lodestar check with default options', () => {
    const result = generatePreCommitHook();

    expect(result).toContain('pnpm format:check');
    expect(result).toContain('pnpm lint');
    expect(result).toContain('pnpm lodestar check');
  });

  it('includes shebang and husky init script', () => {
    const result = generatePreCommitHook();

    expect(result).toContain('#!/usr/bin/env sh');
    expect(result).toContain('husky.sh');
  });

  it('excludes format:check when format is disabled', () => {
    const result = generatePreCommitHook({ format: false });

    expect(result).not.toContain('pnpm format:check');
    expect(result).toContain('pnpm lint');
    expect(result).toContain('pnpm lodestar check');
  });

  it('excludes lint when lint is disabled', () => {
    const result = generatePreCommitHook({ lint: false });

    expect(result).toContain('pnpm format:check');
    expect(result).not.toContain('pnpm lint');
    expect(result).toContain('pnpm lodestar check');
  });

  it('always includes lodestar check even when both format and lint are disabled', () => {
    const result = generatePreCommitHook({ lint: false, format: false });

    expect(result).not.toContain('pnpm format:check');
    expect(result).not.toContain('pnpm lint');
    expect(result).toContain('pnpm lodestar check');
  });

  it('applies defaults (both true) when called without options', () => {
    const withDefaults = generatePreCommitHook();
    const withExplicit = generatePreCommitHook({ lint: true, format: true });

    expect(withDefaults).toStrictEqual(withExplicit);
  });

  it('lodestar check is always the last command', () => {
    const result = generatePreCommitHook();
    const lines = result.split('\n');
    const lastCommand = lines[lines.length - 1];

    expect(lastCommand).toBe('pnpm lodestar check');
  });
});

describe('generateCommitMsgHook', () => {
  it('includes shebang and husky init script', () => {
    const result = generateCommitMsgHook();

    expect(result).toContain('#!/usr/bin/env sh');
    expect(result).toContain('husky.sh');
  });

  it('includes commit message validation comment', () => {
    const result = generateCommitMsgHook();

    expect(result).toContain('commit message validation');
  });
});
