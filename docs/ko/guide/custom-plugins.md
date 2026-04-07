# 커스텀 플러그인(Custom Plugins)

플러그인(Plugin)은 여러 규칙(Rule)을 하나의 설치 가능한 패키지로 묶은 것입니다.

## 플러그인 만들기

```ts
// lodestar-plugin-my-team/src/index.ts
import { definePlugin, defineRule } from '@retemper/lodestar';

const maxFileLength = defineRule<{ max: number }>({
  name: 'my-team/max-file-length',
  description: 'Limits file length',
  needs: ['fs'],
  schema: {
    type: 'object',
    properties: { max: { type: 'number' } },
    required: ['max'],
  },
  async check(ctx) {
    const files = await ctx.providers.fs.glob('src/**/*.ts');
    for (const file of files) {
      const content = await ctx.providers.fs.readFile(file);
      if (content.split('\n').length > ctx.options.max) {
        ctx.report({
          message: `File exceeds ${ctx.options.max} lines`,
          location: { file },
        });
      }
    }
  },
});

const requireReadme = defineRule({
  name: 'my-team/require-readme',
  description: 'Requires a README.md in the project root',
  needs: ['fs'],
  async check(ctx) {
    const exists = await ctx.providers.fs.exists('README.md');
    if (!exists) {
      ctx.report({ message: 'Project must have a README.md' });
    }
  },
});

export default definePlugin(() => ({
  name: 'my-team/conventions',
  rules: [maxFileLength, requireReadme],
}));
```

## 커스텀 플러그인 사용

```ts
// lodestar.config.ts
import { defineConfig } from '@retemper/lodestar';

export default defineConfig({
  plugins: ['lodestar-plugin-my-team'],
  rules: {
    'my-team/max-file-length': { severity: 'warn', options: { max: 300 } },
    'my-team/require-readme': 'error',
  },
});
```

## 네이밍 규칙

- npm 패키지: `lodestar-plugin-{name}` 또는 `@scope/lodestar-plugin-{name}`
- 규칙 이름: `{plugin-namespace}/{rule-name}` (예: `my-team/max-file-length`)
- `definePlugin`의 플러그인 이름: 규칙에서 사용하는 네임스페이스와 일치

## 배포

플러그인은 일반 npm 패키지입니다. `definePlugin()` 호출을 default export로 내보내세요:

```json
{
  "name": "lodestar-plugin-my-team",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@retemper/lodestar-types": ">=0.1.0"
  }
}
```
