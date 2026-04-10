import type {
  RuleContext,
  RuleProviders,
  Violation,
  FileSystemProvider,
  DependencyGraphProvider,
  ASTProvider,
  ConfigFileProvider,
  GitProvider,
  ImportInfo,
  ExportInfo,
} from '@retemper/lodestar-types';

/** Options for creating mock providers */
interface MockProviderOverrides {
  readonly glob?: (...args: unknown[]) => Promise<readonly string[]>;
  readonly readFile?: (...args: unknown[]) => Promise<string>;
  readonly exists?: (...args: unknown[]) => Promise<boolean>;
  readonly readJson?: (...args: unknown[]) => Promise<unknown>;
  readonly getDependencies?: (...args: unknown[]) => Promise<readonly string[]>;
  readonly getDependents?: (...args: unknown[]) => Promise<readonly string[]>;
  readonly hasCircular?: (...args: unknown[]) => Promise<boolean>;
  readonly getModuleGraph?: (...args: unknown[]) => Promise<unknown>;
  readonly getSourceFile?: (...args: unknown[]) => Promise<unknown>;
  readonly getImports?: (...args: unknown[]) => Promise<readonly ImportInfo[]>;
  readonly getExports?: (...args: unknown[]) => Promise<readonly ExportInfo[]>;
  readonly getPackageJson?: (...args: unknown[]) => Promise<Record<string, unknown>>;
  readonly getTsConfig?: (...args: unknown[]) => Promise<Record<string, unknown>>;
  readonly getCustomConfig?: (...args: unknown[]) => Promise<unknown>;
  // git
  readonly stagedFiles?: (...args: unknown[]) => Promise<readonly string[]>;
  readonly diffFiles?: (...args: unknown[]) => Promise<readonly string[]>;
  readonly diffContent?: (...args: unknown[]) => Promise<string>;
  readonly currentBranch?: (...args: unknown[]) => Promise<string | null>;
  readonly isAncestor?: (...args: unknown[]) => Promise<boolean>;
}

/** Create mock providers with optional overrides for specific methods */
function createMockProviders(overrides: MockProviderOverrides = {}): RuleProviders {
  return {
    fs: {
      glob: (overrides.glob ?? (() => Promise.resolve([]))) as FileSystemProvider['glob'],
      readFile: (overrides.readFile ??
        (() => Promise.resolve(''))) as FileSystemProvider['readFile'],
      exists: (overrides.exists ?? (() => Promise.resolve(true))) as FileSystemProvider['exists'],
      readJson: (overrides.readJson ??
        (() => Promise.resolve({}))) as FileSystemProvider['readJson'],
    },
    graph: {
      getDependencies: (overrides.getDependencies ??
        (() => Promise.resolve([]))) as DependencyGraphProvider['getDependencies'],
      getDependents: (overrides.getDependents ??
        (() => Promise.resolve([]))) as DependencyGraphProvider['getDependents'],
      hasCircular: (overrides.hasCircular ??
        (() => Promise.resolve(false))) as DependencyGraphProvider['hasCircular'],
      getModuleGraph: (overrides.getModuleGraph ??
        (() => Promise.resolve({ nodes: new Map() }))) as DependencyGraphProvider['getModuleGraph'],
    },
    ast: {
      getSourceFile: (overrides.getSourceFile ??
        (() => Promise.resolve(null))) as ASTProvider['getSourceFile'],
      getImports: (overrides.getImports ??
        (() => Promise.resolve([]))) as ASTProvider['getImports'],
      getExports: (overrides.getExports ??
        (() => Promise.resolve([]))) as ASTProvider['getExports'],
    },
    config: {
      getPackageJson: (overrides.getPackageJson ??
        (() => Promise.resolve({}))) as ConfigFileProvider['getPackageJson'],
      getTsConfig: (overrides.getTsConfig ??
        (() => Promise.resolve({}))) as ConfigFileProvider['getTsConfig'],
      getCustomConfig: (overrides.getCustomConfig ??
        (() => Promise.resolve({}))) as ConfigFileProvider['getCustomConfig'],
    },
    git: {
      stagedFiles: (overrides.stagedFiles ??
        (() => Promise.resolve([]))) as GitProvider['stagedFiles'],
      diffFiles: (overrides.diffFiles ?? (() => Promise.resolve([]))) as GitProvider['diffFiles'],
      diffContent: (overrides.diffContent ??
        (() => Promise.resolve(''))) as GitProvider['diffContent'],
      currentBranch: (overrides.currentBranch ??
        (() => Promise.resolve('main'))) as GitProvider['currentBranch'],
      isAncestor: (overrides.isAncestor ??
        (() => Promise.resolve(false))) as GitProvider['isAncestor'],
    },
  };
}

/** Result of createTestContext — ctx + collected violations */
interface TestContextResult<TOptions = Record<string, unknown>> {
  /** Rule context to pass to rule.check() */
  readonly ctx: RuleContext<TOptions>;
  /** Array that collects violations reported by the rule */
  readonly violations: Violation[];
}

/** Create a test RuleContext that collects violations into a returned array */
function createTestContext<TOptions = Record<string, unknown>>(
  options: TOptions,
  providers: RuleProviders,
  ruleId = 'test',
): TestContextResult<TOptions> {
  const violations: Violation[] = [];
  const ctx: RuleContext<TOptions> = {
    rootDir: '/test',
    options,
    providers,
    report(partial) {
      violations.push({
        ruleId,
        message: partial.message,
        location: partial.location,
        severity: 'error',
        fix: partial.fix,
      });
    },
    meta() {},
  };
  return { ctx, violations };
}

export { createMockProviders, createTestContext };
export type { MockProviderOverrides, TestContextResult };
