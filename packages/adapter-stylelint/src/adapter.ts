import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ToolAdapter, Violation } from '@lodestar/types';

const execFileAsync = promisify(execFile);

/** Indent each line for readable diff output */
function indent(text: string): string {
  return text
    .trimEnd()
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

/** Stylelint-specific adapter configuration */
interface StylelintAdapterConfig {
  /** Shareable configs to extend — e.g., 'stylelint-config-standard' */
  readonly extends?: readonly string[];
  /** Custom rules */
  readonly rules?: Readonly<Record<string, unknown>>;
  /** Glob patterns to ignore */
  readonly ignore?: readonly string[];
  /** File patterns to check — defaults to CSS files */
  readonly include?: readonly string[];
  /** Binary name or path — defaults to "stylelint" */
  readonly bin?: string;
}

/** Stylelint JSON output warning shape */
interface StylelintWarning {
  readonly rule: string;
  readonly severity: string;
  readonly text: string;
  readonly line: number;
  readonly column: number;
}

/** Stylelint JSON output entry shape */
interface StylelintResult {
  readonly source: string;
  readonly warnings: readonly StylelintWarning[];
}

/** Build a .stylelintrc.json config object from adapter config */
function buildStylelintConfig(config: StylelintAdapterConfig): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (config.extends && config.extends.length > 0) {
    result.extends = [...config.extends];
  }
  if (config.rules && Object.keys(config.rules).length > 0) {
    result.rules = { ...config.rules };
  }
  if (config.ignore && config.ignore.length > 0) {
    result.ignoreFiles = [...config.ignore];
  }
  return result;
}

/** Map stylelint severity string to lodestar severity */
function mapSeverity(severity: string): 'error' | 'warn' {
  return severity === 'error' ? 'error' : 'warn';
}

/**
 * Create a Stylelint adapter for Lodestar.
 * Implements ToolAdapter — runs Stylelint CLI and parses JSON output for CSS lint violations.
 * @param config - Stylelint-specific configuration (extends, rules, ignore patterns)
 */
function stylelintAdapter(
  config: StylelintAdapterConfig = {},
): ToolAdapter<StylelintAdapterConfig> {
  return {
    name: 'stylelint',
    config,

    async check(rootDir: string, include: readonly string[]): Promise<readonly Violation[]> {
      const bin = config.bin ?? 'stylelint';
      const patterns = config.include ?? (include.length > 0 ? [...include] : ['**/*.css']);
      const args = ['--formatter', 'json', ...patterns];

      const { stdout } = await execFileAsync(bin, args, {
        cwd: rootDir,
        maxBuffer: 50 * 1024 * 1024,
      }).catch((error: { stdout?: string; stderr?: string }) => ({
        stdout: error.stdout ?? '[]',
        stderr: error.stderr ?? '',
      }));

      const results: readonly StylelintResult[] = JSON.parse(stdout || '[]');
      const violations: Violation[] = [];

      for (const result of results) {
        const file = result.source.startsWith(rootDir)
          ? result.source.slice(rootDir.length + 1)
          : result.source;

        for (const warning of result.warnings) {
          violations.push({
            ruleId: `stylelint/${warning.rule}`,
            message: warning.text,
            severity: mapSeverity(warning.severity),
            location: { file },
          });
        }
      }

      return violations;
    },

    async fix(rootDir: string, include: readonly string[]): Promise<void> {
      const bin = config.bin ?? 'stylelint';
      const patterns = config.include ?? (include.length > 0 ? [...include] : ['**/*.css']);
      const args = ['--fix', ...patterns];

      await execFileAsync(bin, args, {
        cwd: rootDir,
        maxBuffer: 50 * 1024 * 1024,
      });
    },

    async verifySetup(rootDir: string): Promise<readonly Violation[]> {
      const configPath = join(rootDir, '.stylelintrc.json');
      const expected = JSON.stringify(buildStylelintConfig(config), null, 2) + '\n';

      const actual = await readFile(configPath, 'utf-8').catch(() => null);

      if (actual === null) {
        return [
          {
            ruleId: 'stylelint/setup',
            message: 'Missing .stylelintrc.json — run `lodestar check --fix` to generate it.',
            severity: 'error',
            location: { file: '.stylelintrc.json' },
            fix: {
              description: 'Create .stylelintrc.json from lodestar config',
              apply: () => writeFile(configPath, expected, 'utf-8'),
            },
          },
        ];
      }

      if (actual !== expected) {
        return [
          {
            ruleId: 'stylelint/setup',
            message: `.stylelintrc.json differs from lodestar.config.ts.\n  expected:\n${indent(expected)}\n  actual:\n${indent(actual)}`,
            severity: 'error',
            location: { file: '.stylelintrc.json' },
            fix: {
              description: 'Update .stylelintrc.json to match lodestar config',
              apply: () => writeFile(configPath, expected, 'utf-8'),
            },
          },
        ];
      }

      return [];
    },

    async generateConfig(): Promise<unknown[]> {
      return [buildStylelintConfig(config)];
    },
  };
}

export { stylelintAdapter, buildStylelintConfig };
export type { StylelintAdapterConfig };
