import { describe, it, expect, vi } from 'vitest';
import type { WorkspaceReporter, RunSummary, RuleResultSummary } from '@retemper/lodestar-types';
import { createCompositeReporter } from './composite-reporter';

/** 모든 메서드가 spy인 WorkspaceReporter 생성 */
function makeReporter(name: string): WorkspaceReporter {
  return {
    name,
    onStart: vi.fn(),
    onRuleStart: vi.fn(),
    onRuleComplete: vi.fn(),
    onViolation: vi.fn(),
    onComplete: vi.fn(),
    onPackageStart: vi.fn(),
    onPackageComplete: vi.fn(),
  };
}

/** 최소 RunSummary */
function makeSummary(): RunSummary {
  return {
    totalFiles: 0,
    totalRules: 0,
    violations: [],
    ruleResults: [],
    errorCount: 0,
    warnCount: 0,
    durationMs: 0,
  };
}

describe('createCompositeReporter', () => {
  it('name이 "composite"이다', () => {
    const composite = createCompositeReporter([]);
    expect(composite.name).toBe('composite');
  });

  it('onStart를 모든 delegate에 전달한다', () => {
    const a = makeReporter('a');
    const b = makeReporter('b');
    const composite = createCompositeReporter([a, b]);

    composite.onStart({ rootDir: '/root', ruleCount: 3 });

    expect(a.onStart).toHaveBeenCalledWith({ rootDir: '/root', ruleCount: 3 });
    expect(b.onStart).toHaveBeenCalledWith({ rootDir: '/root', ruleCount: 3 });
  });

  it('onRuleStart를 모든 delegate에 전달한다', () => {
    const a = makeReporter('a');
    const b = makeReporter('b');
    const composite = createCompositeReporter([a, b]);

    composite.onRuleStart!('test/rule');

    expect(a.onRuleStart).toHaveBeenCalledWith('test/rule');
    expect(b.onRuleStart).toHaveBeenCalledWith('test/rule');
  });

  it('onRuleComplete를 모든 delegate에 전달한다', () => {
    const a = makeReporter('a');
    const b = makeReporter('b');
    const composite = createCompositeReporter([a, b]);
    const result: RuleResultSummary = { ruleId: 'r', violations: [], durationMs: 1 };

    composite.onRuleComplete!(result);

    expect(a.onRuleComplete).toHaveBeenCalledWith(result);
    expect(b.onRuleComplete).toHaveBeenCalledWith(result);
  });

  it('onViolation을 모든 delegate에 전달한다', () => {
    const a = makeReporter('a');
    const b = makeReporter('b');
    const composite = createCompositeReporter([a, b]);
    const violation = { ruleId: 'r', message: 'msg', severity: 'error' as const };

    composite.onViolation(violation);

    expect(a.onViolation).toHaveBeenCalledWith(violation);
    expect(b.onViolation).toHaveBeenCalledWith(violation);
  });

  it('onComplete를 모든 delegate에 전달한다', () => {
    const a = makeReporter('a');
    const b = makeReporter('b');
    const composite = createCompositeReporter([a, b]);
    const summary = makeSummary();

    composite.onComplete(summary);

    expect(a.onComplete).toHaveBeenCalledWith(summary);
    expect(b.onComplete).toHaveBeenCalledWith(summary);
  });

  it('onPackageStart를 모든 delegate에 전달한다', () => {
    const a = makeReporter('a');
    const b = makeReporter('b');
    const composite = createCompositeReporter([a, b]);
    const pkg = { name: 'pkg-a', dir: '/root/packages/a' };

    composite.onPackageStart!(pkg);

    expect(a.onPackageStart).toHaveBeenCalledWith(pkg);
    expect(b.onPackageStart).toHaveBeenCalledWith(pkg);
  });

  it('onPackageComplete를 모든 delegate에 전달한다', () => {
    const a = makeReporter('a');
    const b = makeReporter('b');
    const composite = createCompositeReporter([a, b]);
    const pkg = { name: 'pkg-a', dir: '/root/packages/a' };
    const summary = makeSummary();

    composite.onPackageComplete!(pkg, summary);

    expect(a.onPackageComplete).toHaveBeenCalledWith(pkg, summary);
    expect(b.onPackageComplete).toHaveBeenCalledWith(pkg, summary);
  });

  it('optional 메서드가 없는 delegate도 에러 없이 처리한다', () => {
    const minimal: WorkspaceReporter = {
      name: 'minimal',
      onStart: vi.fn(),
      onViolation: vi.fn(),
      onComplete: vi.fn(),
    };
    const composite = createCompositeReporter([minimal]);

    expect(() => composite.onRuleStart!('test')).not.toThrow();
    expect(() =>
      composite.onRuleComplete!({ ruleId: 'r', violations: [], durationMs: 0 }),
    ).not.toThrow();
    expect(() => composite.onPackageStart!({ name: 'p', dir: '/d' })).not.toThrow();
    expect(() =>
      composite.onPackageComplete!({ name: 'p', dir: '/d' }, makeSummary()),
    ).not.toThrow();
  });

  it('delegate가 비어있으면 에러 없이 동작한다', () => {
    const composite = createCompositeReporter([]);

    expect(() => {
      composite.onStart({ rootDir: '/root', ruleCount: 0 });
      composite.onViolation({ ruleId: 'r', message: 'm', severity: 'error' });
      composite.onComplete(makeSummary());
    }).not.toThrow();
  });
});
