---
description: 'Enable auto-fix in Lodestar rules to automatically resolve violations with lodestar check --fix.'
---

# Auto-fix

Lodestar supports automatic fixes for both setup violations and code violations. Run `lodestar check --fix` to apply all available fixes.

## How --fix Works

The fix pipeline runs in three phases:

### Phase 1: Setup Fixes

Missing or drifted config files (e.g., `eslint.config.js`, `.prettierrc`) are created or regenerated. This happens **before** adapter checks run, so tools can find their config files.

### Phase 2: Violation Fixes

Individual violations that provide a `fix` are applied. This covers both native rule violations and adapter violations.

### Phase 3: Adapter Bulk Fixes

Adapters with bulk fix capabilities run last. For example, the ESLint adapter runs `eslint --fix` and the Prettier adapter runs `prettier --write`.

## Which Adapters Support Fix?

| Adapter     | Setup Fix | Check Fix | Bulk Fix |
| ----------- | --------- | --------- | -------- |
| ESLint      | Yes       | --        | Yes      |
| Prettier    | Yes       | --        | Yes      |
| Biome       | Yes       | --        | --       |
| Stylelint   | Yes       | --        | Yes      |
| Husky       | Yes       | --        | --       |
| Lint-Staged | Yes       | --        | --       |
| Commitlint  | Yes       | --        | --       |
| Knip        | Yes       | --        | --       |

**Setup Fix** generates managed config files. **Bulk Fix** runs the tool's native fix command.

## Writing Fixable Rules

Custom rules can provide fixes by attaching a `fix` object to reported violations:

```ts
import { defineRule } from '@retemper/lodestar';

const myRule = defineRule({
  name: 'my-plugin/enforce-barrel',
  description: 'Enforce barrel file exports',
  needs: ['fs'],
  async check(ctx) {
    const modules = await ctx.providers.fs.glob('src/*/index.ts');

    for (const dir of await ctx.providers.fs.glob('src/*/')) {
      const barrel = `${dir}index.ts`;
      const hasBarrel = modules.includes(barrel);

      if (!hasBarrel) {
        ctx.report({
          message: `Missing barrel file: ${barrel}`,
          location: { file: dir },
          fix: {
            description: `Create ${barrel} with empty export`,
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

### Fix Interface

```ts
interface Fix {
  /** Human-readable explanation of what the fix will do */
  readonly description: string;
  /** Executes the fix, mutating the file system as needed */
  readonly apply: () => Promise<void>;
}
```

### Guidelines for Writing Fixes

- **Be precise:** Only modify the exact files and lines related to the violation.
- **Be idempotent:** Running the fix multiple times should produce the same result.
- **Describe the fix:** The `description` is shown to users so they understand what will change.
- **Handle errors gracefully:** If a fix cannot be applied (e.g., file is read-only), let the error propagate — the engine catches it.

## Dry Run

To see what violations exist without applying fixes, run `lodestar check` without the `--fix` flag. Violations with available fixes show a fix description in the output.
