---
"@retemper/lodestar-core": patch
---

Fix `stripJsonComments` treating `//` inside JSON string literals as comments, which caused `JSON.parse` to crash on tsconfig files containing URLs (e.g. `$schema`). Also filter out directories from `fsProvider.glob()` results to prevent EISDIR errors.
