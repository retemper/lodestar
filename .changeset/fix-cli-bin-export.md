---
'@retemper/lodestar': patch
'@retemper/lodestar-cli': patch
---

Fix ERR_PACKAGE_PATH_NOT_EXPORTED when running `lodestar check` with only `@retemper/lodestar` installed. Add `./bin` subpath export to cli package and update bin.js wrapper to use the exported path. Also re-export `createConsoleReporter` and `createJsonReporter` from the lodestar facade package.
