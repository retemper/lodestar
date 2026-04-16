# @retemper/lodestar-adapter-eslint

## 0.1.2

### Patch Changes

- [#35](https://github.com/retemper/lodestar/pull/35) [`8e73a10`](https://github.com/retemper/lodestar/commit/8e73a103b11a549675d94d1748b9923c5688e732) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Fix ESLint version skew breaking `check()`/`fix()` on projects pinned to `eslint@9` ([#34](https://github.com/retemper/lodestar/issues/34)).

  The adapter used to load `eslint` via `import('eslint')`, which pnpm resolved against the adapter's open-ended `>=9.0.0` peer range — picking the latest published major (e.g. `eslint@10`) even when the user's project pinned `eslint@9`. The resulting dual-resolution surfaced as runtime crashes such as `scopeManager.addGlobals is not a function`.

  Three layered changes:
  - **Load ESLint from the user's project.** `check()` and `fix()` now resolve `eslint` via `createRequire(<rootDir>/package.json).resolve('eslint')` so the adapter and the user's plugins/configs run the same ESLint instance. Falls back to adapter-local resolution only when the project has no ESLint installed.
  - **Tighten the `eslint` peer range** to `"^9.0.0 || ^10.0.0"` on both `@retemper/lodestar-adapter-eslint` and `@retemper/lodestar-core`. Signals supported majors explicitly instead of accepting arbitrarily newer releases. No currently-published ESLint is excluded by this change; the old `">=9.0.0"` was meant to mean "all supported majors at release time" and this spelling makes that intent enforceable.
  - **Augment known skew errors.** When `lintFiles()` throws a signature known to indicate runtime/plugin version mismatch (currently `scopeManager.addGlobals is not a function`), the adapter rethrows with the resolved ESLint path, `Linter.version`, and pnpm/npm/yarn override recipes so the fix is obvious from the error alone.

## 0.1.1

### Patch Changes

- [#32](https://github.com/retemper/lodestar/pull/32) [`0735ba5`](https://github.com/retemper/lodestar/commit/0735ba5ba3e9bc49a448631ece0f1bd70bd7a079) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Fix `extends` being ignored by `check()`/`fix()` at runtime. `buildFlatConfig()` now resolves `extends` entries (both static and factory forms) and threads `rootDir` through, matching the blocks emitted by `generateConfigFile()`. Also skip `@eslint/js` recommended when `extends` is set, so the shared config controls the baseline rule set. Previously, projects relying on `extends` silently linted zero files (because no flat-config block carried a `files` glob) or surfaced parse errors when an override glob accidentally matched a file the shared parser was supposed to handle.

## 0.1.0

### Minor Changes

- [#29](https://github.com/retemper/lodestar/pull/29) [`f23a4dd`](https://github.com/retemper/lodestar/commit/f23a4dd1604e9e151a384d7f3824924377221fff) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Add `extends` option to reference external shared ESLint flat configs, `moduleFormat` option for ESM/CJS output control, and static code generation for eslint.config.js replacing the runtime bridge pattern. Deprecate `fromLodestar()` in favor of static codegen.

## 0.0.1

### Patch Changes

- [#15](https://github.com/retemper/lodestar/pull/15) [`fe8724a`](https://github.com/retemper/lodestar/commit/fe8724acdda0988ce1fc46dbdbcec802479bf98c) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Initial release

- Updated dependencies [[`fe8724a`](https://github.com/retemper/lodestar/commit/fe8724acdda0988ce1fc46dbdbcec802479bf98c)]:
  - @retemper/lodestar-config@0.0.1
  - @retemper/lodestar-types@0.0.1
