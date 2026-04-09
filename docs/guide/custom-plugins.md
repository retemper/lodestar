---
description: 'Bundle custom rules into reusable Lodestar plugins and share them as npm packages.'
---

# Custom Plugins

A plugin bundles multiple rules into a single installable package.

## Creating a Plugin

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

## Using a Custom Plugin

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

## Naming Convention

- npm package: `lodestar-plugin-{name}` or `@scope/lodestar-plugin-{name}`
- Rule names: `{plugin-namespace}/{rule-name}` (e.g., `my-team/max-file-length`)
- Plugin name in `definePlugin`: matches the namespace used in rules

## Publishing

A plugin is just an npm package. Export a `definePlugin()` call as the default export:

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
