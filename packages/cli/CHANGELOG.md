# @retemper/lodestar-cli

## 0.0.4

### Patch Changes

- [#25](https://github.com/retemper/lodestar/pull/25) [`843f20e`](https://github.com/retemper/lodestar/commit/843f20e018d388a45cc63f7216c7f67c96bea344) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Break circular dependency between lodestar and cli packages. CLI now imports directly from core, config, and types instead of the lodestar facade. The lodestar package includes cli as a dependency and exposes the `lodestar` bin via a thin wrapper, so users get the CLI by installing `@retemper/lodestar` alone.

## 0.0.3

### Patch Changes

- Updated dependencies []:
  - @retemper/lodestar@0.0.3

## 0.0.2

### Patch Changes

- Updated dependencies []:
  - @retemper/lodestar@0.0.2

## 0.0.1

### Patch Changes

- [#15](https://github.com/retemper/lodestar/pull/15) [`fe8724a`](https://github.com/retemper/lodestar/commit/fe8724acdda0988ce1fc46dbdbcec802479bf98c) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Initial release

- Updated dependencies [[`fe8724a`](https://github.com/retemper/lodestar/commit/fe8724acdda0988ce1fc46dbdbcec802479bf98c)]:
  - @retemper/lodestar@0.0.1
  - @retemper/lodestar-reporter-junit@0.0.1
  - @retemper/lodestar-reporter-sarif@0.0.1
