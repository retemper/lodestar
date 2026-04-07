# adapter-knip

Knip을 CLI로 실행하고 JSON 출력을 파싱하여 사용되지 않는 파일, 의존성, 내보내기(Export)를 탐지합니다. `knip.json` 설정 파일도 생성합니다.

**패키지:** `@lodestar/adapter-knip`

**관리 파일:** `knip.json`

## 설정 옵션

| 옵션                 | 타입       | 설명                                       |
| -------------------- | ---------- | ------------------------------------------ |
| `entry`              | `string[]` | 진입점(Entry) 파일 패턴                    |
| `project`            | `string[]` | 프로젝트 파일 패턴                         |
| `ignore`             | `string[]` | 무시할 글로브(Glob) 패턴                   |
| `ignoreDependencies` | `string[]` | 무시할 의존성(Dependency) 이름             |
| `bin`                | `string`   | 바이너리 이름 또는 경로 (기본값: `"knip"`) |

모든 옵션은 선택 사항입니다. 인자 없이 `knipAdapter()`를 호출하면 Knip 기본값을 사용합니다.

## 예시

```ts
import { knipAdapter } from '@lodestar/adapter-knip';

knipAdapter({
  entry: ['src/index.ts'],
  project: ['src/**/*.ts'],
  ignore: ['src/generated/**'],
  ignoreDependencies: ['@types/node'],
});
```

## verifySetup 동작 방식

1. `rootDir`에 `knip.json`이 존재하는지 확인합니다.
2. 파일 내용을 읽고 lodestar 설정에서 생성된 JSON과 비교합니다.
3. 파일이 없으면 **누락(Missing)** 위반을 반환합니다.
4. 내용이 일치하지 않으면 기대값 대 실제값의 diff와 함께 **드리프트(Drift)** 위반을 반환합니다.
5. `knip.json`이 일치하면 위반을 반환하지 않습니다.

드리프트는 `knip.json` 파일이 수동으로 편집되었거나 다른 도구에 의해 덮어씌워져, lodestar 설정을 더 이상 반영하지 않음을 의미합니다. `lodestar check --fix`를 실행하면 파일을 재생성하여 위반을 해결합니다.

## check 동작 방식

어댑터는 프로젝트 루트에서 `knip --reporter json`을 실행하고 JSON 출력을 파싱합니다. 세 가지 카테고리의 위반을 생성합니다:

| 규칙 ID                  | 심각도 | 설명                                             |
| ------------------------ | ------ | ------------------------------------------------ |
| `knip/unused-file`       | `warn` | 어떤 진입점에서도 참조되지 않는 파일             |
| `knip/unused-dependency` | `warn` | `package.json`에서 사용되지 않는 의존성          |
| `knip/unused-export`     | `warn` | 어디에서도 임포트(Import)되지 않는 내보내기 심볼 |

위반 출력 예시:

```
warn  knip/unused-file        Unused file: src/legacy/old-utils.ts
warn  knip/unused-dependency   Unused dependency: lodash
warn  knip/unused-export       Unused export "helperFn" in src/utils.ts
```
