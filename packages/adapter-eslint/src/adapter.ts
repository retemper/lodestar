import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ToolAdapter, Violation } from '@lodestar/types';

/** ESLint-specific adapter configuration */
interface EslintAdapterConfig {
  /** Base presets — 'recommended', 'strict', 'stylistic' map to typescript-eslint configs */
  readonly presets?: readonly string[];
  /** ESLint plugin packages to include (e.g., import-x, unicorn) */
  readonly plugins?: Readonly<Record<string, unknown>>;
  /** ESLint rules with standard severity/options format */
  readonly rules?: Readonly<Record<string, unknown>>;
  /** Global ignore patterns */
  readonly ignores?: readonly string[];
  /** File-specific rule overrides */
  readonly overrides?: readonly {
    readonly files: readonly string[];
    readonly rules: Readonly<Record<string, unknown>>;
  }[];
}

/** Template for eslint.config.js that bridges to lodestar config */
const ESLINT_CONFIG_TEMPLATE = `import { fromLodestar } from '@lodestar/adapter-eslint';

export default await fromLodestar();
`;

/** Map of preset names to typescript-eslint config paths */
const PRESET_MAP: Readonly<Record<string, { module: string; export: string }>> = {
  recommended: { module: 'typescript-eslint', export: 'configs.recommended' },
  strict: { module: 'typescript-eslint', export: 'configs.strict' },
  stylistic: { module: 'typescript-eslint', export: 'configs.stylistic' },
};

/** Dynamically import a default export */
async function importDefault(moduleName: string): Promise<unknown> {
  try {
    const mod = await import(moduleName);
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

/** Resolve preset names to actual ESLint config objects */
async function resolvePresets(presets: readonly string[]): Promise<unknown[]> {
  const configs: unknown[] = [];

  for (const preset of presets) {
    const mapping = PRESET_MAP[preset];
    if (!mapping) continue;

    const mod = await importDefault(mapping.module);
    if (!mod || typeof mod !== 'object') continue;

    const parts = mapping.export.split('.');
    let value: unknown = mod;
    for (const part of parts) {
      value = (value as Record<string, unknown>)?.[part];
    }

    if (Array.isArray(value)) {
      configs.push(...value);
    } else if (value) {
      configs.push(value);
    }
  }

  return configs;
}

/**
 * Build ESLint flat config array from adapter config.
 * @param adapterConfig - the ESLint adapter configuration
 */
async function buildFlatConfig(adapterConfig: EslintAdapterConfig): Promise<unknown[]> {
  const configs: unknown[] = [];

  if (adapterConfig.ignores && adapterConfig.ignores.length > 0) {
    configs.push({ ignores: [...adapterConfig.ignores] });
  }

  const baseEslint = await importDefault('@eslint/js');
  const recommended = (baseEslint as { configs?: { recommended?: unknown } })?.configs?.recommended;
  if (recommended) {
    configs.push(recommended);
  }

  if (adapterConfig.presets) {
    const presetConfigs = await resolvePresets(adapterConfig.presets);
    configs.push(...presetConfigs);
  }

  const mainConfig: Record<string, unknown> = {};
  if (adapterConfig.plugins && Object.keys(adapterConfig.plugins).length > 0) {
    mainConfig.plugins = { ...adapterConfig.plugins };
  }
  if (adapterConfig.rules && Object.keys(adapterConfig.rules).length > 0) {
    mainConfig.rules = { ...adapterConfig.rules };
  }
  if (Object.keys(mainConfig).length > 0) {
    configs.push(mainConfig);
  }

  if (adapterConfig.overrides) {
    for (const override of adapterConfig.overrides) {
      configs.push({
        files: [...override.files],
        rules: { ...override.rules },
      });
    }
  }

  return configs;
}

/**
 * Create an ESLint adapter for Lodestar.
 * Implements ToolAdapter — runs ESLint via Node API and generates flat config for IDE.
 * @param config - ESLint-specific configuration (presets, rules, plugins, etc.)
 */
function eslintAdapter(config: EslintAdapterConfig): ToolAdapter<EslintAdapterConfig> {
  return {
    name: 'eslint',
    config,

    async check(rootDir: string, include: readonly string[]): Promise<readonly Violation[]> {
      const eslintModule = await import('eslint').catch(() => null);
      if (!eslintModule) {
        throw new Error(
          'ESLint is required for the eslint adapter. Install it: npm install -D eslint typescript-eslint',
        );
      }

      const flatConfig = await buildFlatConfig(config);

      const eslint = new eslintModule.ESLint({
        overrideConfigFile: true,
        overrideConfig: flatConfig as never,
        cwd: rootDir,
        errorOnUnmatchedPattern: false,
      });

      const patterns = include.length > 0 ? [...include] : ['**/*.ts', '**/*.tsx'];
      const results = await eslint.lintFiles(patterns);

      const violations: Violation[] = [];
      for (const result of results) {
        const relativePath = result.filePath.startsWith(rootDir)
          ? result.filePath.slice(rootDir.length + 1)
          : result.filePath;

        for (const msg of result.messages) {
          violations.push({
            ruleId: `eslint/${msg.ruleId ?? 'unknown'}`,
            message: msg.message,
            severity: msg.severity === 2 ? 'error' : 'warn',
            location: { file: relativePath, line: msg.line, column: msg.column },
          });
        }
      }

      return violations;
    },

    async fix(rootDir: string, include: readonly string[]): Promise<void> {
      const eslintModule = await import('eslint').catch(() => null);
      if (!eslintModule) return;

      const flatConfig = await buildFlatConfig(config);
      const eslint = new eslintModule.ESLint({
        overrideConfigFile: true,
        overrideConfig: flatConfig as never,
        cwd: rootDir,
        fix: true,
        errorOnUnmatchedPattern: false,
      });

      const patterns = include.length > 0 ? [...include] : ['**/*.ts', '**/*.tsx'];
      const results = await eslint.lintFiles(patterns);
      await eslintModule.ESLint.outputFixes(results);
    },

    async verifySetup(rootDir: string): Promise<readonly Violation[]> {
      const configPath = join(rootDir, 'eslint.config.js');
      const actual = await readFile(configPath, 'utf-8').catch(() => null);

      if (actual === null) {
        return [
          {
            ruleId: 'eslint/setup',
            message: 'Missing eslint.config.js — run `lodestar check --fix` to generate it.',
            severity: 'error',
            location: { file: 'eslint.config.js' },
            fix: {
              description: 'Create eslint.config.js with fromLodestar() bridge',
              apply: () => writeFile(configPath, ESLINT_CONFIG_TEMPLATE, 'utf-8'),
            },
          },
        ];
      }

      return [];
    },

    async generateConfig(): Promise<unknown[]> {
      return buildFlatConfig(config);
    },
  };
}

export { eslintAdapter, buildFlatConfig };
export type { EslintAdapterConfig };
