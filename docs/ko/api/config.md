# 설정 파일 레퍼런스

## `defineConfig(config)`

`lodestar.config.ts`를 생성하기 위한 타입 안전한 헬퍼입니다. 단일 설정 블록 또는 블록 배열(플랫 설정)을 받습니다.

```ts
import { defineConfig } from 'lodestar';

export default defineConfig({
  plugins: [...],
  rules: { ... },
  adapters: [...],
});
```

## `WrittenConfig`

설정은 단일 `WrittenConfigBlock` 또는 블록 배열일 수 있습니다. 배열 형태(플랫 설정, Flat Config)는 각 블록의 `files` 필드를 통해 파일 범위 규칙을 가능하게 합니다.

```ts
type WrittenConfig = WrittenConfigBlock | readonly WrittenConfigBlock[];
```

## `WrittenConfigBlock`

각 블록은 플랫 설정(Flat Config)의 단위입니다:

```ts
interface WrittenConfigBlock {
  /** 이 블록이 적용되는 파일의 glob 패턴 -- 전역 적용 시 생략 */
  readonly files?: readonly string[];
  /** 이 블록에서 제외할 파일의 glob 패턴 */
  readonly ignores?: readonly string[];
  /** 규칙을 제공하는 플러그인 */
  readonly plugins?: readonly PluginEntry[];
  /** 규칙 설정 -- severity 축약형 또는 전체 설정 */
  readonly rules?: Readonly<Record<string, Severity | WrittenRuleConfig>>;
  /** 외부 도구 어댑터 */
  readonly adapters?: readonly ToolAdapter[];
}
```

## `WrittenRuleConfig`

```ts
interface WrittenRuleConfig {
  readonly severity: 'error' | 'warn' | 'off';
  readonly options?: Readonly<Record<string, unknown>>;
}
```

규칙은 severity 축약형 문자열 또는 전체 객체 형태로 설정할 수 있습니다:

```ts
rules: {
  // 축약형 -- severity만 지정
  'architecture/no-circular': 'error',

  // 전체 형태 -- severity와 옵션
  'architecture/layers': {
    severity: 'error',
    options: {
      layers: [
        { name: 'domain', path: 'src/domain/**' },
        { name: 'application', path: 'src/application/**', canImport: ['domain'] },
      ],
    },
  },
}
```

## `PluginEntry`

플러그인(Plugin)은 여러 방식으로 참조할 수 있습니다:

```ts
type PluginEntry =
  | PluginFactory // 팩토리 함수 (권장)
  | Plugin // 직접 플러그인 객체
  | [PluginFactory, options] // 옵션이 있는 팩토리
  | [string, options] // 문자열 이름과 옵션 (레거시)
  | string; // 문자열 이름 (레거시)
```

예시:

```ts
import { pluginArchitecture } from '@lodestar/plugin-architecture';

export default defineConfig({
  plugins: [pluginArchitecture],
  // ...
});
```

## 어댑터 (Adapters)

`adapters` 필드는 외부 도구 어댑터(린터, 포매터, git hooks)를 설정 블록에 연결합니다. 각 어댑터는 `ToolAdapter` 인터페이스를 구현합니다:

```ts
interface ToolAdapter<TConfig = unknown> {
  readonly name: string;
  readonly config: TConfig;
  check?(rootDir: string, include: readonly string[]): Promise<readonly Violation[]>;
  fix?(rootDir: string, include: readonly string[]): Promise<void>;
  generateConfig?(): Promise<unknown[]>;
  verifySetup?(rootDir: string): Promise<readonly Violation[]>;
  setup?(rootDir: string): Promise<void>;
}
```

세 가지 공식 어댑터를 모두 사용하는 예시:

```ts
import { defineConfig } from 'lodestar';
import { pluginArchitecture } from '@lodestar/plugin-architecture';
import { eslintAdapter } from '@lodestar/adapter-eslint';
import { prettierAdapter } from '@lodestar/adapter-prettier';
import { huskyAdapter } from '@lodestar/adapter-husky';

export default defineConfig({
  plugins: [pluginArchitecture],
  rules: {
    'architecture/no-circular': 'error',
  },
  adapters: [
    eslintAdapter({
      presets: ['strict'],
      rules: {
        '@typescript-eslint/consistent-type-imports': 'error',
      },
    }),
    prettierAdapter({
      singleQuote: true,
      trailingComma: 'all',
      semi: true,
    }),
    huskyAdapter({
      hooks: {
        'pre-commit': ['npx lodestar check'],
      },
    }),
  ],
});
```

어댑터는 설정 해석(Config Resolution) 중 `name`으로 중복 제거됩니다 -- 여러 블록이 같은 어댑터를 선언하면 마지막 것이 적용됩니다.

## 플랫 설정 (Flat Config, 다중 블록)

배열 형태는 서로 다른 파일 집합에 대해 다른 규칙이나 어댑터를 허용합니다. `files`가 없는 블록은 전역으로 적용되고, `files`가 있는 블록은 일치하는 경로에만 적용됩니다:

```ts
import { defineConfig } from 'lodestar';
import { pluginArchitecture } from '@lodestar/plugin-architecture';

export default defineConfig([
  // 전역 블록 -- 모든 파일에 적용
  {
    plugins: [pluginArchitecture],
    rules: {
      'architecture/no-circular': 'error',
    },
  },

  // 범위 지정 블록 -- 일치하는 파일에만 적용
  {
    files: ['src/domain/**'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'architecture/layers': {
        severity: 'error',
        options: {
          layers: [
            { name: 'domain', path: 'src/domain/**' },
            { name: 'application', path: 'src/application/**', canImport: ['domain'] },
          ],
        },
      },
    },
  },
]);
```

## 워크스페이스 설정 상속 (Workspace Config Inheritance)

모노레포에서 루트 `lodestar.config.ts`가 먼저 로드됩니다. 워크스페이스 모드(`lodestar check --workspace`)로 실행하면, lodestar는 `pnpm-workspace.yaml` 또는 `package.json`의 workspaces를 통해 패키지를 발견하고 각 패키지에 대해 규칙을 실행합니다.

각 패키지는 루트 설정을 오버라이드하거나 확장하는 자체 `lodestar.config.ts`를 가질 수 있습니다. 패키지에 자체 설정이 없으면 루트 설정이 패키지 디렉토리를 해석 기준으로 사용됩니다.

워크스페이스 모드에서의 설정 해석 과정:

1. 모노레포 루트에서 루트 설정 로드
2. 워크스페이스 glob을 통해 패키지 발견
3. 각 패키지에 대해 로컬 `lodestar.config.ts` 확인
4. 발견되면 패키지 디렉토리 기준으로 로컬 설정 해석
5. 발견되지 않으면 패키지 디렉토리 기준으로 루트 설정 해석
