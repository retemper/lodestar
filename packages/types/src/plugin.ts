import type { RuleDefinition } from './rule.js';

/** Plugin — a named collection of rules */
interface Plugin {
  readonly name: string;
  readonly rules: readonly RuleDefinition[];
}

/** Factory function that creates a plugin with user-provided options */
type PluginFactory<TOptions = void> = (options: TOptions) => Plugin;

/** Helper to define a plugin with type inference */
function definePlugin<TOptions = void>(factory: PluginFactory<TOptions>): PluginFactory<TOptions> {
  return factory;
}

/** Helper to define a rule with type inference */
function defineRule<TOptions = Record<string, unknown>>(
  rule: RuleDefinition<TOptions>,
): RuleDefinition<TOptions> {
  return rule;
}

export { definePlugin, defineRule };
export type { Plugin, PluginFactory };
