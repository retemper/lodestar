import type { ResolvedConfig } from '@lodestar/types';

/** A config validation diagnostic */
interface ConfigDiagnostic {
  /** Severity — errors prevent execution, warnings are advisory */
  readonly level: 'error' | 'warning';
  /** Human-readable message */
  readonly message: string;
}

/**
 * Validate a resolved config against the available rules.
 * Returns diagnostics for unknown rules, typos, etc.
 * @param config - resolved config to validate
 * @param availableRuleIds - set of rule IDs from loaded plugins
 */
function validateConfig(
  config: ResolvedConfig,
  availableRuleIds: ReadonlySet<string>,
): readonly ConfigDiagnostic[] {
  const diagnostics: ConfigDiagnostic[] = [];

  for (const [ruleId] of config.rules) {
    if (!availableRuleIds.has(ruleId)) {
      const suggestion = findSimilar(ruleId, availableRuleIds);
      const hint = suggestion ? ` Did you mean "${suggestion}"?` : '';
      diagnostics.push({
        level: 'error',
        message: `Unknown rule "${ruleId}" in config.${hint}`,
      });
    }
  }

  return diagnostics;
}

/**
 * Find the most similar string from a set using Levenshtein distance.
 * Returns null if no reasonable match found (distance > 50% of target length).
 */
function findSimilar(target: string, candidates: ReadonlySet<string>): string | null {
  const maxDistance = Math.floor(target.length * 0.5);
  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const dist = levenshtein(target, candidate);
    if (dist < bestDistance && dist <= maxDistance) {
      bestDistance = dist;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

/** Compute Levenshtein edit distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

export { validateConfig, findSimilar, levenshtein };
export type { ConfigDiagnostic };
