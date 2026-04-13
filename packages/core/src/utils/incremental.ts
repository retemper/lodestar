import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { FileSystemProvider, ModuleGraph } from '@retemper/lodestar-types';

const execFileAsync = promisify(execFile);

/**
 * Get changed files from git (unstaged + staged).
 * @param rootDir - absolute path to project root
 * @param base - optional base ref (e.g., 'main') to diff against
 */
async function getChangedFiles(rootDir: string, base?: string): Promise<readonly string[]> {
  const files = new Set<string>();

  if (base) {
    const { stdout } = await execFileAsync('git', ['diff', '--name-only', `${base}...HEAD`], {
      cwd: rootDir,
    });
    for (const line of stdout.trim().split('\n')) {
      if (line) files.add(line);
    }
  } else {
    const { stdout: unstaged } = await execFileAsync('git', ['diff', '--name-only'], {
      cwd: rootDir,
    });
    for (const line of unstaged.trim().split('\n')) {
      if (line) files.add(line);
    }

    const { stdout: staged } = await execFileAsync('git', ['diff', '--name-only', '--cached'], {
      cwd: rootDir,
    });
    for (const line of staged.trim().split('\n')) {
      if (line) files.add(line);
    }

    const { stdout: untracked } = await execFileAsync(
      'git',
      ['ls-files', '--others', '--exclude-standard'],
      { cwd: rootDir },
    );
    for (const line of untracked.trim().split('\n')) {
      if (line) files.add(line);
    }
  }

  return [...files];
}

/**
 * Compute the full impact scope — changed files plus all files that transitively depend on them.
 * @param changedFiles - files that were directly modified
 * @param graph - the full module dependency graph
 */
function computeImpactScope(
  changedFiles: readonly string[],
  graph: ModuleGraph,
): ReadonlySet<string> {
  const scope = new Set<string>(changedFiles);
  const queue = [...changedFiles];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const file = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);

    const node = graph.nodes.get(file);
    if (!node) continue;

    for (const dependent of node.dependents) {
      if (!scope.has(dependent)) {
        scope.add(dependent);
        queue.push(dependent);
      }
    }
  }

  return scope;
}

/**
 * Wrap a FileSystemProvider to filter glob results to only files in scope.
 * @param base - the original FS provider
 * @param scope - set of files to include
 */
function createScopedFsProvider(
  base: FileSystemProvider,
  scope: ReadonlySet<string>,
): FileSystemProvider {
  return {
    ...base,
    async glob(pattern: string): Promise<readonly string[]> {
      const allFiles = await base.glob(pattern);
      return allFiles.filter((f) => scope.has(f));
    },
  };
}

export { getChangedFiles, computeImpactScope, createScopedFsProvider };
