import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ToolAdapter, Violation } from '@retemper/lodestar-types';

const execFileAsync = promisify(execFile);

/** Prettier-specific adapter configuration */
interface PrettierAdapterConfig {
  /** Print width — defaults to 80 */
  readonly printWidth?: number;
  /** Tab width — defaults to 2 */
  readonly tabWidth?: number;
  /** Use tabs instead of spaces */
  readonly useTabs?: boolean;
  /** Use semicolons */
  readonly semi?: boolean;
  /** Use single quotes */
  readonly singleQuote?: boolean;
  /** Trailing commas: 'all', 'es5', 'none' */
  readonly trailingComma?: 'all' | 'es5' | 'none';
  /** Bracket spacing */
  readonly bracketSpacing?: boolean;
  /** Arrow function parens: 'always', 'avoid' */
  readonly arrowParens?: 'always' | 'avoid';
  /** End of line: 'lf', 'crlf', 'cr', 'auto' */
  readonly endOfLine?: 'lf' | 'crlf' | 'cr' | 'auto';
  /** Glob patterns to ignore */
  readonly ignore?: readonly string[];
  /** Binary name or path — defaults to "prettier" */
  readonly bin?: string;
  /** File patterns to check — defaults to source patterns from lodestar config */
  readonly include?: readonly string[];
}

/** Indent each line for readable diff output */
function indent(text: string): string {
  return text
    .trimEnd()
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

/** Build a Prettier config object from adapter config */
function buildPrettierConfig(config: PrettierAdapterConfig): Record<string, unknown> {
  const prettierConfig: Record<string, unknown> = {};

  const optionKeys = [
    'printWidth',
    'tabWidth',
    'useTabs',
    'semi',
    'singleQuote',
    'trailingComma',
    'bracketSpacing',
    'arrowParens',
    'endOfLine',
  ] as const;

  for (const key of optionKeys) {
    if (config[key] !== undefined) {
      prettierConfig[key] = config[key];
    }
  }

  return prettierConfig;
}

/** Parse prettier --check stderr to extract unformatted file paths */
function parseCheckOutput(stderr: string, rootDir: string): readonly string[] {
  const files: string[] = [];
  for (const line of stderr.split('\n')) {
    const trimmed = line.replace(/^\[warn\]\s*/, '').trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('Code style') || trimmed.startsWith('Checking')) continue;
    if (trimmed.includes(' ')) continue;

    const relative = trimmed.startsWith(rootDir) ? trimmed.slice(rootDir.length + 1) : trimmed;
    if (relative) {
      files.push(relative);
    }
  }
  return files;
}

/**
 * Create a Prettier adapter for Lodestar.
 * Implements ToolAdapter — runs prettier --check and generates .prettierrc.
 * @param config - Prettier-specific configuration
 */
function prettierAdapter(config: PrettierAdapterConfig = {}): ToolAdapter<PrettierAdapterConfig> {
  return {
    name: 'prettier',
    config,

    async check(rootDir: string, include: readonly string[]): Promise<readonly Violation[]> {
      const bin = config.bin ?? 'prettier';
      const patterns = config.include ?? (include.length > 0 ? [...include] : ['.']);
      const args = ['--check', ...patterns];

      try {
        await execFileAsync(bin, args, {
          cwd: rootDir,
          maxBuffer: 50 * 1024 * 1024,
        });
        return [];
      } catch (error: unknown) {
        const execError = error as { stdout?: string; stderr?: string };
        const unformatted = parseCheckOutput(execError.stderr ?? '', rootDir);

        return unformatted.map((file) => ({
          ruleId: 'prettier/format',
          message: 'File is not formatted',
          severity: 'error' as const,
          location: { file },
        }));
      }
    },

    async fix(rootDir: string, include: readonly string[]): Promise<void> {
      const bin = config.bin ?? 'prettier';
      const patterns = config.include ?? (include.length > 0 ? [...include] : ['.']);
      const args = ['--write', ...patterns];

      await execFileAsync(bin, args, {
        cwd: rootDir,
        maxBuffer: 50 * 1024 * 1024,
      });
    },

    async verifySetup(rootDir: string): Promise<readonly Violation[]> {
      const configPath = join(rootDir, '.prettierrc');
      const expected = JSON.stringify(buildPrettierConfig(config), null, 2) + '\n';

      const actual = await readFile(configPath, 'utf-8').catch(() => null);

      if (actual === null) {
        return [
          {
            ruleId: 'prettier/setup',
            message: 'Missing .prettierrc — run `lodestar check --fix` to generate it.',
            severity: 'error',
            location: { file: '.prettierrc' },
            fix: {
              description: 'Create .prettierrc from lodestar config',
              apply: () => writeFile(configPath, expected, 'utf-8'),
            },
          },
        ];
      }

      if (actual !== expected) {
        return [
          {
            ruleId: 'prettier/setup',
            message: `.prettierrc differs from lodestar.config.ts.\n  expected:\n${indent(expected)}\n  actual:\n${indent(actual)}`,
            severity: 'error',
            location: { file: '.prettierrc' },
            fix: {
              description: 'Update .prettierrc to match lodestar config',
              apply: () => writeFile(configPath, expected, 'utf-8'),
            },
          },
        ];
      }

      return [];
    },

    async generateConfig(): Promise<unknown[]> {
      return [buildPrettierConfig(config)];
    },
  };
}

export { prettierAdapter, buildPrettierConfig, parseCheckOutput };
export type { PrettierAdapterConfig };
