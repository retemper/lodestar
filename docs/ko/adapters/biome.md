# adapter-biome

Biome을 CLI로 실행하고, `biome.json` 설정 파일을 생성합니다.

**패키지:** `@lodestar/adapter-biome`

**관리 파일:** `biome.json`

## 설정 옵션

| 옵션      | 타입                                | 설명                                                         |
| --------- | ---------------------------------- | ----------------------------------------------------------- |
| `rules`   | `Record<string, BiomeRuleSeverity>` | 규칙 오버라이드 -- 키는 `group/rule` (예: `"style/noNonNullAssertion"`) |
| `ignore`  | `string[]`                         | 무시할 글로브(Glob) 패턴                                       |
| `extends` | `string`                           | 확장할 기존 biome.json 경로                                    |
| `bin`     | `string`                           | 바이너리 이름 또는 경로 (기본값: `"biome"`)                      |

`BiomeRuleSeverity`는 `'error' | 'warn' | 'info' | 'off'`입니다.

## 예시

```ts
import { biomeAdapter } from '@lodestar/adapter-biome';

biomeAdapter({
  rules: {
    'style/noNonNullAssertion': 'error',
    'suspicious/noExplicitAny': 'warn',
  },
  ignore: ['dist/**', 'node_modules/**'],
  extends: './biome-base.json',
})
```

## 임시 설정 파일

`check` 실행 시, Biome 어댑터는 프로젝트의 `biome.json`을 직접 사용하지 않습니다. 대신:

1. lodestar 설정에서 파생된 임시 설정 파일(`.lodestar-biome-tmp.json`)을 작성합니다.
2. 임시 설정으로 `biome lint --reporter=json`을 실행합니다.
3. JSON 진단(Diagnostic) 결과를 lodestar `Violation` 객체로 파싱합니다.
4. 실행 완료 후 임시 파일을 정리합니다.

이 접근 방식은 기존 `biome.json`과의 충돌을 방지하고, 검사 시 lodestar 설정이 항상 단일 소스(Source of Truth)가 되도록 보장합니다.

## verifySetup 동작 방식

1. `rootDir`에 `biome.json`이 존재하는지 확인합니다.
2. 파일 내용을 읽고 lodestar가 생성할 설정과 비교합니다.
3. 파일이 없으면 **누락(Missing)** 위반을 반환합니다.
4. 내용이 일치하지 않으면 기대값 대 실제값의 diff와 함께 **드리프트(Drift)** 위반을 반환합니다.
5. `biome.json`이 일치하면 위반을 반환하지 않습니다.

`lodestar check --fix`를 실행하면 `biome.json`을 재생성하여 설정 위반을 해결합니다.
