# 리포터(Reporters)

리포터는 Lodestar가 결과를 표시하는 방식을 제어합니다. CLI에서 내장 형식을 선택하거나 설정 파일에서 리포터를 구성할 수 있습니다.

## CLI 형식

`--format`으로 출력 형식을 선택합니다:

```sh
npx lodestar check --format console   # 기본값 — 사람이 읽을 수 있는 출력
npx lodestar check --format json      # 구조화된 JSON을 stdout으로 출력
npx lodestar check --format sarif     # GitHub/IDE 연동을 위한 SARIF 2.1.0
npx lodestar check --format junit     # CI 시스템용 JUnit XML
```

## 내장 리포터(Built-in Reporters)

| 형식      | 패키지                              | 출력   | 용도                                       |
| --------- | ----------------------------------- | ------ | ------------------------------------------ |
| `console` | `@retemper/lodestar-cli`            | stderr | 로컬 개발, 사람이 읽을 수 있는 형식        |
| `json`    | `@retemper/lodestar-cli`            | stdout | CI 파이프라인, 프로그래밍 방식 소비        |
| `sarif`   | `@retemper/lodestar-reporter-sarif` | stdout | GitHub Code Scanning, VS Code SARIF 뷰어   |
| `junit`   | `@retemper/lodestar-reporter-junit` | stdout | Jenkins, GitLab CI, CircleCI 테스트 리포트 |

## SARIF 리포터

[SARIF](https://sarifweb.azurewebsites.net/) (Static Analysis Results Interchange Format)는 정적 분석 출력을 위한 OASIS 표준입니다. GitHub Code Scanning 연동에 사용합니다:

```sh
npx lodestar check --format sarif > results.sarif
```

출력에는 문서 URL이 포함된 규칙 정의, 소스 위치, 심각도 매핑이 포함됩니다.

## JUnit 리포터

JUnit XML은 테스트 결과 시각화를 위해 CI 시스템에서 널리 지원됩니다:

```sh
npx lodestar check --format junit > results.xml
```

각 규칙은 테스트 케이스가 됩니다. 위반은 실패(에러) 또는 system-out(경고)으로 보고됩니다.

## 설정 기반 리포터(Config-based Reporters)

`lodestar.config.ts`에서 리포터를 구성하여 항상 실행되는 출력을 설정할 수 있습니다 (예: 콘솔 출력과 함께 항상 SARIF 파일 생성):

```ts
import { defineConfig } from '@retemper/lodestar';
import { sarifReporter } from '@retemper/lodestar-reporter-sarif';

export default defineConfig({
  plugins: [
    /* ... */
  ],
  rules: {
    /* ... */
  },
  reporters: [sarifReporter({ output: 'reports/lodestar.sarif' })],
});
```

설정 기반 리포터는 CLI 형식 리포터를 **대체하지 않고 추가로** 실행됩니다.

## 커스텀 리포터(Custom Reporters)

`Reporter` 인터페이스와 커스텀 리포터 예시는 [Core API — Reporter](/ko/api/core#reporter) 섹션을 참고하세요.
