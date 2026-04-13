import { describe, it, expect } from 'vitest';
import type { ModuleResolver, ResolveContext } from '@retemper/lodestar-types';
import { createResolverChain } from './resolver-chain';

/** Helper to create a simple mock resolver */
function mockResolver(result: string | null): ModuleResolver {
  return { resolve: () => result };
}

const ctx: ResolveContext = {
  importer: 'src/a.ts',
  source: '@app/utils',
  knownFiles: new Set(['src/utils.ts']),
};

describe('createResolverChain', () => {
  it('returns first non-null result', () => {
    const chain = createResolverChain([
      mockResolver(null),
      mockResolver('src/utils.ts'),
      mockResolver('src/other.ts'),
    ]);

    expect(chain.resolve(ctx)).toBe('src/utils.ts');
  });

  it('returns null when all resolvers return null', () => {
    const chain = createResolverChain([mockResolver(null), mockResolver(null)]);

    expect(chain.resolve(ctx)).toBeNull();
  });

  it('returns null for empty chain', () => {
    const chain = createResolverChain([]);

    expect(chain.resolve(ctx)).toBeNull();
  });

  it('does not call remaining resolvers when first one resolves', () => {
    const calls: string[] = [];
    const r1: ModuleResolver = {
      resolve() {
        calls.push('r1');
        return 'result';
      },
    };
    const r2: ModuleResolver = {
      resolve() {
        calls.push('r2');
        return null;
      },
    };

    const chain = createResolverChain([r1, r2]);
    chain.resolve(ctx);

    expect(calls).toStrictEqual(['r1']);
  });
});
