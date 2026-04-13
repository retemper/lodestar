# @retemper/lodestar-core

## 0.0.2

### Patch Changes

- [#18](https://github.com/retemper/lodestar/pull/18) [`ac335b2`](https://github.com/retemper/lodestar/commit/ac335b2e6bffa066f7469130b628fda85bb90e13) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Fix `stripJsonComments` treating `//` inside JSON string literals as comments, which caused `JSON.parse` to crash on tsconfig files containing URLs (e.g. `$schema`). Also filter out directories from `fsProvider.glob()` results to prevent EISDIR errors.

## 0.0.1

### Patch Changes

- [#15](https://github.com/retemper/lodestar/pull/15) [`fe8724a`](https://github.com/retemper/lodestar/commit/fe8724acdda0988ce1fc46dbdbcec802479bf98c) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Initial release

- Updated dependencies [[`fe8724a`](https://github.com/retemper/lodestar/commit/fe8724acdda0988ce1fc46dbdbcec802479bf98c)]:
  - @retemper/lodestar-config@0.0.1
  - @retemper/lodestar-types@0.0.1
