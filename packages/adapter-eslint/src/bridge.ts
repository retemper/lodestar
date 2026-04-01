import type { RuleDefinition } from '@lodestar/types';

/** ESLint AST node for import declarations */
interface ImportDeclarationNode {
  readonly type: 'ImportDeclaration';
  readonly source: { readonly value: string };
  readonly specifiers: readonly {
    readonly type: string;
    readonly local: { readonly name: string };
  }[];
  readonly importKind?: 'type' | 'value';
  readonly loc: {
    readonly start: { readonly line: number; readonly column: number };
  };
}

/** ESLint rule context (minimal shape to avoid direct eslint dependency) */
interface ESLintRuleContext {
  readonly options: readonly unknown[];
  readonly filename: string;
  readonly cwd: string;
  report(descriptor: {
    readonly node: unknown;
    readonly messageId: string;
    readonly data?: Readonly<Record<string, string>>;
  }): void;
}

/** ESLint rule module shape */
interface ESLintRuleModule {
  readonly meta: {
    readonly type: string;
    readonly docs?: { readonly description: string };
    readonly schema: readonly unknown[];
    readonly messages: Readonly<Record<string, string>>;
  };
  create(context: ESLintRuleContext): Record<string, (node: ImportDeclarationNode) => void>;
}

/** Check if a value is a plain record object */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Bridge a lodestar RuleDefinition to an ESLint RuleModule.
 * Maps lodestar's async check → ESLint's synchronous ImportDeclaration visitor.
 * Only boundary/deps rules that inspect imports can be bridged.
 */
function bridgeRule(rule: RuleDefinition): ESLintRuleModule {
  return {
    meta: {
      type: 'problem',
      docs: { description: rule.description },
      schema: rule.schema ? [rule.schema] : [],
      messages: {
        violation: '{{message}}',
      },
    },
    create(context: ESLintRuleContext) {
      const violations: Array<{ node: ImportDeclarationNode; message: string }> = [];

      const ruleOptions = isRecord(context.options[0]) ? context.options[0] : {};

      /**
       * Collect import nodes and run the lodestar rule's check synchronously.
       * The bridge creates a minimal RuleContext that captures violations
       * during the ImportDeclaration visitor pass.
       */
      return {
        ImportDeclaration(node: ImportDeclarationNode) {
          const importSource = node.source.value;
          const filename = context.filename;

          /**
           * Delegate to rule-specific import validation.
           * Each bridged rule receives the import source and filename,
           * and can report violations that get mapped back to ESLint diagnostics.
           */
          const ruleCtx = createBridgeContext(ruleOptions, (message) => {
            violations.push({ node, message });
          });

          // Synchronous check — the bridge runs the rule's logic inline
          void checkImport(rule, ruleCtx, filename, importSource);

          for (const v of violations.splice(0)) {
            context.report({
              node: v.node,
              messageId: 'violation',
              data: { message: v.message },
            });
          }
        },
      };
    },
  };
}

/** Minimal bridge context for synchronous import checking */
function createBridgeContext(
  options: Record<string, unknown>,
  onViolation: (message: string) => void,
) {
  return {
    options,
    report(partial: { message: string }) {
      onViolation(partial.message);
    },
  };
}

/**
 * Run a simplified synchronous import check.
 * This is a bridge-specific fast path — the full async rule runs via `lodestar check`.
 */
function checkImport(
  rule: RuleDefinition,
  ctx: { options: Record<string, unknown>; report: (partial: { message: string }) => void },
  _filename: string,
  _importSource: string,
): void {
  // The bridge delegates to rule-specific logic registered via `bridgeImportCheck`
  const checker = importCheckers.get(rule.name);
  if (checker) {
    checker(ctx, _filename, _importSource);
  }
}

type ImportChecker = (
  ctx: { options: Record<string, unknown>; report: (partial: { message: string }) => void },
  filename: string,
  importSource: string,
) => void;

const importCheckers = new Map<string, ImportChecker>();

/** Register an import checker for a specific rule (used by plugin adapters) */
function registerImportChecker(ruleName: string, checker: ImportChecker): void {
  importCheckers.set(ruleName, checker);
}

/** Create a complete ESLint plugin object from bridged rules */
function createESLintPlugin(rules: readonly RuleDefinition[]): {
  rules: Record<string, ESLintRuleModule>;
} {
  const eslintRules: Record<string, ESLintRuleModule> = {};
  for (const rule of rules) {
    eslintRules[rule.name] = bridgeRule(rule);
  }
  return { rules: eslintRules };
}

export { bridgeRule, createESLintPlugin, registerImportChecker };
export type { ESLintRuleModule, ESLintRuleContext, ImportChecker };
