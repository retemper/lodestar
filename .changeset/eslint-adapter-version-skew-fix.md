---
'@retemper/lodestar-adapter-eslint': patch
'@retemper/lodestar-core': patch
---

Fix ESLint version skew breaking `check()`/`fix()` on projects pinned to `eslint@9` (#34).

The adapter used to load `eslint` via `import('eslint')`, which pnpm resolved against the adapter's open-ended `>=9.0.0` peer range — picking the latest published major (e.g. `eslint@10`) even when the user's project pinned `eslint@9`. The resulting dual-resolution surfaced as runtime crashes such as `scopeManager.addGlobals is not a function`.

Three layered changes:

- **Load ESLint from the user's project.** `check()` and `fix()` now resolve `eslint` via `createRequire(<rootDir>/package.json).resolve('eslint')` so the adapter and the user's plugins/configs run the same ESLint instance. Falls back to adapter-local resolution only when the project has no ESLint installed.
- **Tighten the `eslint` peer range** to `"^9.0.0 || ^10.0.0"` on both `@retemper/lodestar-adapter-eslint` and `@retemper/lodestar-core`. Signals supported majors explicitly instead of accepting arbitrarily newer releases. No currently-published ESLint is excluded by this change; the old `">=9.0.0"` was meant to mean "all supported majors at release time" and this spelling makes that intent enforceable.
- **Augment known skew errors.** When `lintFiles()` throws a signature known to indicate runtime/plugin version mismatch (currently `scopeManager.addGlobals is not a function`), the adapter rethrows with the resolved ESLint path, `Linter.version`, and pnpm/npm/yarn override recipes so the fix is obvious from the error alone.
