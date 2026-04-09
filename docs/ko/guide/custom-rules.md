---
description: 'TypeScript로 커스텀 Lodestar 규칙 작성하기 — AST, 의존성 그래프, 파일시스템 프로바이더 활용.'
---

# 커스텀 규칙(Custom Rules)

`defineRule`을 사용하여 TypeScript로 직접 규칙을 작성할 수 있습니다.

## 기본 예제

```ts
import { defineRule } from '@retemper/lodestar';

const noUtilsBarrel = defineRule({
  name: 'my-team/no-utils-barrel',
  description: 'Forbids catch-all utils directories',
  needs: ['fs'],
  async check(ctx) {
    const exists = await ctx.providers.fs.exists('src/utils/index.ts');
    if (exists) {
      ctx.report({
        message: 'Avoid a catch-all utils barrel — colocate utilities with their consumers',
        location: { file: 'src/utils/index.ts' },
      });
    }
  },
});
```

## 옵션 사용

제네릭과 JSON Schema를 사용하여 사용자가 설정 가능한 옵션을 받을 수 있습니다:

```ts
const maxFileLength = defineRule<{ max: number }>({
  name: 'my-team/max-file-length',
  description: 'Limits the number of lines in a file',
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
      const lines = content.split('\n').length;
      if (lines > ctx.options.max) {
        ctx.report({
          message: `${file} has ${lines} lines (limit: ${ctx.options.max})`,
          location: { file },
        });
      }
    }
  },
});
```

## 사용 가능한 프로바이더

### 파일 시스템(File System) (`needs: ['fs']`)

```ts
ctx.providers.fs.glob(pattern); // 글로브와 일치하는 파일 찾기
ctx.providers.fs.readFile(path); // 파일 내용 읽기
ctx.providers.fs.exists(path); // 파일/디렉터리 존재 여부 확인
ctx.providers.fs.readJson(path); // JSON 파일 읽기 및 파싱
```

### 의존성 그래프(Dependency Graph) (`needs: ['graph']`)

```ts
ctx.providers.graph.getDependencies(file); // 이 파일이 임포트하는 대상
ctx.providers.graph.getDependents(file); // 이 파일을 임포트하는 대상
ctx.providers.graph.hasCircular(entry); // 순환 의존성 확인
ctx.providers.graph.getModuleGraph(); // 전체 그래프
```

### AST (`needs: ['ast']`)

```ts
ctx.providers.ast.getImports(path); // 파싱된 import 선언
ctx.providers.ast.getExports(path); // 파싱된 export 선언
ctx.providers.ast.getSourceFile(path); // Raw AST 노드
```

### 설정 파일(Config Files) (`needs: ['config']`)

```ts
ctx.providers.config.getPackageJson(); // package.json
ctx.providers.config.getTsConfig(); // tsconfig.json
ctx.providers.config.getCustomConfig('file'); // 임의의 JSON/JS 설정
```
