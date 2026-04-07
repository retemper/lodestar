# Rules

A rule is the smallest unit of enforcement. Each rule declares what data sources it needs and runs a check against the project.

## Anatomy of a Rule

```ts
import { defineRule } from '@retemper/lodestar';

const myRule = defineRule({
  name: 'my-plugin/my-rule',
  description: 'What this rule checks',
  needs: ['fs'], // data sources: 'fs', 'graph', 'ast', 'config'
  schema: {
    /* JSON Schema */
  }, // validates options
  async check(ctx) {
    // ctx.providers.fs — file system access
    // ctx.options     — user-provided options
    // ctx.report()    — report a violation
  },
});
```

## Providers

Rules declare which providers they need via the `needs` array:

| Provider | Access                 | Use Case                                           |
| -------- | ---------------------- | -------------------------------------------------- |
| `fs`     | `ctx.providers.fs`     | Glob files, read contents, check existence         |
| `graph`  | `ctx.providers.graph`  | Query dependencies, dependents, circular detection |
| `ast`    | `ctx.providers.ast`    | Parse imports/exports, access TypeScript AST       |
| `config` | `ctx.providers.config` | Read package.json, tsconfig.json, custom configs   |

## Severity

Rules can be configured with three severity levels:

| Severity  | Behavior                                     |
| --------- | -------------------------------------------- |
| `'error'` | Reported as error, causes non-zero exit code |
| `'warn'`  | Reported as warning, does not fail the build |
| `'off'`   | Rule is disabled entirely                    |

## Configuring Rules

```ts
rules: {
  // Shorthand: just severity
  'dependency-graph/no-circular': 'error',

  // Full form: severity + options
  'naming-convention/file-naming': {
    severity: 'warn',
    options: {
      scopes: [
        {
          include: 'src/**/*.ts',
          convention: 'kebab-case',
        },
      ],
    },
  },

  // Disable a rule
  'import-boundary/no-deep-import': 'off',
}
```

## Reporting Violations

Inside `check()`, call `ctx.report()` to flag a violation:

```ts
ctx.report({
  message: 'Human-readable description of the problem',
  location: {
    file: 'src/bad-file.ts',
    line: 42, // optional
    column: 10, // optional
  },
});
```
