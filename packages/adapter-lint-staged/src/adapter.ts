import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ToolAdapter, Violation } from '@lodestar/types';

/** lint-staged adapter configuration — maps glob patterns to commands */
interface LintStagedAdapterConfig {
  /** Glob pattern to command mapping — e.g., {"*.ts": "eslint --fix"} */
  readonly commands: Readonly<Record<string, string | readonly string[]>>;
}

/** Indent each line for readable diff output */
function indent(text: string): string {
  return text
    .trimEnd()
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

/** Build a lint-staged config object from adapter config */
function buildLintStagedConfig(config: LintStagedAdapterConfig): Record<string, string | readonly string[]> {
  return { ...config.commands };
}

/**
 * Create a lint-staged adapter for Lodestar.
 * Implements ToolAdapter — verifies .lintstagedrc.json setup and generates config.
 * This is a setup-only adapter: lint-staged is invoked by husky, not by lodestar directly.
 * @param config - lint-staged-specific configuration
 */
function lintStagedAdapter(config: LintStagedAdapterConfig): ToolAdapter<LintStagedAdapterConfig> {
  return {
    name: 'lint-staged',
    config,

    async verifySetup(rootDir: string): Promise<readonly Violation[]> {
      const configPath = join(rootDir, '.lintstagedrc.json');
      const expected = JSON.stringify(buildLintStagedConfig(config), null, 2) + '\n';

      const actual = await readFile(configPath, 'utf-8').catch(() => null);

      if (actual === null) {
        return [
          {
            ruleId: 'lint-staged/setup',
            message: 'Missing .lintstagedrc.json — run `lodestar check --fix` to generate it.',
            severity: 'error',
            location: { file: '.lintstagedrc.json' },
            fix: {
              description: 'Create .lintstagedrc.json from lodestar config',
              apply: () => writeFile(configPath, expected, 'utf-8'),
            },
          },
        ];
      }

      if (actual !== expected) {
        return [
          {
            ruleId: 'lint-staged/setup',
            message: `.lintstagedrc.json differs from lodestar.config.ts.\n  expected:\n${indent(expected)}\n  actual:\n${indent(actual)}`,
            severity: 'error',
            location: { file: '.lintstagedrc.json' },
            fix: {
              description: 'Update .lintstagedrc.json to match lodestar config',
              apply: () => writeFile(configPath, expected, 'utf-8'),
            },
          },
        ];
      }

      return [];
    },

    async generateConfig(): Promise<unknown[]> {
      return [buildLintStagedConfig(config)];
    },
  };
}

export { lintStagedAdapter, buildLintStagedConfig };
export type { LintStagedAdapterConfig };
