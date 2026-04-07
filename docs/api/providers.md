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
