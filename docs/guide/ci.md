---
description: 'Integrate Lodestar into CI/CD pipelines — GitHub Actions, GitLab CI, and other CI systems.'
---

# CI/CD Integration

Lodestar runs as a single CLI command, making it easy to integrate into any CI pipeline.

## Quick Setup

Any violation with severity `'error'` causes `lodestar check` to exit with code 1, failing the pipeline.

```sh
npx lodestar check
```

## GitHub Actions

### Basic

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  lodestar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx lodestar check
```

### JSON Output for Downstream Processing

Use the `--format json` flag to produce machine-readable output:

```yaml
- run: npx lodestar check --format json > lodestar-report.json
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: lodestar-report
    path: lodestar-report.json
```

### Monorepo (Workspace Mode)

```yaml
- run: npx lodestar check --workspace
```

This discovers all packages with a `lodestar.config.ts` and checks each one.

## GitLab CI

```yaml
# .gitlab-ci.yml
lodestar:
  stage: test
  image: node:20
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/
  script:
    - npm ci
    - npx lodestar check
```

## Other CI Systems

Lodestar works anywhere Node.js runs. The pattern is always:

```sh
npm ci              # install dependencies
npx lodestar check  # run checks — exits 1 on errors
```

| System       | Config File               | Notes                         |
| ------------ | ------------------------- | ----------------------------- |
| CircleCI     | `.circleci/config.yml`    | Add as a `run` step           |
| Jenkins      | `Jenkinsfile`             | Use `sh 'npx lodestar check'` |
| Azure DevOps | `azure-pipelines.yml`     | Add as a `script` step        |
| Bitbucket    | `bitbucket-pipelines.yml` | Add as a `script` step        |

## Tips

### Fail Fast

Place `lodestar check` early in your pipeline. Architecture violations are quick to detect and indicate fundamental issues — there's no point running slow integration tests if the dependency graph is broken.

### Cache node_modules

Lodestar's analysis is CPU-bound, not I/O-bound. The biggest time savings come from caching `node_modules` to skip `npm ci`.

### Exit Codes

| Code | Meaning                                   |
| ---- | ----------------------------------------- |
| `0`  | All checks passed (warnings are allowed)  |
| `1`  | At least one `'error'` severity violation |
