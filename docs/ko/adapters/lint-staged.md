---
description: 'adapter-lint-staged — lodestar.config.ts에서 lint-staged 설정을 생성.'
---

# adapter-lint-staged

글로브(Glob) 패턴을 명령어에 매핑하는 `.lintstagedrc.json` 설정 파일을 생성합니다. 이 어댑터는 설정 전용(Setup-only) 어댑터로, lint-staged는 husky에 의해 호출되며 lodestar가 직접 실행하지 않습니다.

**패키지:** `@retemper/lodestar-adapter-lint-staged`

**관리 파일:** `.lintstagedrc.json`

## 설정 옵션

| 옵션       | 타입                                          | 설명                                                        |
| ---------- | --------------------------------------------- | ----------------------------------------------------------- |
| `commands` | `Record<string, string \| readonly string[]>` | 글로브 패턴과 명령어 매핑 -- 예: `{"*.ts": "eslint --fix"}` |

## 예시

```ts
import { lintStagedAdapter } from '@retemper/lodestar-adapter-lint-staged';

lintStagedAdapter({
  commands: {
    '*.{ts,tsx}': 'eslint --fix',
    '*.{css,scss}': 'stylelint --fix',
    '*.{ts,tsx,css,scss,json,md}': 'prettier --write',
  },
});
```

## verifySetup 동작 방식

1. `rootDir`에 `.lintstagedrc.json`이 존재하는지 확인합니다.
2. 파일 내용을 읽고 `commands` 매핑에서 lodestar 설정이 생성한 JSON과 비교합니다.
3. 파일이 없으면 **누락(Missing)** 위반을 반환합니다.
4. 내용이 일치하지 않으면 기대값 대 실제값의 diff와 함께 **드리프트(Drift)** 위반을 반환합니다.
5. `.lintstagedrc.json`이 일치하면 위반을 반환하지 않습니다.

드리프트는 `.lintstagedrc.json` 파일이 수동으로 편집되었거나 다른 도구에 의해 덮어씌워져, lodestar 설정을 더 이상 반영하지 않음을 의미합니다. `lodestar check --fix`를 실행하면 파일을 재생성하여 위반을 해결합니다.

> **참고:** 이 어댑터는 `check()`를 구현하지 않습니다. lint-staged는 husky 깃 훅(Git Hook)에 의해 트리거되며, `lodestar check`로는 실행되지 않습니다.
