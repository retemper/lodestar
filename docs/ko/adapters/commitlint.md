# adapter-commitlint

커밋 메시지 린팅(Linting)을 위한 `.commitlintrc.json` 설정 파일을 생성합니다. 이 어댑터는 설정 전용(Setup-only) 어댑터로, commitlint는 husky에 의해 호출되며 lodestar가 직접 실행하지 않습니다.

**패키지:** `@lodestar/adapter-commitlint`

**관리 파일:** `.commitlintrc.json`

## 설정 옵션

| 옵션      | 타입                       | 설명                                                                          |
| --------- | -------------------------- | ---------------------------------------------------------------------------- |
| `extends` | `string[]`                 | 확장할 공유 설정 -- 예: `'@commitlint/config-conventional'`                      |
| `rules`   | `Record<string, unknown>`  | 커스텀 규칙 -- 예: `{"type-enum": [2, "always", ["feat", "fix", "chore"]]}` |

모든 옵션은 선택 사항입니다. 인자 없이 `commitlintAdapter()`를 호출하면 빈 설정이 생성됩니다.

## 예시

```ts
import { commitlintAdapter } from '@lodestar/adapter-commitlint';

commitlintAdapter({
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'chore', 'docs', 'refactor', 'test']],
    'subject-case': [2, 'always', 'lower-case'],
  },
})
```

## verifySetup 동작 방식

1. `rootDir`에 `.commitlintrc.json`이 존재하는지 확인합니다.
2. 파일 내용을 읽고 lodestar 설정에서 생성된 JSON과 비교합니다.
3. 파일이 없으면 **누락(Missing)** 위반을 반환합니다.
4. 내용이 일치하지 않으면 기대값 대 실제값의 diff와 함께 **드리프트(Drift)** 위반을 반환합니다.
5. `.commitlintrc.json`이 일치하면 위반을 반환하지 않습니다.

드리프트는 `.commitlintrc.json` 파일이 수동으로 편집되었거나 다른 도구에 의해 덮어씌워져, lodestar 설정을 더 이상 반영하지 않음을 의미합니다. `lodestar check --fix`를 실행하면 파일을 재생성하여 위반을 해결합니다.

> **참고:** 이 어댑터는 `check()`를 구현하지 않습니다. commitlint는 husky 깃 훅(Git Hook, 예: `commit-msg`)에 의해 트리거되며, `lodestar check`로는 실행되지 않습니다.
