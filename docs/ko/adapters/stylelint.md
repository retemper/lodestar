# adapter-stylelint

Stylelint를 CLI로 실행하고 JSON 출력을 파싱하여 CSS 린트(Lint) 위반을 탐지합니다. `.stylelintrc.json` 설정 파일도 생성합니다.

**패키지:** `@retemper/lodestar-adapter-stylelint`

**관리 파일:** `.stylelintrc.json`

## 설정 옵션

| 옵션      | 타입                      | 설명                                                          |
| --------- | ------------------------- | ------------------------------------------------------------- |
| `extends` | `string[]`                | 확장할 공유 설정 -- 예: `'stylelint-config-standard'`         |
| `rules`   | `Record<string, unknown>` | 커스텀 Stylelint 규칙                                         |
| `ignore`  | `string[]`                | 무시할 글로브(Glob) 패턴 (설정 파일에서 `ignoreFiles`로 매핑) |
| `include` | `string[]`                | 검사할 파일 패턴 (기본값: `**/*.css`)                         |
| `bin`     | `string`                  | 바이너리 이름 또는 경로 (기본값: `"stylelint"`)               |

모든 옵션은 선택 사항입니다. 인자 없이 `stylelintAdapter()`를 호출하면 Stylelint 기본값을 사용합니다.

## 예시

```ts
import { stylelintAdapter } from '@retemper/lodestar-adapter-stylelint';

stylelintAdapter({
  extends: ['stylelint-config-standard'],
  rules: {
    'color-no-invalid-hex': true,
    'declaration-block-no-duplicate-properties': true,
  },
  ignore: ['dist/**', 'node_modules/**'],
  include: ['src/**/*.css', 'src/**/*.scss'],
});
```

## verifySetup 동작 방식

1. `rootDir`에 `.stylelintrc.json`이 존재하는지 확인합니다.
2. 파일 내용을 읽고 lodestar 설정에서 생성된 JSON과 비교합니다.
3. 파일이 없으면 **누락(Missing)** 위반을 반환합니다.
4. 내용이 일치하지 않으면 기대값 대 실제값의 diff와 함께 **드리프트(Drift)** 위반을 반환합니다.
5. `.stylelintrc.json`이 일치하면 위반을 반환하지 않습니다.

`ignore` 설정 옵션은 생성된 `.stylelintrc.json`에서 `ignoreFiles` 키로 매핑됩니다.

드리프트는 `.stylelintrc.json` 파일이 수동으로 편집되었거나 다른 도구에 의해 덮어씌워져, lodestar 설정을 더 이상 반영하지 않음을 의미합니다. `lodestar check --fix`를 실행하면 파일을 재생성하여 위반을 해결합니다.

## check 동작 방식

어댑터는 설정된 파일 패턴으로 `stylelint --formatter json`을 실행하고 JSON 출력을 파싱합니다. 각 Stylelint 경고는 lodestar 위반으로 매핑됩니다.

위반 규칙 ID는 `stylelint/{rule-name}` 형식을 따르며, 심각도(Severity)는 Stylelint 출력에서 직접 매핑됩니다 (`error`는 `error`로 유지, 나머지는 `warn`).

위반 출력 예시:

```
error  stylelint/color-no-invalid-hex                   Unexpected invalid hex color "#abz" (color-no-invalid-hex)
warn   stylelint/declaration-block-no-duplicate-properties  Unexpected duplicate "color" (declaration-block-no-duplicate-properties)
```

## 자동 수정(Auto-fix)

이 어댑터는 `fix()`도 구현합니다. 설정된 파일 패턴에 대해 `stylelint --fix`를 실행합니다. `lodestar check --fix`를 실행하면 자동 수정 가능한 Stylelint 위반을 해결합니다.
