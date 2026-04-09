import type { ArgumentsCamelCase } from 'yargs';
import { resolve } from 'node:path';
import type { Logger } from '@retemper/lodestar';
import { createProviders, createLogger } from '@retemper/lodestar';

/** Options for the impact analysis command */
interface ImpactOptions {
  /** Target file to analyze transitive dependents for */
  readonly file: string;
  /** Output as JSON instead of human-readable text */
  readonly json?: boolean;
  /** Maximum BFS traversal depth (unlimited when omitted) */
  readonly depth?: number;
}

/** A file discovered during BFS with its provenance path */
interface ImpactEntry {
  /** Relative file path of the affected dependent */
  readonly file: string;
  /** BFS depth from the target file (1 = direct dependent) */
  readonly depth: number;
  /** The intermediate file through which the dependency reaches this node */
  readonly via: string | null;
}

/**
 * Perform BFS over the dependents graph starting from the target file.
 * @param targetFile - the file whose transitive impact we want to find
 * @param nodes - full module graph nodes
 * @param maxDepth - optional cap on traversal depth
 */
function collectTransitiveDependents(
  targetFile: string,
  nodes: ReadonlyMap<string, { readonly dependents: readonly string[] }>,
  maxDepth: number | undefined,
): readonly ImpactEntry[] {
  const visited = new Set<string>([targetFile]);
  const results: ImpactEntry[] = [];
  const queue: Array<{
    readonly file: string;
    readonly depth: number;
    readonly via: string | null;
  }> = [];

  const rootNode = nodes.get(targetFile);
  if (!rootNode) return results;

  for (const dep of rootNode.dependents) {
    queue.push({ file: dep, depth: 1, via: null });
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    if (visited.has(current.file)) continue;
    visited.add(current.file);

    results.push({
      file: current.file,
      depth: current.depth,
      via: current.via,
    });

    if (maxDepth !== undefined && current.depth >= maxDepth) continue;

    const node = nodes.get(current.file);
    if (!node) continue;

    for (const dependent of node.dependents) {
      if (!visited.has(dependent)) {
        queue.push({ file: dependent, depth: current.depth + 1, via: current.file });
      }
    }
  }

  return results;
}

/**
 * Print the impact analysis result in human-readable format.
 * @param targetFile - the file being analyzed
 * @param entries - BFS results partitioned into direct and transitive
 */
function printHumanOutput(
  targetFile: string,
  entries: readonly ImpactEntry[],
  logger: Logger,
): void {
  logger.info(`Impact analysis for ${targetFile}\n`);

  const direct = entries.filter((e) => e.depth === 1);
  const transitive = entries.filter((e) => e.depth > 1);

  logger.info(`Direct dependents (${direct.length}):`);
  for (const entry of direct) {
    logger.info(`  ${entry.file}`);
  }

  if (transitive.length > 0) {
    logger.info(`\nTransitive dependents (${transitive.length}):`);
    for (const entry of transitive) {
      const viaSuffix = entry.via ? ` (via ${entry.via})` : '';
      logger.info(`  ${entry.file}${viaSuffix}`);
    }
  }

  logger.info(`\nTotal: ${entries.length} files affected`);
}

/**
 * Print the impact analysis result to stdout as JSON.
 * @param targetFile - the file being analyzed
 * @param entries - BFS results to serialize
 */
function printJsonOutput(targetFile: string, entries: readonly ImpactEntry[]): void {
  const output = {
    target: targetFile,
    directDependents: entries.filter((e) => e.depth === 1).map((e) => e.file),
    transitiveDependents: entries
      .filter((e) => e.depth > 1)
      .map((e) => ({ file: e.file, via: e.via })),
    totalAffected: entries.length,
  };
  process.stdout.write(JSON.stringify(output, null, 2));
}

/**
 * Execute the impact analysis command -- finds all files affected by changing a given file.
 * @param args - parsed CLI arguments including the target file path
 */
async function impactCommand(args: ArgumentsCamelCase<ImpactOptions>): Promise<void> {
  const logger = createLogger();
  const rootDir = resolve(process.cwd());
  const targetFile = String(args.file);

  const providers = createProviders(rootDir);
  const graph = await providers.graph.getModuleGraph();

  if (!graph.nodes.has(targetFile)) {
    logger.error(`File not found in module graph: ${targetFile}`);
    process.exitCode = 1;
    return;
  }

  const entries = collectTransitiveDependents(targetFile, graph.nodes, args.depth);

  if (args.json) {
    printJsonOutput(targetFile, entries);
  } else {
    printHumanOutput(targetFile, entries, logger);
  }
}

export { impactCommand, collectTransitiveDependents };
export type { ImpactOptions, ImpactEntry };
