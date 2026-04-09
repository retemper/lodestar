# 워크스페이스 모드(Workspace Mode)

Lodestar는 모노레포 워크스페이스 모드를 지원합니다. 각 패키지는 독립적인 자체 `lodestar.config.ts`를 가질 수 있습니다.

## 작동 방식

1. **루트 설정**은 모노레포 루트에 대해 실행됩니다 (예: "모든 패키지에 `src/`가 있어야 함")
2. **패키지별 설정**은 자동으로 탐색되어 각 패키지 범위에서 실행됩니다
3. 패키지 설정은 **독립적으로** 실행됩니다 — 루트 설정을 암묵적으로 상속하지 않습니다

## 구성

### 루트 설정

```ts
// lodestar.config.ts (monorepo root)
export default defineConfig({
  plugins: ['@retemper/lodestar-plugin-structure', '@retemper/lodestar-plugin-deps'],
  rules: {
    'structure/directory-exists': {
      severity: 'error',
      options: { required: ['packages/*/src'] },
    },
    'deps/no-circular': 'error',
  },
});
```

### 패키지별 설정

```ts
// packages/core/lodestar.config.mjs
export default {
  plugins: ['@retemper/lodestar-plugin-structure'],
  rules: {
    'structure/directory-exists': {
      severity: 'error',
      options: { required: ['src/providers'] },
    },
  },
};
```

각 패키지 설정은 독립적입니다 — 해당 설정에 정의된 규칙만 적용됩니다.

## 실행

```sh
# pnpm-workspace.yaml이 있으면 워크스페이스 모드를 자동 감지
npx lodestar check

# 명시적 플래그
npx lodestar check --workspace
npx lodestar check --no-workspace
```

## 패키지 탐색

Lodestar는 다음에서 워크스페이스 패턴을 읽습니다:

- `pnpm-workspace.yaml` (`packages:` 필드)
- `package.json` (`workspaces` 필드)

자체 `lodestar.config.ts` / `.mjs` / `.js`가 있는 패키지만 워크스페이스 모드에서 검사됩니다. 설정이 없는 패키지는 건너뜁니다.

## 병렬 실행(Parallel Execution)

워크스페이스 모드에서 패키지는 병렬로 검사됩니다. 기본 동시 실행 수는 4개입니다:

```sh
# 기본값: 4개 패키지 병렬 실행
npx lodestar check

# 병렬 처리 수 증가
npx lodestar check --concurrency 8

# 순차 실행
npx lodestar check --concurrency 1
```

리포터 출력은 어떤 패키지가 먼저 완료되더라도 패키지 순서를 유지합니다. 결과는 버퍼에 저장되었다가 순차적으로 출력되므로 결정적(deterministic)이고 읽기 쉽습니다.
