import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { parseSync } from '@swc/core';
import type { Module, ModuleItem } from '@swc/core';
import type { ASTProvider, ImportInfo, ExportInfo } from '@lodestar/types';

/**
 * Create an AST provider backed by SWC for TypeScript source analysis.
 * @param rootDir - absolute path; all file paths are resolved relative to this
 */
function createASTProvider(rootDir: string): ASTProvider {
  const cache = new Map<string, Module>();

  /** Parse a file and cache the result */
  async function parse(relativePath: string): Promise<Module> {
    const cached = cache.get(relativePath);
    if (cached) return cached;

    const fullPath = join(rootDir, relativePath);
    const source = await readFile(fullPath, 'utf-8');
    const isTsx = relativePath.endsWith('.tsx');

    const module = parseSync(source, {
      syntax: 'typescript',
      tsx: isTsx,
      decorators: true,
    });

    cache.set(relativePath, module);
    return module;
  }

  return {
    async getSourceFile(path: string): Promise<unknown> {
      return parse(path);
    },

    async getImports(path: string): Promise<readonly ImportInfo[]> {
      const module = await parse(path);
      return extractImports(module, path);
    },

    async getExports(path: string): Promise<readonly ExportInfo[]> {
      const module = await parse(path);
      return extractExports(module);
    },
  };
}

/**
 * Extract imports from a parsed SWC module.
 * @param module - parsed AST module
 * @param file - relative file path used for location metadata
 */
function extractImports(module: Module, file: string): readonly ImportInfo[] {
  const imports: ImportInfo[] = [];

  for (const item of module.body) {
    if (item.type !== 'ImportDeclaration') continue;

    const specifiers: string[] = [];
    for (const s of item.specifiers) {
      if (s.type === 'ImportDefaultSpecifier') {
        specifiers.push(s.local.value);
      } else if (s.type === 'ImportNamespaceSpecifier') {
        specifiers.push(`* as ${s.local.value}`);
      } else if (s.type === 'ImportSpecifier') {
        specifiers.push(s.local.value);
      }
    }

    imports.push({
      source: item.source.value,
      specifiers,
      isTypeOnly: item.typeOnly,
      location: { file },
    });
  }

  return imports;
}

/**
 * Extract exports from a parsed SWC module.
 * @param module - parsed AST module to scan for export declarations
 */
function extractExports(module: Module): readonly ExportInfo[] {
  const exports: ExportInfo[] = [];

  for (const item of module.body) {
    processExportItem(item, exports);
  }

  return exports;
}

/**
 * Process a single module item for export declarations.
 * @param item - a top-level AST node that may be an export
 * @param exports - accumulator array to push discovered exports into
 */
function processExportItem(item: ModuleItem, exports: ExportInfo[]): void {
  if (item.type === 'ExportDefaultDeclaration' || item.type === 'ExportDefaultExpression') {
    exports.push({ name: 'default', isTypeOnly: false, isDefault: true });
    return;
  }

  if (item.type === 'ExportNamedDeclaration') {
    const source =
      'source' in item && item.source ? (item.source as { value: string }).value : undefined;

    for (const spec of item.specifiers) {
      if (spec.type === 'ExportSpecifier') {
        const exported = spec.exported;
        const name = exported ? getValue(exported) : getValue(spec.orig);
        exports.push({
          name,
          isTypeOnly: item.typeOnly || ('isTypeOnly' in spec && Boolean(spec.isTypeOnly)),
          isDefault: false,
          source,
        });
      } else if (spec.type === 'ExportNamespaceSpecifier') {
        exports.push({
          name: getValue(spec.name),
          isTypeOnly: false,
          isDefault: false,
          source,
        });
      }
    }
    return;
  }

  if (item.type === 'ExportDeclaration') {
    const decl = item.declaration;
    switch (decl.type) {
      case 'FunctionDeclaration':
        exports.push({ name: decl.identifier.value, isTypeOnly: false, isDefault: false });
        break;
      case 'ClassDeclaration':
        exports.push({ name: decl.identifier.value, isTypeOnly: false, isDefault: false });
        break;
      case 'VariableDeclaration':
        for (const d of decl.declarations) {
          if (d.id.type === 'Identifier') {
            exports.push({ name: d.id.value, isTypeOnly: false, isDefault: false });
          }
        }
        break;
      case 'TsInterfaceDeclaration':
        exports.push({ name: decl.id.value, isTypeOnly: true, isDefault: false });
        break;
      case 'TsTypeAliasDeclaration':
        exports.push({ name: decl.id.value, isTypeOnly: true, isDefault: false });
        break;
      case 'TsEnumDeclaration':
        exports.push({ name: decl.id.value, isTypeOnly: false, isDefault: false });
        break;
      default:
        break;
    }
  }
}

/** Extract string value from an SWC identifier or string literal */
function getValue(node: { type: string; value: string }): string {
  return node.value;
}

export { createASTProvider };
