# 어댑터(Adapters)

어댑터(Adapter)는 외부 도구 -- 린터, 포매터, Git 훅 -- 를 `lodestar.config.ts`에서 선언적으로 통합합니다. 도구 설정을 단일 소스(Single Source of Truth)에서 중앙 관리하면서, 각 도구와 IDE가 기대하는 네이티브 설정 파일을 자동 생성합니다.

```sh
pnpm add -D @retemper/lodestar-adapter-eslint @retemper/lodestar-adapter-prettier @retemper/lodestar-adapter-biome @retemper/lodestar-adapter-husky @retemper/lodestar-adapter-lint-staged @retemper/lodestar-adapter-commitlint @retemper/lodestar-adapter-knip @retemper/lodestar-adapter-stylelint
```

## ToolAdapter 인터페이스

모든 어댑터는 `@retemper/lodestar-types`의 `ToolAdapter` 인터페이스를 구현합니다:

```ts
interface ToolAdapter<TConfig = unknown> {
  readonly name: string;
  readonly config: TConfig;
  check?(rootDir: string, include: readonly string[]): Promise<readonly Violation[]>;
  fix?(rootDir: string, include: readonly string[]): Promise<void>;
  generateConfig?(): Promise<unknown[]>;
  verifySetup?(rootDir: string): Promise<readonly Violation[]>;
  setup?(rootDir: string): Promise<void>;
}
```

| 메서드           | 목적                                                           |
| ---------------- | -------------------------------------------------------------- |
| `check`          | 도구를 실행하고 위반(Violation)을 반환 (린터, 포매터)          |
| `fix`            | 자동 수정 -- 린터의 `--fix`, 포매터의 `--write`                |
| `generateConfig` | IDE/에디터 연동을 위한 네이티브 설정 객체 빌드                 |
| `verifySetup`    | 설정 파일 누락 또는 드리프트(Drift)를 감지하고 위반을 반환     |
| `setup`          | 도구 인프라 생성 (Git 훅, CI 설정) -- `lodestar init`에서 호출 |

## 설정에 어댑터 추가

어댑터는 설정 블록의 `adapters` 배열에 배치합니다:

```ts
import { defineConfig } from '@retemper/lodestar-types';
import { eslintAdapter } from '@retemper/lodestar-adapter-eslint';
import { prettierAdapter } from '@retemper/lodestar-adapter-prettier';

export default defineConfig({
  adapters: [eslintAdapter({ presets: ['strict'] }), prettierAdapter({ singleQuote: true })],
});
```

## 설정 검증(Setup Verification) 흐름

`lodestar check`를 실행하면, 어댑터는 두 단계 프로세스에 참여합니다:

1. **설정 검증** -- 각 어댑터의 `verifySetup`이 먼저 호출됩니다. 관리 파일이 존재하고 lodestar 설정과 일치하는지 확인합니다. 누락되거나 드리프트된 파일은 위반(Violation)을 생성합니다.

2. **검사 실행** -- 설정이 유효하면, `check`가 실제 도구(ESLint, Prettier, Biome)를 실행합니다.

`lodestar check --fix`를 실행하면, 도구 검사 실행 전에 설정 위반에 대한 자동 수정 -- 관리 파일 생성 또는 업데이트 -- 이 적용됩니다.

## 사용 가능한 어댑터

| 어댑터                                          | 패키지                          | 관리 파일            | 설명                                 |
| ----------------------------------------------- | ------------------------------- | -------------------- | ------------------------------------ |
| [adapter-eslint](/ko/adapters/eslint)           | `@retemper/lodestar-adapter-eslint`      | `eslint.config.js`   | Node API를 통한 ESLint와 브릿지 파일 |
| [adapter-prettier](/ko/adapters/prettier)       | `@retemper/lodestar-adapter-prettier`    | `.prettierrc`        | CLI를 통한 Prettier                  |
| [adapter-biome](/ko/adapters/biome)             | `@retemper/lodestar-adapter-biome`       | `biome.json`         | 임시 설정을 사용하는 CLI 기반 Biome  |
| [adapter-husky](/ko/adapters/husky)             | `@retemper/lodestar-adapter-husky`       | `.husky/<hook>`      | Husky를 통한 Git 훅                  |
| [adapter-lint-staged](/ko/adapters/lint-staged) | `@retemper/lodestar-adapter-lint-staged` | `.lintstagedrc.json` | 스테이징된 파일 린팅                 |
| [adapter-commitlint](/ko/adapters/commitlint)   | `@retemper/lodestar-adapter-commitlint`  | `.commitlintrc.json` | 커밋 메시지 컨벤션                   |
| [adapter-knip](/ko/adapters/knip)               | `@retemper/lodestar-adapter-knip`        | `knip.json`          | 미사용 export/의존성 감지            |
| [adapter-stylelint](/ko/adapters/stylelint)     | `@retemper/lodestar-adapter-stylelint`   | `.stylelintrc.json`  | CSS/SCSS 린팅                        |
