# @retemper/lodestar-plugin-architecture

## 0.0.5

### Patch Changes

- [#38](https://github.com/retemper/lodestar/pull/38) [`0b4e461`](https://github.com/retemper/lodestar/commit/0b4e46174b82ed2b99dade8f6ed106d7eabe2d3d) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - fix(architecture/layers): resolve tsconfig path aliases

  The `architecture/layers` rule resolved imports with `createRelativeResolver()`,
  which only handles `./` and `../` specifiers. In projects that import through a
  tsconfig path alias — `@/server/db`, the Next.js default — every import failed to
  resolve, so the rule reported zero violations while reporting success. A project
  could import its database layer straight into a page component and still see a
  green check.

  The rule now uses `createDefaultResolverChain()`, the same chain the graph
  provider uses, so alias and relative imports resolve identically across rules.

## 0.0.4

### Patch Changes

- Updated dependencies [[`8e73a10`](https://github.com/retemper/lodestar/commit/8e73a103b11a549675d94d1748b9923c5688e732)]:
  - @retemper/lodestar-core@0.0.4

## 0.0.3

### Patch Changes

- Updated dependencies [[`d216f16`](https://github.com/retemper/lodestar/commit/d216f1686e2e676b406de64a7d20f91a28027526)]:
  - @retemper/lodestar-core@0.0.3

## 0.0.2

### Patch Changes

- Updated dependencies [[`ac335b2`](https://github.com/retemper/lodestar/commit/ac335b2e6bffa066f7469130b628fda85bb90e13)]:
  - @retemper/lodestar-core@0.0.2

## 0.0.1

### Patch Changes

- [#15](https://github.com/retemper/lodestar/pull/15) [`fe8724a`](https://github.com/retemper/lodestar/commit/fe8724acdda0988ce1fc46dbdbcec802479bf98c) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Initial release

- Updated dependencies [[`fe8724a`](https://github.com/retemper/lodestar/commit/fe8724acdda0988ce1fc46dbdbcec802479bf98c)]:
  - @retemper/lodestar-core@0.0.1
  - @retemper/lodestar-types@0.0.1
