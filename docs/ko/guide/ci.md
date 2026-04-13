---
description: 'CI/CD에 Lodestar 통합하기 — GitHub Actions, GitLab CI 등 파이프라인 설정 가이드.'
---

# CI/CD 연동

Lodestar는 단일 CLI 명령으로 실행되므로 어떤 CI 파이프라인에도 쉽게 통합할 수 있습니다.

## 빠른 설정

심각도가 `'error'`인 위반이 있으면 `lodestar check`가 종료 코드 1을 반환하여 파이프라인을 실패시킵니다.

```sh
npx lodestar check
```

## GitHub Actions

### 기본

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  lodestar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx lodestar check
```

### 후처리를 위한 JSON 출력

`--format json` 플래그를 사용하여 기계 판독 가능한 출력을 생성할 수 있습니다:

```yaml
- run: npx lodestar check --format json > lodestar-report.json
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: lodestar-report
    path: lodestar-report.json
```

### 모노레포 (워크스페이스 모드)

```yaml
- run: npx lodestar check --workspace
```

`lodestar.config.ts`가 있는 모든 패키지를 찾아 각각 검사합니다.

## GitLab CI

```yaml
# .gitlab-ci.yml
lodestar:
  stage: test
  image: node:20
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/
  script:
    - npm ci
    - npx lodestar check
```

## 기타 CI 시스템

Lodestar는 Node.js가 실행되는 어디에서나 동작합니다. 패턴은 항상 동일합니다:

```sh
npm ci              # 의존성 설치
npx lodestar check  # 검사 실행 -- 에러 시 종료 코드 1
```

| 시스템       | 설정 파일                 | 비고                           |
| ------------ | ------------------------- | ------------------------------ |
| CircleCI     | `.circleci/config.yml`    | `run` 단계로 추가              |
| Jenkins      | `Jenkinsfile`             | `sh 'npx lodestar check'` 사용 |
| Azure DevOps | `azure-pipelines.yml`     | `script` 단계로 추가           |
| Bitbucket    | `bitbucket-pipelines.yml` | `script` 단계로 추가           |

## 팁

### 빠른 실패

파이프라인 초반에 `lodestar check`를 배치하세요. 아키텍처 위반은 빠르게 감지되며 근본적인 문제를 나타냅니다 -- 의존성 그래프가 깨져 있다면 느린 통합 테스트를 실행할 이유가 없습니다.

### node_modules 캐싱

Lodestar의 분석은 I/O 바운드가 아닌 CPU 바운드입니다. 가장 큰 시간 절약은 `node_modules`를 캐싱하여 `npm ci`를 건너뛰는 것입니다.

### 종료 코드

| 코드 | 의미                                   |
| ---- | -------------------------------------- |
| `0`  | 모든 검사 통과 (경고는 허용)           |
| `1`  | `'error'` 심각도 위반이 하나 이상 존재 |
