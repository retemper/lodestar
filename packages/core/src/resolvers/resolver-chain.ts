import type { ModuleResolver, ResolveContext } from '@retemper/lodestar-types';

/** Combine multiple resolvers — returns first non-null result */
function createResolverChain(resolvers: readonly ModuleResolver[]): ModuleResolver {
  return {
    resolve(ctx: ResolveContext): string | null {
      for (const resolver of resolvers) {
        const result = resolver.resolve(ctx);
        if (result !== null) return result;
      }
      return null;
    },
  };
}

export { createResolverChain };
