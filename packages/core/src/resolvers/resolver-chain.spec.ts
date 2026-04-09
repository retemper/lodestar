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
  it('첫 번째 non-null 결과를 반환한다', () => {
    const chain = createResolverChain([
      mockResolver(null),
      mockResolver('src/utils.ts'),
      mockResolver('src/other.ts'),
    ]);

    expect(chain.resolve(ctx)).toBe('src/utils.ts');
  });

  it('모든 resolver가 null이면 null을 반환한다', () => {
    const chain = createResolverChain([mockResolver(null), mockResolver(null)]);

    expect(chain.resolve(ctx)).toBeNull();
  });

  it('빈 체인은 null을 반환한다', () => {
    const chain = createResolverChain([]);

    expect(chain.resolve(ctx)).toBeNull();
  });

  it('첫 번째 resolver가 해석하면 나머지를 호출하지 않는다', () => {
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
