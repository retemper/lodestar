import type { RuleDefinition } from './rule';

/** Plugin — a named collection of rules */
interface Plugin {
  /** Unique plugin name, used as the rule ID prefix (e.g., "naming-convention" -> "naming-convention/file-naming") */
  readonly name: string;
  /** Architectural rules provided by this plugin */
  readonly rules: readonly RuleDefinition[];
}

/** Factory function that creates a plugin — may be sync or async */
type PluginFactory<TOptions = void> = (options: TOptions) => Plugin | Promise<Plugin>;

/**
 * Helper to define a plugin with type inference.
 * @param factory - function that receives user options and returns a Plugin (sync or async)
 */
function definePlugin<TOptions = void>(factory: PluginFactory<TOptions>): PluginFactory<TOptions> {
  return factory;
}

/**
 * Helper to define a rule with type inference.
 * @param rule - the rule definition object (name, description, check function, etc.)
 */
function defineRule<TOptions = Record<string, unknown>>(
  rule: RuleDefinition<TOptions>,
): RuleDefinition<TOptions> {
  return rule;
}

export { definePlugin, defineRule };
export type { Plugin, PluginFactory };
