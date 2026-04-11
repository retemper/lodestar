import { mkdir, writeFile, chmod, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ToolAdapter, Violation } from '@retemper/lodestar-types';

/** Indent each line for readable diff output */
function indent(text: string): string {
  return text
    .trimEnd()
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

/** Git hook definition — declarative or command-based */
interface HookDefinition {
  /** Raw commands to run in this hook */
  readonly commands?: readonly string[];
  /** Adapter names — generates `npx lodestar check --adapter <name>` */
  readonly adapters?: readonly string[];
  /** Rule patterns — generates `npx lodestar check --rule <pattern>` */
  readonly rules?: readonly string[];
}

/** Husky-specific adapter configuration */
interface HuskyAdapterConfig {
  /** Git hooks to configure — key is hook name (e.g., "pre-commit") */
  readonly hooks: Readonly<Record<string, HookDefinition | readonly string[]>>;
}

/** Normalize hook config — accept array shorthand or full definition */
function normalizeHook(hook: HookDefinition | readonly string[]): HookDefinition {
  if (Array.isArray(hook)) return { commands: hook as readonly string[] };
  return hook as HookDefinition;
}

/** Build a lodestar check command from adapter/rule references */
function buildLodestarCommand(hook: HookDefinition): string | null {
  const args: string[] = [];
  for (const adapter of hook.adapters ?? []) {
    args.push(`--adapter ${adapter}`);
  }
  for (const rule of hook.rules ?? []) {
    args.push(`--rule "${rule}"`);
  }
  if (args.length === 0) return null;
  return `npx lodestar check ${args.join(' ')}`;
}

/** Build the content of a git hook script */
function buildHookScript(hook: HookDefinition): string {
  const lines = ['#!/usr/bin/env sh', ''];

  const lodestarCmd = buildLodestarCommand(hook);
  if (lodestarCmd) {
    lines.push(lodestarCmd);
  }

  for (const command of hook.commands ?? []) {
    lines.push(command);
  }

  lines.push('');
  return lines.join('\n');
}

/** Read a file safely, returning null if not found */
async function readFileSafe(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Create a Husky adapter for Lodestar.
 * verifySetup() detects missing/drifted hooks. setup() creates/updates them.
 * @param config - hooks to configure
 */
function huskyAdapter(config: HuskyAdapterConfig): ToolAdapter<HuskyAdapterConfig> {
  /** Write all hook files to .husky/ */
  async function writeHooks(rootDir: string): Promise<void> {
    const huskyDir = join(rootDir, '.husky');
    await mkdir(huskyDir, { recursive: true });

    for (const [hookName, hookConfig] of Object.entries(config.hooks)) {
      const hook = normalizeHook(hookConfig);
      const script = buildHookScript(hook);
      const hookPath = join(huskyDir, hookName);
      await writeFile(hookPath, script, 'utf-8');
      await chmod(hookPath, 0o755);
    }
  }

  return {
    name: 'husky',
    config,

    async verifySetup(rootDir: string): Promise<readonly Violation[]> {
      const huskyDir = join(rootDir, '.husky');
      const violations: Violation[] = [];

      for (const [hookName, hookConfig] of Object.entries(config.hooks)) {
        const hook = normalizeHook(hookConfig);
        const expected = buildHookScript(hook);
        const hookPath = join(huskyDir, hookName);
        const actual = await readFileSafe(hookPath);

        if (actual === null) {
          violations.push({
            ruleId: 'husky/setup',
            message: `Hook "${hookName}" is not set up. Run \`lodestar check --fix\`.`,
            severity: 'error',
            location: { file: `.husky/${hookName}` },
            fix: {
              description: `Create .husky/${hookName}`,
              apply: () => writeHooks(rootDir),
            },
          });
        } else if (actual !== expected) {
          violations.push({
            ruleId: 'husky/setup',
            message: `Hook "${hookName}" differs from lodestar.config.ts.\n  expected:\n${indent(expected)}\n  actual:\n${indent(actual)}`,
            severity: 'error',
            location: { file: `.husky/${hookName}` },
            fix: {
              description: `Update .husky/${hookName} to match config`,
              apply: () => writeHooks(rootDir),
            },
          });
        }
      }

      return violations;
    },

    async setup(rootDir: string): Promise<void> {
      await writeHooks(rootDir);
    },
  };
}

export { huskyAdapter, buildHookScript, buildLodestarCommand, normalizeHook };
export type { HuskyAdapterConfig, HookDefinition };
