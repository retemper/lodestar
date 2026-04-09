---
description: 'Write custom Lodestar rules in TypeScript with access to AST, dependency graph, and file system providers.'
---

# Custom Rules

Write your own rules in TypeScript using `defineRule`.

## Basic Example

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

## With Options

Use generics and JSON Schema to accept user-configurable options:

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

## Available Providers

### File System (`needs: ['fs']`)

```ts
ctx.providers.fs.glob(pattern); // Find files matching a glob
ctx.providers.fs.readFile(path); // Read file contents
ctx.providers.fs.exists(path); // Check if file/dir exists
ctx.providers.fs.readJson(path); // Read and parse JSON file
```

### Dependency Graph (`needs: ['graph']`)

```ts
ctx.providers.graph.getDependencies(file); // What this file imports
ctx.providers.graph.getDependents(file); // What imports this file
ctx.providers.graph.hasCircular(entry); // Circular dependency check
ctx.providers.graph.getModuleGraph(); // Full graph
```

### AST (`needs: ['ast']`)

```ts
ctx.providers.ast.getImports(path); // Parsed import declarations
ctx.providers.ast.getExports(path); // Parsed export declarations
ctx.providers.ast.getSourceFile(path); // Raw AST node
```

### Config Files (`needs: ['config']`)

```ts
ctx.providers.config.getPackageJson(); // package.json
ctx.providers.config.getTsConfig(); // tsconfig.json
ctx.providers.config.getCustomConfig('file'); // Any JSON/JS config
```
