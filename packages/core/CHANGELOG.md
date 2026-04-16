# @retemper/lodestar-core

## 0.0.4

### Patch Changes

- [#35](https://github.com/retemper/lodestar/pull/35) [`8e73a10`](https://github.com/retemper/lodestar/commit/8e73a103b11a549675d94d1748b9923c5688e732) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Fix ESLint version skew breaking `check()`/`fix()` on projects pinned to `eslint@9` ([#34](https://github.com/retemper/lodestar/issues/34)).

  The adapter used to load `eslint` via `import('eslint')`, which pnpm resolved against the adapter's open-ended `>=9.0.0` peer range — picking the latest published major (e.g. `eslint@10`) even when the user's project pinned `eslint@9`. The resulting dual-resolution surfaced as runtime crashes such as `scopeManager.addGlobals is not a function`.

  Three layered changes:
  - **Load ESLint from the user's project.** `check()` and `fix()` now resolve `eslint` via `createRequire(<rootDir>/package.json).resolve('eslint')` so the adapter and the user's plugins/configs run the same ESLint instance. Falls back to adapter-local resolution only when the project has no ESLint installed.
  - **Tighten the `eslint` peer range** to `"^9.0.0 || ^10.0.0"` on both `@retemper/lodestar-adapter-eslint` and `@retemper/lodestar-core`. Signals supported majors explicitly instead of accepting arbitrarily newer releases. No currently-published ESLint is excluded by this change; the old `">=9.0.0"` was meant to mean "all supported majors at release time" and this spelling makes that intent enforceable.
  - **Augment known skew errors.** When `lintFiles()` throws a signature known to indicate runtime/plugin version mismatch (currently `scopeManager.addGlobals is not a function`), the adapter rethrows with the resolved ESLint path, `Linter.version`, and pnpm/npm/yarn override recipes so the fix is obvious from the error alone.

## 0.0.3

### Patch Changes

- [#23](https://github.com/retemper/lodestar/pull/23) [`d216f16`](https://github.com/retemper/lodestar/commit/d216f1686e2e676b406de64a7d20f91a28027526) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Skip non-parseable files (e.g. .graphql, .svg, .json) in AST provider to prevent SWC parse errors

## 0.0.2

### Patch Changes

- [#18](https://github.com/retemper/lodestar/pull/18) [`ac335b2`](https://github.com/retemper/lodestar/commit/ac335b2e6bffa066f7469130b628fda85bb90e13) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Fix `stripJsonComments` treating `//` inside JSON string literals as comments, which caused `JSON.parse` to crash on tsconfig files containing URLs (e.g. `$schema`). Also filter out directories from `fsProvider.glob()` results to prevent EISDIR errors.

## 0.0.1

### Patch Changes

- [#15](https://github.com/retemper/lodestar/pull/15) [`fe8724a`](https://github.com/retemper/lodestar/commit/fe8724acdda0988ce1fc46dbdbcec802479bf98c) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Initial release

- Updated dependencies [[`fe8724a`](https://github.com/retemper/lodestar/commit/fe8724acdda0988ce1fc46dbdbcec802479bf98c)]:
  - @retemper/lodestar-config@0.0.1
  - @retemper/lodestar-types@0.0.1
