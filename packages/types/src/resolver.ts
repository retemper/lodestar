/** Context needed to resolve a module import */
interface ResolveContext {
  /** File containing the import statement (root-relative path) */
  readonly importer: string;
  /** The import specifier string (e.g., './utils', '@app/auth') */
  readonly source: string;
  /** Set of all known project file paths for existence checks */
  readonly knownFiles: ReadonlySet<string>;
}

/** Resolves a module specifier to an actual file path */
interface ModuleResolver {
  /** Resolve an import source to a root-relative file path, or null if unresolvable */
  resolve(ctx: ResolveContext): string | null;
}

export type { ModuleResolver, ResolveContext };
