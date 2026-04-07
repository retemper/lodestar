import { execFile } from 'node:child_process';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ToolAdapter, Violation } from '@retemper/lodestar-types';

const execFileAsync = promisify(execFile);

/** Indent each line for readable diff output */
function indent(text: string): string {
  return text
    .trimEnd()
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

/** Biome-specific adapter configuration */
interface BiomeAdapterConfig {
  /** Biome rule overrides — keys are group/rule (e.g., "style/noNonNullAssertion") */
  readonly rules?: Readonly<Record<string, BiomeRuleSeverity>>;
  /** Glob patterns to ignore */
  readonly ignore?: readonly string[];
  /** Path to existing biome.json to extend (optional) */
  readonly extends?: string;
  /** Binary name or path — defaults to "biome" */
  readonly bin?: string;
}

/** Biome severity levels */
type BiomeRuleSeverity = 'error' | 'warn' | 'info' | 'off';

/** Biome CLI JSON diagnostic output shape */
interface BiomeDiagnostic {
  readonly category?: string;
  readonly severity?: string;
  readonly description?: string;
  readonly message?: Array<{ readonly content?: string }>;
  readonly location?: {
    readonly path?: { readonly file?: string };
    readonly span?: { readonly start?: number };
    readonly sourceCode?: string;
  };
  readonly advices?: unknown;
}

/** Convert a flat rules map into Biome's nested group/rule structure */
function buildBiomeRules(
  rules: Readonly<Record<string, BiomeRuleSeverity>>,
): Record<string, Record<string, unknown>> {
  const groups: Record<string, Record<string, unknown>> = {};

  for (const [key, severity] of Object.entries(rules)) {
    const slashIndex = key.indexOf('/');
    if (slashIndex === -1) continue;

    const group = key.slice(0, slashIndex);
    const rule = key.slice(slashIndex + 1);

    groups[group] ??= {};
    groups[group][rule] = severity;
  }

  return groups;
}

/** Build a temporary biome.json from adapter config */
function buildBiomeConfig(config: BiomeAdapterConfig): Record<string, unknown> {
  const biomeConfig: Record<string, unknown> = {
    $schema: 'https://biomejs.dev/schemas/1.9.0/schema.json',
  };

  if (config.extends) {
    biomeConfig.extends = [config.extends];
  }

  if (config.ignore && config.ignore.length > 0) {
    biomeConfig.files = { ignore: [...config.ignore] };
  }

  if (config.rules && Object.keys(config.rules).length > 0) {
    biomeConfig.linter = {
      enabled: true,
      rules: buildBiomeRules(config.rules),
    };
  }

  return biomeConfig;
}

/** Map biome severity string to lodestar severity */
function mapSeverity(severity: string | undefined): 'error' | 'warn' {
  return severity === 'error' || severity === 'fatal' ? 'error' : 'warn';
}

/** Extract message text from biome diagnostic */
function extractMessage(diagnostic: BiomeDiagnostic): string {
  if (diagnostic.message) {
    return diagnostic.message.map((m) => m.content ?? '').join('');
  }
  return diagnostic.description ?? 'Unknown biome diagnostic';
}

/**
 * Create a Biome adapter for Lodestar.
 * Implements ToolAdapter — runs Biome CLI and parses JSON output.
 * @param config - Biome-specific configuration (rules, ignore, extends)
 */
function biomeAdapter(config: BiomeAdapterConfig = {}): ToolAdapter<BiomeAdapterConfig> {
  return {
    name: 'biome',
    config,

    async check(rootDir: string, _include: readonly string[]): Promise<readonly Violation[]> {
      const bin = config.bin ?? 'biome';
      const tempConfigPath = join(rootDir, '.lodestar-biome-tmp.json');

      try {
        const biomeConfig = buildBiomeConfig(config);
        await writeFile(tempConfigPath, JSON.stringify(biomeConfig, null, 2));

        const { stdout } = await execFileAsync(
          bin,
          ['lint', '--reporter=json', '--config-path', tempConfigPath, '.'],
          { cwd: rootDir, maxBuffer: 50 * 1024 * 1024 },
        ).catch((error: { stdout?: string; stderr?: string }) => ({
          stdout: error.stdout ?? '[]',
          stderr: error.stderr ?? '',
        }));

        const diagnostics: readonly BiomeDiagnostic[] = JSON.parse(stdout || '[]');

        const violations: Violation[] = [];
        for (const diagnostic of diagnostics) {
          const file = diagnostic.location?.path?.file;
          if (!file) continue;

          violations.push({
            ruleId: `biome/${diagnostic.category ?? 'unknown'}`,
            message: extractMessage(diagnostic),
            severity: mapSeverity(diagnostic.severity),
            location: { file },
          });
        }

        return violations;
      } finally {
        await unlink(tempConfigPath).catch(() => {});
      }
    },

    async verifySetup(rootDir: string): Promise<readonly Violation[]> {
      const configPath = join(rootDir, 'biome.json');
      const expected = JSON.stringify(buildBiomeConfig(config), null, 2) + '\n';

      const actual = await readFile(configPath, 'utf-8').catch(() => null);

      if (actual === null) {
        return [
          {
            ruleId: 'biome/setup',
            message: 'Missing biome.json — run `lodestar check --fix` to generate it.',
            severity: 'error',
            location: { file: 'biome.json' },
            fix: {
              description: 'Create biome.json from lodestar config',
              apply: () => writeFile(configPath, expected, 'utf-8'),
            },
          },
        ];
      }

      if (actual !== expected) {
        return [
          {
            ruleId: 'biome/setup',
            message: `biome.json differs from lodestar.config.ts.\n  expected:\n${indent(expected)}\n  actual:\n${indent(actual)}`,
            severity: 'error',
            location: { file: 'biome.json' },
            fix: {
              description: 'Update biome.json to match lodestar config',
              apply: () => writeFile(configPath, expected, 'utf-8'),
            },
          },
        ];
      }

      return [];
    },

    async generateConfig(): Promise<unknown[]> {
      return [buildBiomeConfig(config)];
    },
  };
}

export { biomeAdapter, buildBiomeConfig, buildBiomeRules };
export type { BiomeAdapterConfig, BiomeRuleSeverity };
