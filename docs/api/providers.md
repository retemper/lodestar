# Providers

Providers give rules read-only access to project data. Declare which providers a rule needs via the `needs` array.

## FileSystemProvider

```ts
needs: ['fs'];
```

```ts
interface FileSystemProvider {
  glob(pattern: string): Promise<readonly string[]>;
  readFile(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
  readJson<T>(path: string): Promise<T>;
}
```

## DependencyGraphProvider

```ts
needs: ['graph'];
```

```ts
interface DependencyGraphProvider {
  getDependencies(file: string): Promise<readonly string[]>;
  getDependents(file: string): Promise<readonly string[]>;
  hasCircular(entry: string): Promise<boolean>;
  getModuleGraph(): Promise<ModuleGraph>;
}
```

## ASTProvider

```ts
needs: ['ast'];
```

```ts
interface ASTProvider {
  getSourceFile(path: string): Promise<unknown>;
  getImports(path: string): Promise<readonly ImportInfo[]>;
  getExports(path: string): Promise<readonly ExportInfo[]>;
}
```

## ConfigFileProvider

```ts
needs: ['config'];
```

```ts
interface ConfigFileProvider {
  getPackageJson(dir?: string): Promise<Record<string, unknown>>;
  getTsConfig(dir?: string): Promise<Record<string, unknown>>;
  getCustomConfig<T>(filename: string, dir?: string): Promise<T>;
}
```

---

## Module Resolution

Lodestar uses a pluggable resolver chain to turn import specifiers into file paths. The default chain resolves in this order:

1. **Custom resolvers** (user-provided, if any)
2. **tsconfig paths** (`@app/*` → `src/*` mappings from `tsconfig.json`)
3. **Relative imports** (`./utils`, `../shared`)
4. **node_modules** (bare specifiers like `lodash`, opt-in)

### `ModuleResolver` interface

```ts
interface ResolveContext {
  readonly importer: string; // file containing the import
  readonly source: string; // the import specifier
  readonly knownFiles: ReadonlySet<string>;
}

interface ModuleResolver {
  resolve(ctx: ResolveContext): string | null;
}
```

### Built-in resolvers

| Resolver       | Factory                                          | Description                                                    |
| -------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| Relative       | `createRelativeResolver()`                       | Resolves `./` and `../` imports against known project files    |
| tsconfig paths | `createTsconfigPathsResolver(rootDir, options?)` | Maps path aliases from `tsconfig.json` `compilerOptions.paths` |
| node_modules   | `createNodeModulesResolver(rootDir)`             | Resolves bare specifiers (e.g., `lodash`) via `node_modules`   |
| Chain          | `createResolverChain(resolvers)`                 | Tries each resolver in order, returns the first match          |

### `createDefaultResolverChain(options)`

Build the full resolver chain with sensible defaults:

```ts
import { createDefaultResolverChain } from '@retemper/lodestar-core';

const { resolver, setup } = createDefaultResolverChain({
  rootDir: '/project',
  nodeModules: true, // include node_modules resolution
  tsconfigPath: 'tsconfig.json', // auto-detected if omitted
});

await setup(); // load tsconfig paths
```

| Option            | Type               | Default       | Description                                    |
| ----------------- | ------------------ | ------------- | ---------------------------------------------- |
| `rootDir`         | `string`           | **required**  | Absolute path to project root                  |
| `customResolvers` | `ModuleResolver[]` | `[]`          | Additional resolvers (inserted first in chain) |
| `tsconfigPath`    | `string`           | auto-detected | Path to tsconfig.json                          |
| `nodeModules`     | `boolean`          | `false`       | Include node_modules bare specifier resolution |
