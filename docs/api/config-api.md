# @lodestar/config

Config loading, normalization, and merging.

```ts
import { loadConfigFile, resolveConfig, mergeConfigs } from '@lodestar/config';
```

## `loadConfigFile(dir)`

Load a lodestar config file from the given directory. Searches for `lodestar.config.ts`, `.mjs`, `.js` in order.

```ts
const config = await loadConfigFile('/path/to/project');
// config: WrittenConfig | null
```

## `resolveConfig(written, rootDir)`

Normalize a `WrittenConfig` into a fully resolved `ResolvedConfig`:

```ts
const resolved = resolveConfig(writtenConfig, '/path/to/project');
```

- Expands shorthand rule configs (`'error'` → `{ severity: 'error', options: {} }`)
- Normalizes plugin entries
- Applies defaults for `include`, `exclude`, `baseline`

## `mergeConfigs(base, override)`

Merge two configs. Rules from `override` take precedence. Plugins accumulate.

```ts
const merged = mergeConfigs(rootConfig, packageConfig);
```

## `discoverWorkspaces(rootDir)`

Discover workspace packages from `pnpm-workspace.yaml` or `package.json` workspaces field.

```ts
const packages = await discoverWorkspaces('/monorepo/root');
// [{ name: '@scope/pkg', dir: '/monorepo/root/packages/pkg' }, ...]
```
