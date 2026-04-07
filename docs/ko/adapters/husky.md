# adapter-husky

Husky를 통해 Git 훅(Hook)을 관리합니다. 다른 어댑터와 달리 `check`이나 `fix` 메서드는 없고, `verifySetup`과 `setup`만 제공합니다.

**패키지:** `@retemper/lodestar-adapter-husky`

**관리 파일:** `.husky/<hook-name>` (예: `.husky/pre-commit`)

## 설정 옵션

| 옵션    | 타입                                         | 설명                          |
| ------- | -------------------------------------------- | ----------------------------- |
| `hooks` | `Record<string, HookDefinition \| string[]>` | 설정할 Git 훅 -- 키는 훅 이름 |

`HookDefinition`은 `commands` 배열을 가집니다. 문자열 배열을 직접 전달하는 축약형도 지원합니다.

## 예시

```ts
import { huskyAdapter } from '@retemper/lodestar-adapter-husky';

huskyAdapter({
  hooks: {
    'pre-commit': ['npx lodestar check'],
    'commit-msg': {
      commands: ['npx commitlint --edit "$1"'],
    },
  },
});
```

각 훅은 `.husky/` 안에 실행 가능한 셸 스크립트를 생성합니다:

```sh
#!/usr/bin/env sh

npx lodestar check
```

## verifySetup 동작 방식

1. 설정에 정의된 각 훅에 대해, `rootDir`에 `.husky/<hook-name>`이 존재하는지 확인합니다.
2. 파일 내용을 읽고 기대하는 셸 스크립트와 비교합니다.
3. 훅 파일이 없으면 **누락(Missing)** 위반을 반환합니다.
4. 훅 파일 내용이 기대하는 명령어와 일치하지 않으면 **드리프트(Drift)** 위반을 반환합니다.
5. 모든 훅 파일이 정확하면 위반을 반환하지 않습니다.

`lodestar init` 또는 `lodestar check --fix`를 실행하면 lodestar 설정에 맞게 훅 스크립트를 생성하거나 업데이트합니다.
