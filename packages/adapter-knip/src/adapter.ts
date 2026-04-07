import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ToolAdapter, Violation } from '@retemper/types';

const execFileAsync = promisify(execFile);

/** Indent each line for readable diff output */
function indent(text: string): string {
  return text
    .trimEnd()
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

/** Knip-specific adapter configuration */
interface KnipAdapterConfig {
  /** Entry file patterns */
  readonly entry?: readonly string[];
  /** Project file patterns */
  readonly project?: readonly string[];
  /** Glob patterns to ignore */
  readonly ignore?: readonly string[];
  /** Ignore specific dependency names */
  readonly ignoreDependencies?: readonly string[];
  /** Binary name or path — defaults to "knip" */
  readonly bin?: string;
}

/** Knip JSON output shape for unused exports */
interface KnipExportEntry {
  readonly file: string;
  readonly name: string;
}

/** Knip CLI JSON output shape */
interface KnipOutput {
  readonly files?: readonly string[];
  readonly dependencies?: readonly string[];
  readonly exports?: readonly KnipExportEntry[];
}

/** Build a knip.json config object from adapter config */
function buildKnipConfig(config: KnipAdapterConfig): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (config.entry && config.entry.length > 0) {
    result.entry = [...config.entry];
  }
  if (config.project && config.project.length > 0) {
    result.project = [...config.project];
  }
  if (config.ignore && config.ignore.length > 0) {
    result.ignore = [...config.ignore];
  }
  if (config.ignoreDependencies && config.ignoreDependencies.length > 0) {
    result.ignoreDependencies = [...config.ignoreDependencies];
  }
  return result;
}

/**
 * Create a Knip adapter for Lodestar.
 * Implements ToolAdapter — runs Knip CLI and parses JSON output to find unused exports, dependencies, and files.
 * @param config - Knip-specific configuration (entry, project, ignore patterns)
 */
function knipAdapter(config: KnipAdapterConfig = {}): ToolAdapter<KnipAdapterConfig> {
  return {
    name: 'knip',
    config,

    async check(rootDir: string, _include: readonly string[]): Promise<readonly Violation[]> {
      const bin = config.bin ?? 'knip';

      const { stdout } = await execFileAsync(bin, ['--reporter', 'json'], {
        cwd: rootDir,
        maxBuffer: 50 * 1024 * 1024,
      }).catch((error: { stdout?: string; stderr?: string }) => ({
        stdout: error.stdout ?? '{}',
        stderr: error.stderr ?? '',
      }));

      const output: KnipOutput = JSON.parse(stdout || '{}');
      const violations: Violation[] = [];

      if (output.files) {
        for (const file of output.files) {
          violations.push({
            ruleId: 'knip/unused-file',
            message: `Unused file: ${file}`,
            severity: 'warn',
            location: { file },
          });
        }
      }

      if (output.dependencies) {
        for (const dep of output.dependencies) {
          violations.push({
            ruleId: 'knip/unused-dependency',
            message: `Unused dependency: ${dep}`,
            severity: 'warn',
            location: { file: 'package.json' },
          });
        }
      }

      if (output.exports) {
        for (const entry of output.exports) {
          violations.push({
            ruleId: 'knip/unused-export',
            message: `Unused export "${entry.name}" in ${entry.file}`,
            severity: 'warn',
            location: { file: entry.file },
          });
        }
      }

      return violations;
    },

    async verifySetup(rootDir: string): Promise<readonly Violation[]> {
      const configPath = join(rootDir, 'knip.json');
      const expected = JSON.stringify(buildKnipConfig(config), null, 2) + '\n';

      const actual = await readFile(configPath, 'utf-8').catch(() => null);

      if (actual === null) {
        return [
          {
            ruleId: 'knip/setup',
            message: 'Missing knip.json — run `lodestar check --fix` to generate it.',
            severity: 'error',
            location: { file: 'knip.json' },
            fix: {
              description: 'Create knip.json from lodestar config',
              apply: () => writeFile(configPath, expected, 'utf-8'),
            },
          },
        ];
      }

      if (actual !== expected) {
        return [
          {
            ruleId: 'knip/setup',
            message: `knip.json differs from lodestar.config.ts.\n  expected:\n${indent(expected)}\n  actual:\n${indent(actual)}`,
            severity: 'error',
            location: { file: 'knip.json' },
            fix: {
              description: 'Update knip.json to match lodestar config',
              apply: () => writeFile(configPath, expected, 'utf-8'),
            },
          },
        ];
      }

      return [];
    },

    async generateConfig(): Promise<unknown[]> {
      return [buildKnipConfig(config)];
    },
  };
}

export { knipAdapter, buildKnipConfig };
export type { KnipAdapterConfig };
