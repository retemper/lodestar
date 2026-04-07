import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ToolAdapter, Violation } from '@retemper/types';

/** commitlint adapter configuration — extends and custom rules */
interface CommitlintAdapterConfig {
  /** Shareable config to extend — e.g., '@commitlint/config-conventional' */
  readonly extends?: readonly string[];
  /** Custom rules — e.g., {"type-enum": [2, "always", ["feat", "fix", "chore"]]} */
  readonly rules?: Readonly<Record<string, unknown>>;
}

/** Indent each line for readable diff output */
function indent(text: string): string {
  return text
    .trimEnd()
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

/** Build a commitlint config object from adapter config */
function buildCommitlintConfig(config: CommitlintAdapterConfig): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (config.extends && config.extends.length > 0) {
    result.extends = [...config.extends];
  }

  if (config.rules && Object.keys(config.rules).length > 0) {
    result.rules = { ...config.rules };
  }

  return result;
}

/**
 * Create a commitlint adapter for Lodestar.
 * Implements ToolAdapter — verifies .commitlintrc.json setup and generates config.
 * This is a setup-only adapter: commitlint is invoked by husky, not by lodestar directly.
 * @param config - commitlint-specific configuration
 */
function commitlintAdapter(
  config: CommitlintAdapterConfig = {},
): ToolAdapter<CommitlintAdapterConfig> {
  return {
    name: 'commitlint',
    config,

    async verifySetup(rootDir: string): Promise<readonly Violation[]> {
      const configPath = join(rootDir, '.commitlintrc.json');
      const expected = JSON.stringify(buildCommitlintConfig(config), null, 2) + '\n';

      const actual = await readFile(configPath, 'utf-8').catch(() => null);

      if (actual === null) {
        return [
          {
            ruleId: 'commitlint/setup',
            message: 'Missing .commitlintrc.json — run `lodestar check --fix` to generate it.',
            severity: 'error',
            location: { file: '.commitlintrc.json' },
            fix: {
              description: 'Create .commitlintrc.json from lodestar config',
              apply: () => writeFile(configPath, expected, 'utf-8'),
            },
          },
        ];
      }

      if (actual !== expected) {
        return [
          {
            ruleId: 'commitlint/setup',
            message: `.commitlintrc.json differs from lodestar.config.ts.\n  expected:\n${indent(expected)}\n  actual:\n${indent(actual)}`,
            severity: 'error',
            location: { file: '.commitlintrc.json' },
            fix: {
              description: 'Update .commitlintrc.json to match lodestar config',
              apply: () => writeFile(configPath, expected, 'utf-8'),
            },
          },
        ];
      }

      return [];
    },

    async generateConfig(): Promise<unknown[]> {
      return [buildCommitlintConfig(config)];
    },
  };
}

export { commitlintAdapter, buildCommitlintConfig };
export type { CommitlintAdapterConfig };
