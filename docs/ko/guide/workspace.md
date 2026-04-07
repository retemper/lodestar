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
