---
layout: home

hero:
  name: Lodestar
  text: 하나의 설정으로 프로젝트를 통치하세요.
  tagline: 아키텍처 규칙, 도구 설정, 셋업 검증 — 모두 한곳에서 선언합니다.
  actions:
    - theme: brand
      text: 시작하기
      link: /ko/guide/getting-started
    - theme: alt
      text: GitHub에서 보기
      link: https://github.com/retemper/lodestar

features:
  - title: 흩어진 설정? 한 번만 선언하세요.
    details: ESLint, Prettier, Biome, Git hooks — lodestar.config.ts 하나가 전부 생성합니다. 팀은 도구마다가 아니라 한 번만 합의하면 됩니다.
  - title: 설정 파일이 달라졌다면? 자동 복구.
    details: 누군가 .prettierrc를 직접 수정했다면? Lodestar가 drift를 감지하고 --fix로 원래대로 돌립니다. 설정 파일이 항상 권위 있는 원본입니다.
  - title: ESLint가 못하는 아키텍처 규칙
    details: 레이어 경계, 모듈 캡슐화, 순환 참조 탐지. 아키텍처를 코드로 선언하고 CI에서 강제하세요.
  - title: 모노레포 네이티브
    details: 하나의 커맨드로 모든 패키지를 검사합니다. 패키지별 독립 설정, 패키지별 결과, 자동 워크스페이스 탐색.
  - title: 영향 범위를 파악하세요
    details: '`lodestar impact <file>`은 변경에 영향받는 모든 파일을 추적합니다. 확신을 갖고 리뷰하세요.'
  - title: 나만의 규칙, 나만의 플러그인
    details: TypeScript로 커스텀 규칙을 작성하고 AST, 의존성 그래프, 파일 시스템에 접근하세요. npm 패키지로 공유 가능합니다.
---
