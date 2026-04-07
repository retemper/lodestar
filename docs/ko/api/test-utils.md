# test-utils

Lodestar 규칙(Rule)을 위한 테스트 유틸리티입니다. 목(Mock) 프로바이더와 위반(Violation)을 수집하는 테스트 컨텍스트(Context)를 제공하여, 파일 시스템이나 실제 의존성 그래프에 접근하지 않고도 규칙을 단위 테스트할 수 있습니다.

```sh
pnpm add -D @retemper/lodestar-test-utils
```

## createMockProviders

스텁(Stub) 구현이 포함된 전체 `RuleProviders` 객체를 생성합니다. 모든 메서드는 합리적인 기본값(빈 배열, 빈 객체, `exists`는 `true`, `hasCircular`는 `false`)을 반환합니다. 오버라이드(Override)를 전달하여 특정 메서드를 교체할 수 있습니다.

```ts
function createMockProviders(overrides?: MockProviderOverrides): RuleProviders;
```

### MockProviderOverrides

모든 필드는 선택 사항입니다. 각 필드는 하나의 프로바이더 메서드를 오버라이드합니다:

| 필드              | 기본 반환값            | 프로바이더 | 설명                        |
| ----------------- | ---------------------- | ---------- | --------------------------- |
| `glob`            | `[]`                   | `fs`       | 패턴에 매칭되는 파일 찾기   |
| `readFile`        | `''`                   | `fs`       | 파일 내용 읽기              |
| `exists`          | `true`                 | `fs`       | 경로 존재 여부 확인         |
| `readJson`        | `{}`                   | `fs`       | JSON 파일 읽기 및 파싱      |
| `getDependencies` | `[]`                   | `graph`    | 파일이 임포트하는 파일 목록 |
| `getDependents`   | `[]`                   | `graph`    | 파일을 임포트하는 파일 목록 |
| `hasCircular`     | `false`                | `graph`    | 순환 의존성 여부 확인       |
| `getModuleGraph`  | `{ nodes: new Map() }` | `graph`    | 전체 모듈 그래프 조회       |
| `getSourceFile`   | `null`                 | `ast`      | AST 소스 파일 조회          |
| `getImports`      | `[]`                   | `ast`      | 파일의 import 선언 조회     |
| `getExports`      | `[]`                   | `ast`      | 파일의 export 선언 조회     |
| `getPackageJson`  | `{}`                   | `config`   | package.json 읽기           |
| `getTsConfig`     | `{}`                   | `config`   | tsconfig.json 읽기          |
| `getCustomConfig` | `{}`                   | `config`   | 커스텀 설정 파일 읽기       |

### 예시

```ts
import { vi } from 'vitest';
import { createMockProviders } from '@retemper/lodestar-test-utils';

const providers = createMockProviders({
  glob: vi.fn().mockImplementation((pattern: string) => {
    if (pattern === 'src/**/*.ts') {
      return Promise.resolve(['src/index.ts', 'src/utils.ts']);
    }
    return Promise.resolve([]);
  }),
  exists: vi.fn().mockResolvedValue(false),
});
```

## createTestContext

위반을 반환된 배열에 수집하는 `RuleContext`를 생성합니다. 컨텍스트와 위반 배열을 모두 반환하므로, `rule.check(ctx)` 호출 후 보고된 위반을 검사할 수 있습니다.

```ts
function createTestContext<TOptions = Record<string, unknown>>(
  options: TOptions,
  providers: RuleProviders,
  ruleId?: string,
): TestContextResult<TOptions>;
```

### 파라미터

| 파라미터    | 타입            | 기본값   | 설명                                    |
| ----------- | --------------- | -------- | --------------------------------------- |
| `options`   | `TOptions`      | --       | 규칙에 전달할 규칙 옵션                 |
| `providers` | `RuleProviders` | --       | 프로바이더 (`createMockProviders` 사용) |
| `ruleId`    | `string`        | `'test'` | 보고된 위반에 할당되는 규칙 ID          |

### TestContextResult

| 필드         | 타입                    | 설명                                      |
| ------------ | ----------------------- | ----------------------------------------- |
| `ctx`        | `RuleContext<TOptions>` | `rule.check()`에 전달할 컨텍스트          |
| `violations` | `Violation[]`           | 보고된 위반을 수집하는 가변(Mutable) 배열 |

반환된 `ctx`는 다음을 포함합니다:

- `rootDir`은 `'/test'`로 설정됨
- `report()`는 `violations`에 심각도(Severity) `'error'`로 푸시
- `meta()`는 no-op

### 예시

```ts
import { describe, it, expect, vi } from 'vitest';
import { createMockProviders, createTestContext } from '@retemper/lodestar-test-utils';
import { directoryExists } from '@retemper/lodestar-plugin-structure';

describe('structure/directory-exists', () => {
  it('필수 경로가 누락되면 위반을 보고한다', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue([]),
    });
    const { ctx, violations } = createTestContext(
      { required: ['src/missing'] },
      providers,
      'structure/directory-exists',
    );

    await directoryExists.check(ctx);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('src/missing');
    expect(violations[0].message).toContain('does not exist');
  });

  it('필수 경로가 존재하면 통과한다', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src']),
    });
    const { ctx, violations } = createTestContext(
      { required: ['src'] },
      providers,
      'structure/directory-exists',
    );

    await directoryExists.check(ctx);

    expect(violations).toHaveLength(0);
  });
});
```

## 전체 테스트 패턴

커스텀 규칙의 전체 테스트 예시:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createMockProviders, createTestContext } from '@retemper/lodestar-test-utils';
import { myCustomRule } from './my-custom-rule';

describe('my-plugin/my-custom-rule', () => {
  it('모든 조건이 충족되면 위반이 없다', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/index.ts']),
      exists: vi.fn().mockResolvedValue(true),
    });
    const { ctx, violations } = createTestContext(
      {
        /* 규칙 옵션 */
      },
      providers,
      'my-plugin/my-custom-rule',
    );

    await myCustomRule.check(ctx);

    expect(violations).toHaveLength(0);
  });

  it('위반 메타데이터를 캡처한다', async () => {
    const providers = createMockProviders({
      glob: vi.fn().mockResolvedValue(['src/bad-file.ts']),
    });
    const { ctx, violations } = createTestContext(
      {
        /* 규칙 옵션 */
      },
      providers,
    );

    await myCustomRule.check(ctx);

    expect(violations[0]).toStrictEqual(
      expect.objectContaining({
        ruleId: expect.any(String),
        message: expect.any(String),
        severity: 'error',
      }),
    );
  });
});
```
