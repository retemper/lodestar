# 프로바이더(Providers)

프로바이더(Provider)는 규칙(Rule)에게 프로젝트 데이터에 대한 읽기 전용 접근을 제공합니다. `needs` 배열을 통해 규칙이 필요한 프로바이더를 선언합니다.

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
