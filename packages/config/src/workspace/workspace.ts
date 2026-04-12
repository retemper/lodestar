import { readFile } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { glob } from 'tinyglobby';

/** Discovered workspace package */
interface WorkspacePackage {
  /** Package name from package.json, or directory basename as fallback */
  readonly name: string;
  /** Absolute path to the package directory */
  readonly dir: string;
}

/**
 * Discover workspace packages from pnpm-workspace.yaml or package.json workspaces.
 * @param rootDir - absolute path to the monorepo root
 */
async function discoverWorkspaces(rootDir: string): Promise<readonly WorkspacePackage[]> {
  const resolvedRoot = resolve(rootDir);

  const patterns = await readWorkspacePatterns(resolvedRoot);
  if (patterns.length === 0) return [];

  const dirs = await expandWorkspacePatterns(resolvedRoot, patterns);
  const packages = await Promise.all(dirs.map((dir) => toWorkspacePackage(dir)));

  return packages;
}

/**
 * Read workspace glob patterns from pnpm-workspace.yaml or package.json.
 * @param rootDir - absolute path to the monorepo root
 */
async function readWorkspacePatterns(rootDir: string): Promise<readonly string[]> {
  const pnpmPatterns = await readPnpmWorkspacePatterns(rootDir);
  if (pnpmPatterns.length > 0) return pnpmPatterns;

  return readPackageJsonWorkspacePatterns(rootDir);
}

/**
 * Parse pnpm-workspace.yaml for package patterns.
 * @param rootDir - directory containing pnpm-workspace.yaml
 */
async function readPnpmWorkspacePatterns(rootDir: string): Promise<readonly string[]> {
  try {
    const content = await readFile(join(rootDir, 'pnpm-workspace.yaml'), 'utf-8');
    return parsePnpmWorkspaceYaml(content);
  } catch {
    return [];
  }
}

/**
 * Extract packages patterns from pnpm-workspace.yaml content without a YAML parser.
 * @param content - raw YAML string to parse
 */
function parsePnpmWorkspaceYaml(content: string): readonly string[] {
  const lines = content.split('\n');
  const patterns: string[] = [];
  const packagesHeaderIndex = lines.findIndex((line) => /^packages\s*:/.test(line.trim()));

  if (packagesHeaderIndex === -1) return [];

  for (const line of lines.slice(packagesHeaderIndex + 1)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    if (!trimmed.startsWith('-')) break;
    const pattern = trimmed.replace(/^-\s*['"]?/, '').replace(/['"]?\s*$/, '');
    if (pattern.length > 0 && !pattern.startsWith('!')) {
      patterns.push(pattern);
    }
  }

  return patterns;
}

/**
 * Read workspace patterns from package.json workspaces field.
 * @param rootDir - directory containing the root package.json
 */
async function readPackageJsonWorkspacePatterns(rootDir: string): Promise<readonly string[]> {
  try {
    const content = await readFile(join(rootDir, 'package.json'), 'utf-8');
    const pkg: unknown = JSON.parse(content);
    if (!isPackageJson(pkg)) return [];
    const { workspaces } = pkg;
    if (Array.isArray(workspaces))
      return workspaces.filter((w): w is string => typeof w === 'string');
    if (isWorkspacesObject(workspaces)) return workspaces.packages;
    return [];
  } catch {
    return [];
  }
}

/**
 * Expand glob patterns into absolute directory paths.
 * @param rootDir - base directory for glob resolution
 * @param patterns - workspace glob patterns to expand
 */
async function expandWorkspacePatterns(
  rootDir: string,
  patterns: readonly string[],
): Promise<readonly string[]> {
  const expanded = await glob(
    patterns.map((p) => (p.endsWith('/*') || p.endsWith('/**') ? p : `${p}`)),
    { cwd: rootDir, onlyDirectories: true, absolute: true, deep: 1 },
  );

  return expanded.sort();
}

/**
 * Read package.json name for a workspace directory.
 * @param dir - absolute path to the workspace package directory
 */
async function toWorkspacePackage(dir: string): Promise<WorkspacePackage> {
  try {
    const content = await readFile(join(dir, 'package.json'), 'utf-8');
    const pkg: unknown = JSON.parse(content);
    if (isPackageJson(pkg) && typeof pkg.name === 'string') {
      return { name: pkg.name, dir };
    }
  } catch {
    // Fall through to use directory basename
  }

  return { name: basename(dir), dir };
}

/** Type guard for package.json-like objects */
function isPackageJson(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Type guard for workspaces object format { packages: string[] } */
function isWorkspacesObject(value: unknown): value is { packages: string[] } {
  return isPackageJson(value) && Array.isArray((value as Record<string, unknown>).packages);
}

export { discoverWorkspaces, readWorkspacePatterns, parsePnpmWorkspaceYaml };
export type { WorkspacePackage };
