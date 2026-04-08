# adapter-prettier

Prettier를 CLI(`prettier --check` / `prettier --write`)로 실행하고, `.prettierrc` 파일을 생성합니다.

**패키지:** `@retemper/lodestar-adapter-prettier`

**관리 파일:** `.prettierrc`

## 설정 옵션

| 옵션             | 타입                                     | 설명                                           |
| ---------------- | ---------------------------------------- | ---------------------------------------------- |
| `printWidth`     | `number`                                 | 줄 너비 (기본값: 80)                           |
| `tabWidth`       | `number`                                 | 들여쓰기 수준당 스페이스 수 (기본값: 2)        |
| `useTabs`        | `boolean`                                | 스페이스 대신 탭 사용                          |
| `semi`           | `boolean`                                | 세미콜론 사용                                  |
| `singleQuote`    | `boolean`                                | 작은따옴표 사용                                |
| `trailingComma`  | `'all'` \| `'es5'` \| `'none'`           | 후행 쉼표(Trailing Comma)                      |
| `bracketSpacing` | `boolean`                                | 객체 중괄호 내부 공백                          |
| `arrowParens`    | `'always'` \| `'avoid'`                  | 단일 인자 화살표 함수 괄호                     |
| `endOfLine`      | `'lf'` \| `'crlf'` \| `'cr'` \| `'auto'` | 줄 끝 스타일                                   |
| `ignore`         | `string[]`                               | 무시할 글로브(Glob) 패턴                       |
| `bin`            | `string`                                 | 바이너리 이름 또는 경로 (기본값: `"prettier"`) |
| `include`        | `string[]`                               | 검사할 파일 패턴                               |

## 예시

```ts
import { prettierAdapter } from '@retemper/lodestar-adapter-prettier';

prettierAdapter({
  singleQuote: true,
  trailingComma: 'all',
  semi: true,
  tabWidth: 2,
  printWidth: 100,
});
```

## verifySetup 동작 방식

1. `rootDir`에 `.prettierrc`가 존재하는지 확인합니다.
2. 파일 내용을 읽고 lodestar 설정에서 생성된 JSON과 비교합니다.
3. 파일이 없으면 **누락(Missing)** 위반을 반환합니다.
4. 내용이 일치하지 않으면 기대값 대 실제값의 diff와 함께 **드리프트(Drift)** 위반을 반환합니다.
5. `.prettierrc`가 일치하면 위반을 반환하지 않습니다.

드리프트는 `.prettierrc` 파일이 수동으로 편집되었거나 다른 도구에 의해 덮어씌워져, lodestar 설정을 더 이상 반영하지 않음을 의미합니다. `lodestar check --fix`를 실행하면 파일을 재생성하여 위반을 해결합니다.

## check 동작 방식

어댑터는 CLI를 통해 Prettier를 실행합니다:

1. 설정된 파일 패턴(또는 기본 파일 타입)으로 `prettier --check`를 실행합니다.
2. 출력을 파싱하여 올바르게 포맷되지 않은 파일을 식별합니다.
3. 포맷되지 않은 각 파일은 규칙 ID `prettier/format`으로 `Violation`을 보고합니다.

모든 포맷팅 위반은 심각도 `'warn'`으로 보고됩니다.

## 자동 수정

어댑터는 `fix()`를 구현하며, 설정된 파일 패턴에 대해 `prettier --write`를 실행합니다. `lodestar check --fix`를 실행하면 모든 파일을 자동 포맷합니다.
