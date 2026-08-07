---
'@retemper/lodestar-plugin-architecture': patch
---

fix(architecture/layers): resolve tsconfig path aliases

The `architecture/layers` rule resolved imports with `createRelativeResolver()`,
which only handles `./` and `../` specifiers. In projects that import through a
tsconfig path alias — `@/server/db`, the Next.js default — every import failed to
resolve, so the rule reported zero violations while reporting success. A project
could import its database layer straight into a page component and still see a
green check.

The rule now uses `createDefaultResolverChain()`, the same chain the graph
provider uses, so alias and relative imports resolve identically across rules.
