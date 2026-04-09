# 프로바이더(Providers)

프로바이더(Provider)는 규칙(Rule)에게 프로젝트 데이터에 대한 읽기 전용 접근을 제공합니다. `needs` 배열을 통해 규칙이 필요한 프로바이더를 선언합니다.

## FileSystemProvider

```ts
needs: ['fs'];
```

```ts
interface FileSystemProvider {
  glob(pattern: string): Promise<readonly string[]>;
  readFile(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
  readJson<T>(path: string): Promise<T>;
}
```

## DependencyGraphProvider

```ts
needs: ['graph'];
```

```ts
interface DependencyGraphProvider {
  getDependencies(file: string): Promise<readonly string[]>;
  getDependents(file: string): Promise<readonly string[]>;
  hasCircular(entry: string): Promise<boolean>;
  getModuleGraph(): Promise<ModuleGraph>;
}
```

## ASTProvider

```ts
needs: ['ast'];
```

```ts
interface ASTProvider {
  getSourceFile(path: string): Promise<unknown>;
  getImports(path: string): Promise<readonly ImportInfo[]>;
  getExports(path: string): Promise<readonly ExportInfo[]>;
}
```

## ConfigFileProvider

```ts
needs: ['config'];
```

```ts
interface ConfigFileProvider {
  getPackageJson(dir?: string): Promise<Record<string, unknown>>;
  getTsConfig(dir?: string): Promise<Record<string, unknown>>;
  getCustomConfig<T>(filename: string, dir?: string): Promise<T>;
}
```

---

## 모듈 해석(Module Resolution)

Lodestar는 플러그 가능한 리졸버 체인(Resolver Chain)을 사용하여 import 지정자를 파일 경로로 변환합니다. 기본 체인은 다음 순서로 해석합니다:

1. **커스텀 리졸버** (사용자 제공, 있는 경우)
2. **tsconfig paths** (`tsconfig.json`의 `@app/*` → `src/*` 매핑)
3. **상대 경로 임포트** (`./utils`, `../shared`)
4. **node_modules** (`lodash` 같은 bare specifier, 옵트인)

### `ModuleResolver` 인터페이스

```ts
interface ResolveContext {
  readonly importer: string; // import를 포함하는 파일
  readonly source: string; // import 지정자
  readonly knownFiles: ReadonlySet<string>;
}

interface ModuleResolver {
  resolve(ctx: ResolveContext): string | null;
}
```

### 내장 리졸버(Built-in Resolvers)

| 리졸버         | 팩토리                                           | 설명                                                         |
| -------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| 상대 경로      | `createRelativeResolver()`                       | 프로젝트 파일 기준으로 `./` 및 `../` 임포트를 해석           |
| tsconfig paths | `createTsconfigPathsResolver(rootDir, options?)` | `tsconfig.json`의 `compilerOptions.paths`에서 경로 별칭 매핑 |
| node_modules   | `createNodeModulesResolver(rootDir)`             | bare specifier (예: `lodash`)를 `node_modules`를 통해 해석   |
| 체인           | `createResolverChain(resolvers)`                 | 각 리졸버를 순서대로 시도하고 첫 번째 매치를 반환            |

### `createDefaultResolverChain(options)`

기본 설정으로 전체 리졸버 체인을 구성합니다:

```ts
import { createDefaultResolverChain } from '@retemper/lodestar-core';

const { resolver, setup } = createDefaultResolverChain({
  rootDir: '/project',
  nodeModules: true, // node_modules 해석 포함
  tsconfigPath: 'tsconfig.json', // 생략 시 자동 감지
});

await setup(); // tsconfig paths 로드
```

| 옵션              | 타입               | 기본값    | 설명                                  |
| ----------------- | ------------------ | --------- | ------------------------------------- |
| `rootDir`         | `string`           | **필수**  | 프로젝트 루트의 절대 경로             |
| `customResolvers` | `ModuleResolver[]` | `[]`      | 추가 리졸버 (체인 맨 앞에 삽입)       |
| `tsconfigPath`    | `string`           | 자동 감지 | tsconfig.json 경로                    |
| `nodeModules`     | `boolean`          | `false`   | node_modules bare specifier 해석 포함 |
