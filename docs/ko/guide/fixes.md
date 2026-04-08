# 자동 수정

Lodestar는 셋업 위반과 코드 위반 모두에 대한 자동 수정을 지원합니다. `lodestar check --fix`를 실행하여 사용 가능한 모든 수정을 적용하세요.

## --fix 동작 방식

수정 파이프라인은 세 단계로 실행됩니다:

### 1단계: 셋업 수정

누락되거나 드리프트된 설정 파일(예: `eslint.config.js`, `.prettierrc`)을 생성하거나 재생성합니다. 이 단계는 어댑터 검사가 실행되기 **전에** 수행되어, 도구가 설정 파일을 찾을 수 있도록 합니다.

### 2단계: 위반 수정

`fix`를 제공하는 개별 위반 사항이 적용됩니다. 네이티브 규칙 위반과 어댑터 위반 모두 포함됩니다.

### 3단계: 어댑터 일괄 수정

일괄 수정 기능이 있는 어댑터가 마지막으로 실행됩니다. 예를 들어 ESLint 어댑터는 `eslint --fix`를, Prettier 어댑터는 `prettier --write`를 실행합니다.

## 어댑터별 수정 지원 현황

| 어댑터      | 셋업 수정 | 검사 수정 | 일괄 수정 |
| ---------- | --------- | --------- | -------- |
| ESLint     | 지원      | --        | 지원     |
| Prettier   | 지원      | --        | 지원     |
| Biome      | 지원      | --        | --       |
| Stylelint  | 지원      | --        | 지원     |
| Husky      | 지원      | --        | --       |
| Lint-Staged| 지원      | --        | --       |
| Commitlint | 지원      | --        | --       |
| Knip       | 지원      | --        | --       |

**셋업 수정**은 관리 대상 설정 파일을 생성합니다. **일괄 수정**은 도구의 네이티브 수정 명령을 실행합니다.

## 수정 가능한 규칙 작성

커스텀 규칙은 보고된 위반에 `fix` 객체를 첨부하여 수정을 제공할 수 있습니다:

```ts
import { defineRule } from '@retemper/lodestar';

const myRule = defineRule({
  name: 'my-plugin/enforce-barrel',
  description: 'Barrel 파일 export 강제',
  needs: ['fs'],
  async check(ctx) {
    const modules = await ctx.providers.fs.glob('src/*/index.ts');

    for (const dir of await ctx.providers.fs.glob('src/*/')) {
      const barrel = `${dir}index.ts`;
      const hasBarrel = modules.includes(barrel);

      if (!hasBarrel) {
        ctx.report({
          message: `Barrel 파일 누락: ${barrel}`,
          location: { file: dir },
          fix: {
            description: `빈 export로 ${barrel} 생성`,
            async apply() {
              const { writeFile } = await import('node:fs/promises');
              await writeFile(barrel, 'export {};\n', 'utf-8');
            },
          },
        });
      }
    }
  },
});
```

### Fix 인터페이스

```ts
interface Fix {
  /** 수정이 무엇을 하는지에 대한 사람이 읽을 수 있는 설명 */
  readonly description: string;
  /** 수정을 실행하여 필요에 따라 파일 시스템을 변경 */
  readonly apply: () => Promise<void>;
}
```

### 수정 작성 가이드라인

- **정확하게:** 위반과 관련된 정확한 파일과 라인만 수정하세요.
- **멱등성 유지:** 수정을 여러 번 실행해도 동일한 결과를 만들어야 합니다.
- **수정 설명:** `description`은 사용자에게 표시되므로 무엇이 변경되는지 이해할 수 있어야 합니다.
- **에러 처리:** 수정을 적용할 수 없는 경우(예: 읽기 전용 파일) 에러를 전파하세요 -- 엔진이 이를 캐치합니다.

## 드라이 런

수정을 적용하지 않고 어떤 위반이 있는지 확인하려면 `--fix` 플래그 없이 `lodestar check`를 실행하세요. 수정 가능한 위반은 출력에 수정 설명이 표시됩니다.
