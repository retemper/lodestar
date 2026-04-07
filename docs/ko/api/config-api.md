# @retemper/config

설정 로딩, 정규화 및 병합을 담당합니다.

```ts
import { loadConfigFile, resolveConfig, mergeConfigs } from '@retemper/config';
```

## `loadConfigFile(dir)`

주어진 디렉토리에서 lodestar 설정 파일을 로드합니다. `lodestar.config.ts`, `.mjs`, `.js` 순서로 검색합니다.

```ts
const config = await loadConfigFile('/path/to/project');
// config: WrittenConfig | null
```

## `resolveConfig(written, rootDir)`

`WrittenConfig`를 완전히 해석된(resolved) `ResolvedConfig`로 정규화합니다:

```ts
const resolved = resolveConfig(writtenConfig, '/path/to/project');
```

- 단축 규칙 설정을 확장합니다 (`'error'` → `{ severity: 'error', options: {} }`)
- 플러그인 항목을 정규화합니다
- `include`, `exclude`, `baseline`에 기본값을 적용합니다

## `mergeConfigs(base, override)`

두 설정을 병합합니다. `override`의 규칙이 우선합니다. 플러그인은 누적됩니다.

```ts
const merged = mergeConfigs(rootConfig, packageConfig);
```

## `discoverWorkspaces(rootDir)`

`pnpm-workspace.yaml` 또는 `package.json`의 workspaces 필드에서 워크스페이스 패키지를 검색합니다.

```ts
const packages = await discoverWorkspaces('/monorepo/root');
// [{ name: '@scope/pkg', dir: '/monorepo/root/packages/pkg' }, ...]
```
