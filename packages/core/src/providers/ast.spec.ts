import { afterAll, describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createASTProvider } from './ast';

/** Temporary directory paths for testing */
const dirs: string[] = [];

/** Creates TypeScript files in a temporary directory and returns an AST provider */
async function setupFixture(
  files: Record<string, string>,
): Promise<{ rootDir: string; provider: ReturnType<typeof createASTProvider> }> {
  const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-ast-test-'));
  dirs.push(rootDir);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(rootDir, relativePath);
    const dir = dirname(fullPath);
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
  }

  return { rootDir, provider: createASTProvider(rootDir) };
}

afterAll(async () => {
  for (const dir of dirs) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('createASTProvider', () => {
  describe('getSourceFile', () => {
    it('TypeScript 파일을 파싱하여 AST Module을 반환한다', async () => {
      const { provider } = await setupFixture({
        'sample.ts': 'const x = 1;',
      });

      const result = await provider.getSourceFile('sample.ts');

      expect(result).toHaveProperty('type', 'Module');
      expect(result).toHaveProperty('body');
    });

    it('TSX 파일을 파싱할 수 있다', async () => {
      const { provider } = await setupFixture({
        'App.tsx': 'const App = () => <div>Hello</div>;\nexport default App;',
      });

      const result = await provider.getSourceFile('App.tsx');

      expect(result).toHaveProperty('type', 'Module');
    });

    it('동일 파일을 두 번 파싱하면 캐시된 결과를 반환한다', async () => {
      const { provider } = await setupFixture({
        'cached.ts': 'const a = 1;',
      });

      const first = await provider.getSourceFile('cached.ts');
      const second = await provider.getSourceFile('cached.ts');

      expect(first).toBe(second);
    });
  });

  describe('getImports', () => {
    it('import 선언을 추출한다', async () => {
      const { provider } = await setupFixture({
        'imports.ts': `
import { foo } from './foo';
import bar from './bar';
import * as utils from './utils';
`,
      });

      const imports = await provider.getImports('imports.ts');

      expect(imports).toHaveLength(3);
      expect(imports[0].source).toBe('./foo');
      expect(imports[0].specifiers).toStrictEqual(['foo']);
      expect(imports[0].isTypeOnly).toBe(false);
      expect(imports[0].location.file).toBe('imports.ts');

      expect(imports[1].source).toBe('./bar');
      expect(imports[1].specifiers).toStrictEqual(['bar']);

      expect(imports[2].source).toBe('./utils');
      expect(imports[2].specifiers).toStrictEqual(['* as utils']);
    });

    it('type-only import를 감지한다', async () => {
      const { provider } = await setupFixture({
        'type-imports.ts': `
import type { Foo } from './foo';
`,
      });

      const imports = await provider.getImports('type-imports.ts');

      expect(imports).toHaveLength(1);
      expect(imports[0].isTypeOnly).toBe(true);
    });

    it('import가 없는 파일은 빈 배열을 반환한다', async () => {
      const { provider } = await setupFixture({
        'no-imports.ts': 'const x = 1;',
      });

      const imports = await provider.getImports('no-imports.ts');

      expect(imports).toStrictEqual([]);
    });

    it('named specifier가 여러 개인 import를 추출한다', async () => {
      const { provider } = await setupFixture({
        'multi.ts': `import { a, b, c } from './abc';`,
      });

      const imports = await provider.getImports('multi.ts');

      expect(imports[0].specifiers).toStrictEqual(['a', 'b', 'c']);
    });
  });

  describe('getExports', () => {
    it('export default declaration을 추출한다', async () => {
      const { provider } = await setupFixture({
        'default-decl.ts': `export default function main() {}`,
      });

      const exports = await provider.getExports('default-decl.ts');

      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('default');
      expect(exports[0].isDefault).toBe(true);
      expect(exports[0].isTypeOnly).toBe(false);
    });

    it('export default expression을 추출한다', async () => {
      const { provider } = await setupFixture({
        'default-expr.ts': `const x = 1;\nexport default x;`,
      });

      const exports = await provider.getExports('default-expr.ts');

      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('default');
      expect(exports[0].isDefault).toBe(true);
    });

    it('named export specifier를 추출한다', async () => {
      const { provider } = await setupFixture({
        'named.ts': `const a = 1;\nconst b = 2;\nexport { a, b };`,
      });

      const exports = await provider.getExports('named.ts');

      expect(exports).toHaveLength(2);
      expect(exports[0].name).toBe('a');
      expect(exports[0].isDefault).toBe(false);
      expect(exports[1].name).toBe('b');
    });

    it('re-export의 source를 포함한다', async () => {
      const { provider } = await setupFixture({
        'reexport.ts': `export { foo } from './foo';`,
      });

      const exports = await provider.getExports('reexport.ts');

      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('foo');
      expect(exports[0].source).toBe('./foo');
    });

    it('export function 선언을 추출한다', async () => {
      const { provider } = await setupFixture({
        'func.ts': `export function myFunc() { return 1; }`,
      });

      const exports = await provider.getExports('func.ts');

      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('myFunc');
      expect(exports[0].isTypeOnly).toBe(false);
    });

    it('export class 선언을 추출한다', async () => {
      const { provider } = await setupFixture({
        'cls.ts': `export class MyClass {}`,
      });

      const exports = await provider.getExports('cls.ts');

      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('MyClass');
      expect(exports[0].isTypeOnly).toBe(false);
    });

    it('export const 변수 선언을 추출한다', async () => {
      const { provider } = await setupFixture({
        'vars.ts': `export const x = 1, y = 2;`,
      });

      const exports = await provider.getExports('vars.ts');

      expect(exports).toHaveLength(2);
      expect(exports[0].name).toBe('x');
      expect(exports[1].name).toBe('y');
    });

    it('export interface 선언을 type-only로 추출한다', async () => {
      const { provider } = await setupFixture({
        'iface.ts': `export interface MyInterface { value: string; }`,
      });

      const exports = await provider.getExports('iface.ts');

      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('MyInterface');
      expect(exports[0].isTypeOnly).toBe(true);
    });

    it('export type alias 선언을 type-only로 추출한다', async () => {
      const { provider } = await setupFixture({
        'type-alias.ts': `export type MyType = string | number;`,
      });

      const exports = await provider.getExports('type-alias.ts');

      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('MyType');
      expect(exports[0].isTypeOnly).toBe(true);
    });

    it('export enum 선언을 추출한다', async () => {
      const { provider } = await setupFixture({
        'enums.ts': `export enum Color { Red, Green, Blue }`,
      });

      const exports = await provider.getExports('enums.ts');

      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('Color');
      expect(exports[0].isTypeOnly).toBe(false);
    });

    it('export namespace specifier를 추출한다', async () => {
      const { provider } = await setupFixture({
        'ns.ts': `export * as ns from './module';`,
      });

      const exports = await provider.getExports('ns.ts');

      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('ns');
      expect(exports[0].isTypeOnly).toBe(false);
      expect(exports[0].source).toBe('./module');
    });

    it('type-only named export specifier를 감지한다', async () => {
      const { provider } = await setupFixture({
        'type-export.ts': `export type { Foo } from './foo';`,
      });

      const exports = await provider.getExports('type-export.ts');

      expect(exports).toHaveLength(1);
      expect(exports[0].isTypeOnly).toBe(true);
    });

    it('알 수 없는 export declaration 타입은 무시한다', async () => {
      const { provider } = await setupFixture({
        'unknown-decl.ts': `export declare module 'foo' { }`,
      });

      const exports = await provider.getExports('unknown-decl.ts');

      // TsModuleDeclaration is handled by the switch default case and ignored
      expect(exports).toStrictEqual([]);
    });

    it('export가 없는 파일은 빈 배열을 반환한다', async () => {
      const { provider } = await setupFixture({
        'no-exports.ts': 'const x = 1;',
      });

      const exports = await provider.getExports('no-exports.ts');

      expect(exports).toStrictEqual([]);
    });

    it('destructuring export 변수 선언은 Identifier가 아니므로 무시한다', async () => {
      const { provider } = await setupFixture({
        'destruct.ts': `const obj = { a: 1, b: 2 };\nexport const { a, b } = obj;`,
      });

      const exports = await provider.getExports('destruct.ts');

      // ObjectPattern is not an Identifier, so it is not extracted
      expect(exports).toStrictEqual([]);
    });

    it('renamed export specifier의 exported 이름을 사용한다', async () => {
      const { provider } = await setupFixture({
        'renamed.ts': `const original = 1;\nexport { original as renamed };`,
      });

      const exports = await provider.getExports('renamed.ts');

      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('renamed');
    });
  });
});
