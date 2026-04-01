import type { ASTProvider, ImportInfo, ExportInfo } from '@lodestar/types';

/** Create an AST provider for TypeScript source analysis */
function createASTProvider(rootDir: string): ASTProvider {
  const _rootDir = rootDir;

  return {
    async getSourceFile(_path: string): Promise<unknown> {
      // TODO: Implement via TypeScript compiler API
      return null;
    },

    async getImports(_path: string): Promise<readonly ImportInfo[]> {
      // TODO: Parse import declarations from AST
      return [];
    },

    async getExports(_path: string): Promise<readonly ExportInfo[]> {
      // TODO: Parse export declarations from AST
      return [];
    },
  };
}

export { createASTProvider };
