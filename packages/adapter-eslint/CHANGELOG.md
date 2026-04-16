# @retemper/lodestar-adapter-eslint

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
