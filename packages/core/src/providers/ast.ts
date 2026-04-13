import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { parseSync } from '@swc/core';
import type { Module, ModuleItem, Expression, Statement } from '@swc/core';
import type { ASTProvider, ImportInfo, ExportInfo } from '@retemper/lodestar-types';
import type { CacheProvider } from '../utils/cache';
import { contentHash } from '../utils/cache';

/**
 * Create an AST provider backed by SWC for TypeScript source analysis.
 * Supports optional disk cache for persisting import/export info across runs.
 * @param rootDir - absolute path; all file paths are resolved relative to this
 * @param diskCache - optional disk cache provider for cross-run persistence
 */
function createASTProvider(rootDir: string, diskCache?: CacheProvider): ASTProvider {
  const memoryCache = new Map<string, Module>();
  const importCache = new Map<string, readonly ImportInfo[]>();
  const exportCache = new Map<string, readonly ExportInfo[]>();

  /** Parse a file and cache the result */
  async function parse(relativePath: string): Promise<Module> {
    const cached = memoryCache.get(relativePath);
    if (cached) return cached;

    const fullPath = join(rootDir, relativePath);
    const source = await readFile(fullPath, 'utf-8');
    const isTsx = relativePath.endsWith('.tsx');

    const module = parseSync(source, {
      syntax: 'typescript',
      tsx: isTsx,
      decorators: true,
    });

    memoryCache.set(relativePath, module);
    return module;
  }

  /** Read file content and compute its hash for disk cache lookup */
  async function readAndHash(relativePath: string): Promise<{ content: string; hash: string }> {
    const fullPath = join(rootDir, relativePath);
    const content = await readFile(fullPath, 'utf-8');
    return { content, hash: contentHash(content) };
  }

  return {
    async getSourceFile(path: string): Promise<unknown> {
      return parse(path);
    },

    async getImports(path: string): Promise<readonly ImportInfo[]> {
      const memoryCached = importCache.get(path);
      if (memoryCached) return memoryCached;

      if (diskCache) {
        const { content, hash } = await readAndHash(path);
        const diskCached = await diskCache.get<ImportInfo[]>('imports', hash);
        if (diskCached) {
          importCache.set(path, diskCached);
          return diskCached;
        }

        const isTsx = path.endsWith('.tsx');
        const module = parseSync(content, { syntax: 'typescript', tsx: isTsx, decorators: true });
        memoryCache.set(path, module);
        const imports = extractImports(module, path);
        importCache.set(path, imports);
        await diskCache.set('imports', hash, imports);
        return imports;
      }

      const module = await parse(path);
      const imports = extractImports(module, path);
      importCache.set(path, imports);
      return imports;
    },

    async getExports(path: string): Promise<readonly ExportInfo[]> {
      const memoryCached = exportCache.get(path);
      if (memoryCached) return memoryCached;

      if (diskCache) {
        const { content, hash } = await readAndHash(path);
        const diskCached = await diskCache.get<ExportInfo[]>('exports', hash);
        if (diskCached) {
          exportCache.set(path, diskCached);
          return diskCached;
        }

        const isTsx = path.endsWith('.tsx');
        const module = parseSync(content, { syntax: 'typescript', tsx: isTsx, decorators: true });
        memoryCache.set(path, module);
        const exports = extractExports(module);
        exportCache.set(path, exports);
        await diskCache.set('exports', hash, exports);
        return exports;
      }

      const module = await parse(path);
      const exports = extractExports(module);
      exportCache.set(path, exports);
      return exports;
    },
  };
}

/**
 * Extract imports from a parsed SWC module — static, require(), and dynamic import().
 * @param module - parsed AST module
 * @param file - relative file path used for location metadata
 */
function extractImports(module: Module, file: string): readonly ImportInfo[] {
  const imports: ImportInfo[] = [];

  for (const item of module.body) {
    if (item.type === 'ImportDeclaration') {
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
        kind: 'static',
      });
      continue;
    }

    visitCallExpressions(item, (call) => {
      const source = extractCallImportSource(call);
      if (!source) return;

      imports.push({
        source: source.value,
        specifiers: [],
        isTypeOnly: false,
        location: { file },
        kind: source.kind,
      });
    });
  }

  return imports;
}

/** Extracted import source from a call expression */
interface CallImportSource {
  readonly value: string;
  readonly kind: 'require' | 'dynamic';
}

/**
 * Extract import source from a require() or import() call expression.
 * Only string literal arguments are supported — dynamic expressions are ignored.
 */
function extractCallImportSource(node: Expression): CallImportSource | null {
  if (node.type !== 'CallExpression') return null;

  const { callee } = node;
  const firstArg = node.arguments[0]?.expression;
  if (!firstArg || firstArg.type !== 'StringLiteral') return null;

  if (callee.type === 'Identifier' && callee.value === 'require') {
    return { value: firstArg.value, kind: 'require' };
  }

  if (callee.type === 'Import') {
    return { value: firstArg.value, kind: 'dynamic' };
  }

  return null;
}

/**
 * Walk an AST node tree to find all call expressions.
 * @param node - root AST node to traverse
 * @param visitor - callback invoked for each CallExpression found
 */
function visitCallExpressions(
  node: ModuleItem | Statement | Expression | Record<string, unknown>,
  visitor: (expr: Expression) => void,
): void {
  if (!node || typeof node !== 'object') return;

  const typed = node as Record<string, unknown>;
  if (typed.type === 'CallExpression') {
    visitor(node as Expression);
  }

  for (const value of Object.values(typed)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child === 'object' && 'type' in child) {
          visitCallExpressions(child as Record<string, unknown>, visitor);
        }
      }
    } else if (value && typeof value === 'object' && 'type' in (value as Record<string, unknown>)) {
      visitCallExpressions(value as Record<string, unknown>, visitor);
    }
  }
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
