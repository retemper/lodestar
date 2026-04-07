# plugin-structure

파일 시스템 구조 규칙을 강제합니다 -- 디렉토리 존재 여부, 금지 경로, 페어 파일(Paired File) 검증.

```sh
pnpm add -D @retemper/lodestar-plugin-structure
```

```ts
import { pluginStructure } from '@retemper/lodestar-plugin-structure';

export default defineConfig({
  plugins: [pluginStructure],
  rules: { ... },
});
```

## 규칙(Rules)

### `structure/directory-exists`

필수 디렉토리나 파일이 존재하는지 검증합니다. 각 항목은 글로브(Glob) 패턴이며, 최소 하나의 매칭이 있어야 합니다.

```ts
'structure/directory-exists': {
  severity: 'error',
  options: {
    required: ['src', 'tests', 'docs'],
  },
}
```

**옵션:**

| 옵션       | 타입       | 설명                                               |
| ---------- | ---------- | -------------------------------------------------- |
| `required` | `string[]` | 프로젝트에 반드시 존재해야 하는 경로의 글로브 패턴 |

**프로바이더(Providers):** `fs`

**동작:**

- `required`의 각 항목은 글로브 패턴으로 처리됩니다
- 패턴에 매칭되는 파일이 없으면 위반(Violation)이 보고됩니다
- 글로브가 아닌 리터럴 경로(`*` 없음)의 경우, 자동 수정(Auto-fix)이 누락된 디렉토리를 생성합니다
- 글로브 패턴은 의도하는 경로가 모호하므로 자동 수정을 제공하지 않습니다

**글로브 사용 예시:**

```ts
'structure/directory-exists': {
  severity: 'error',
  options: {
    required: [
      'src',
      'src/**/*.ts',     // 최소 하나의 .ts 파일이 존재해야 함
      'package.json',
    ],
  },
}
```

---

### `structure/no-forbidden-path`

금지된 경로가 존재하지 않는지 검증합니다. 각 항목은 글로브 패턴이며, 매칭되면 위반입니다.

```ts
'structure/no-forbidden-path': {
  severity: 'error',
  options: {
    patterns: ['src/**/*.js', 'lib/**', '.env'],
  },
}
```

**옵션:**

| 옵션       | 타입       | 설명                                             |
| ---------- | ---------- | ------------------------------------------------ |
| `patterns` | `string[]` | 프로젝트에 존재해서는 안 되는 경로의 글로브 패턴 |

**프로바이더(Providers):** `fs`

**동작:**

- 각 패턴은 프로젝트에 대해 글로브로 평가됩니다
- 매칭되는 모든 파일이 각각 별도의 위반으로 보고되며, 매칭된 파일 경로가 포함됩니다
- 소스 디렉토리의 컴파일 출력 금지, 커밋된 시크릿 방지, 레거시 경로 마이그레이션 강제에 유용합니다

**예시 -- 레거시 디렉토리 금지:**

```ts
'structure/no-forbidden-path': {
  severity: 'error',
  options: {
    patterns: [
      'src/**/*.js',       // src에 JS 파일 금지
      'src/**/*.jsx',      // src에 JSX 파일 금지
      '.env',              // 커밋된 .env 금지
      'dist/**',           // dist는 gitignore되어야 함
    ],
  },
}
```

---

### `structure/paired-files`

글로브에 매칭되는 소스 파일에 필수 동반 파일(Companion File)이 있는지 검증합니다. `required` 템플릿에 `{dir}`과 `{name}` 플레이스홀더(Placeholder)를 사용하여 각 소스 파일로부터 동반 파일 경로를 구성합니다.

```ts
'structure/paired-files': {
  severity: 'error',
  options: {
    pairs: [
      {
        source: 'src/**/*.ts',
        required: '{dir}/{name}.spec.ts',
      },
    ],
  },
}
```

**옵션:**

| 옵션    | 타입         | 설명                                            |
| ------- | ------------ | ----------------------------------------------- |
| `pairs` | `FilePair[]` | 소스 파일과 필수 동반 파일을 연결하는 페어 정의 |

각 `FilePair`의 필드:

| 필드       | 타입     | 필수 | 설명                                                 |
| ---------- | -------- | ---- | ---------------------------------------------------- |
| `source`   | `string` | Yes  | 소스 파일에 매칭되는 글로브 패턴                     |
| `required` | `string` | Yes  | `{dir}`과 `{name}` 플레이스홀더가 포함된 템플릿 경로 |
| `message`  | `string` | No   | 페어 파일 누락 시 커스텀 메시지                      |

**프로바이더(Providers):** `fs`

**플레이스홀더(Placeholder):**

- `{dir}` -- 소스 파일의 디렉토리
- `{name}` -- 확장자를 제외한 파일명

소스 파일이 `src/utils/parser.ts`인 경우:

- `{dir}` = `src/utils`
- `{name}` = `parser`
- 템플릿 `{dir}/{name}.spec.ts`는 `src/utils/parser.spec.ts`로 해석됩니다

**동작:**

- `source` 글로브에 매칭되는 각 소스 파일에 대해, 템플릿으로부터 필수 동반 파일 경로가 계산됩니다
- 동반 파일이 존재하지 않으면 위반이 보고됩니다
- 자동 수정은 예상 경로에 빈 파일을 생성합니다

**예시 -- 테스트와 스토리 파일 필수화:**

```ts
'structure/paired-files': {
  severity: 'warn',
  options: {
    pairs: [
      {
        source: 'src/**/*.ts',
        required: '{dir}/{name}.spec.ts',
        message: '모든 모듈에는 테스트 파일이 필요합니다',
      },
      {
        source: 'src/components/**/*.tsx',
        required: '{dir}/{name}.stories.tsx',
        message: '모든 컴포넌트에는 Storybook 스토리가 필요합니다',
      },
    ],
  },
}
```
