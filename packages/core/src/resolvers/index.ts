import type { ModuleResolver } from '@retemper/lodestar-types';
import { createNodeModulesResolver } from './node-modules';
import { createRelativeResolver } from './relative';
import { createResolverChain } from './resolver-chain';
import { createTsconfigPathsResolver } from './tsconfig-paths';

/** Options for building the default resolver chain */
interface DefaultResolverOptions {
  /** Absolute path to the project root */
  readonly rootDir: string;
  /** Additional user-provided resolvers (inserted before built-in resolvers) */
  readonly customResolvers?: readonly ModuleResolver[];
  /** Absolute path to tsconfig.json (auto-detected if omitted) */
  readonly tsconfigPath?: string;
  /** Include node_modules resolution for bare specifiers (default: false) */
  readonly nodeModules?: boolean;
}

/**
 * Build the default resolver chain: custom resolvers -> tsconfig paths -> relative -> (node_modules).
 * Returns both the chain and a setup function that must be called before use.
 */
function createDefaultResolverChain(options: DefaultResolverOptions): {
  readonly resolver: ModuleResolver;
  readonly setup: () => Promise<void>;
} {
  const tsconfigResolver = createTsconfigPathsResolver(options.rootDir, {
    tsconfigPath: options.tsconfigPath,
  });

  const resolvers: ModuleResolver[] = [
    ...(options.customResolvers ?? []),
    tsconfigResolver,
    createRelativeResolver(),
  ];

  if (options.nodeModules) {
    resolvers.push(createNodeModulesResolver(options.rootDir));
  }

  const resolver = createResolverChain(resolvers);

  const setup = async () => {
    await (tsconfigResolver as unknown as { loadPaths: () => Promise<unknown> }).loadPaths();
  };

  return { resolver, setup };
}

export {
  createDefaultResolverChain,
  createNodeModulesResolver,
  createRelativeResolver,
  createResolverChain,
  createTsconfigPathsResolver,
};
export type { DefaultResolverOptions };
export type { TsconfigPathsResolverOptions } from './tsconfig-paths';
