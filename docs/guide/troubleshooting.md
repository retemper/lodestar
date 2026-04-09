---
description: 'Common Lodestar issues and solutions — config errors, rule conflicts, performance tips, and debugging.'
---

# Troubleshooting

Common issues and how to resolve them.

## Config Not Found

```
No lodestar.config.ts found in /your/project
```

**Cause:** The CLI cannot locate a config file in the project root.

**Solutions:**

1. Ensure one of these files exists in your project root:
   - `lodestar.config.ts`
   - `lodestar.config.mjs`
   - `lodestar.config.js`
2. Run `npx lodestar init` to scaffold a config file.
3. If you're in a subdirectory, run the command from the project root.

## Unknown Rule

```
Config validation failed:
  - Unknown rule "architecture/laeyrs" in config. Did you mean "architecture/layers"?
```

**Cause:** A rule ID in your config doesn't match any rule provided by your plugins.

**Solutions:**

1. Check for typos in the rule name.
2. Make sure the plugin that provides the rule is listed in `plugins`:

```ts
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';

export default defineConfig({
  plugins: [pluginArchitecture], // required for architecture/* rules
  rules: {
    'architecture/layers': 'error',
  },
});
```

3. Ensure the plugin package is installed:

```sh
npm install -D @retemper/lodestar-plugin-architecture
```

## Plugin Resolution Failed

```
Failed to resolve plugin: my-plugin
```

**Cause:** The plugin module cannot be imported.

**Solutions:**

1. Verify the plugin package is installed: `npm ls <package-name>`.
2. Check that the import path is correct in your config file.
3. If using a local plugin, ensure the file path resolves correctly.

## Missing Bridge / Config File

```
✗ adapter/setup
  Missing eslint.config.js — run `lodestar check --fix` to generate it.
```

**Cause:** An adapter expects a managed config file (e.g., `eslint.config.js`, `.prettierrc`) that doesn't exist yet.

**Solution:** Run `lodestar check --fix` to auto-generate all missing config files.

## Config Drift

```
✗ adapter/setup
  .prettierrc content does not match lodestar config (drift detected).
```

**Cause:** The managed config file was manually edited or overwritten by another tool, so it no longer matches the lodestar config.

**Solutions:**

1. Run `lodestar check --fix` to regenerate the file.
2. To customize the tool config, change the adapter options in `lodestar.config.ts` instead of editing the generated file directly.

## ESLint Integration Not Working

```
No lodestar.config.ts with eslintAdapter() found. Add eslintAdapter() to the adapters array.
```

**Cause:** The `fromLodestar()` function in `eslint.config.js` cannot find a lodestar config that includes `eslintAdapter`.

**Solutions:**

1. Add `eslintAdapter()` to the `adapters` array in your config:

```ts
import { eslintAdapter } from '@retemper/lodestar-adapter-eslint';

export default defineConfig({
  adapters: [eslintAdapter({ presets: ['strict'] })],
});
```

2. Ensure `eslint.config.js` contains the bridge:

```js
import { fromLodestar } from '@retemper/lodestar-adapter-eslint';

export default await fromLodestar();
```

## ESLint Package Not Installed

```
ESLint is required for the eslint adapter. Install it: npm install -D eslint typescript-eslint
```

**Cause:** The ESLint adapter tries to import ESLint but the package is missing.

**Solution:**

```sh
npm install -D eslint typescript-eslint
```

## Graph Command Shows Nothing

```
No dependencies found.
```

**Cause:** The module graph has no edges after filtering.

**Solutions:**

1. Ensure your project has TypeScript/JavaScript source files with `import` statements.
2. Check that glob patterns in your config are not excluding all files.

## Graph --layers Without Layers Rule

```
No architecture/layers rule found in lodestar.config.ts. Configure layers first.
```

**Cause:** The `--layers` flag requires an `architecture/layers` rule with layer definitions.

**Solution:** Configure the layers rule:

```ts
rules: {
  'architecture/layers': {
    severity: 'error',
    options: {
      layers: [
        { name: 'domain', path: 'src/domain/**' },
        { name: 'application', path: 'src/application/**', canImport: ['domain'] },
      ],
    },
  },
}
```

## Impact Command: File Not Found

```
File not found in module graph: src/missing.ts
```

**Cause:** The specified file doesn't exist in the module graph.

**Solutions:**

1. Check the file path — it should be relative to the project root.
2. Ensure the file is a `.ts` or `.js` file that is reachable from your project's entry points.

## Rule Throws an Error

```
✗ my-plugin/my-rule  Error: something went wrong
```

**Cause:** A rule's `check()` function threw an unexpected error. Violations reported before the error are still preserved.

**Solutions:**

1. Check the error message for clues.
2. If this is a custom rule, debug the `check()` function.
3. If this is a built-in rule, check that your config options match the expected schema.
4. File an issue if the error persists with valid configuration.

## Warnings Don't Fail CI

This is by design. Only violations with severity `'error'` cause a non-zero exit code. Warnings are informational.

To make a warning fail CI, change its severity to `'error'`:

```ts
rules: {
  'architecture/no-circular': 'error', // was 'warn'
}
```

## FAQ

### Can I use multiple plugins together?

Yes. List all plugins in the `plugins` array:

```ts
export default defineConfig({
  plugins: [pluginArchitecture, pluginStructure],
  rules: {
    'architecture/layers': 'error',
    'structure/file-naming': 'warn',
  },
});
```

### How do I disable a rule from a plugin?

Set its severity to `'off'`:

```ts
rules: {
  'architecture/no-circular': 'off',
}
```

### Can a rule partially report violations if it crashes?

Yes. If a rule calls `ctx.report()` multiple times and then throws, all previously reported violations are preserved in the output.

### Does `--fix` apply setup fixes before running checks?

Yes. Setup fixes (missing config files) are applied first, then adapter checks run, then violation-level and adapter-level fixes are applied.

### What's the difference between severity `'off'` and removing the rule from config?

`'off'` explicitly disables the rule — the rule's `check()` still executes but its violations are silently discarded. Removing the rule from config means it never runs at all. The visible output is the same (no violations reported), but with `'off'` the rule still consumes resources. Use `'off'` to document that you've considered the rule and intentionally disabled it.
