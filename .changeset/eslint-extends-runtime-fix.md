---
"@retemper/lodestar-adapter-eslint": patch
---

Fix `extends` being ignored by `check()`/`fix()` at runtime. `buildFlatConfig()` now resolves `extends` entries (both static and factory forms) and threads `rootDir` through, matching the blocks emitted by `generateConfigFile()`. Also skip `@eslint/js` recommended when `extends` is set, so the shared config controls the baseline rule set. Previously, projects relying on `extends` silently linted zero files (because no flat-config block carried a `files` glob) or surfaced parse errors when an override glob accidentally matched a file the shared parser was supposed to handle.
