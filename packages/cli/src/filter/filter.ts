import type { WrittenConfig, WrittenConfigBlock, ToolAdapter } from '@retemper/lodestar';

/** Check if a rule ID matches any filter pattern (exact or prefix/*) */
function matchesRuleFilter(ruleId: string, patterns: readonly string[]): boolean {
  for (const pattern of patterns) {
    if (pattern === ruleId) return true;
    if (pattern.endsWith('/*') && ruleId.startsWith(pattern.slice(0, -1))) return true;
  }
  return false;
}

/** Filter config blocks to only include specified rules */
function filterRules(config: WrittenConfig, ruleIds: readonly string[]): WrittenConfig {
  const blocks = Array.isArray(config) ? [...config] : [config];
  return blocks.map((block) => {
    if (!block.rules) return block;
    const filtered: Record<string, unknown> = {};
    for (const [id, value] of Object.entries(block.rules)) {
      if (matchesRuleFilter(id, ruleIds)) {
        filtered[id] = value;
      }
    }
    return { ...block, rules: filtered as WrittenConfigBlock['rules'] };
  });
}

/** Filter config blocks to only include specified adapters by name */
function filterAdapters(config: WrittenConfig, adapterNames: readonly string[]): WrittenConfig {
  const blocks = Array.isArray(config) ? [...config] : [config];
  return blocks.map((block) => {
    if (!block.adapters) return block;
    const filtered = block.adapters.filter((a: ToolAdapter) => adapterNames.includes(a.name));
    return { ...block, adapters: filtered };
  });
}

export { filterRules, filterAdapters, matchesRuleFilter };
