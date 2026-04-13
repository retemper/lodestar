---
'@retemper/lodestar': patch
'@retemper/lodestar-cli': patch
---

Break circular dependency between lodestar and cli packages. CLI now imports directly from core, config, and types instead of the lodestar facade. The lodestar package includes cli as a dependency and exposes the `lodestar` bin via a thin wrapper, so users get the CLI by installing `@retemper/lodestar` alone.
