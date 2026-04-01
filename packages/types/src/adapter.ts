import type { ResolvedConfig, ResolvedRuleConfig } from './config.js';

/** Adapter transforms lodestar config/rules into external tool format */
interface Adapter<TOutput = unknown> {
  readonly name: string;
  transform(rules: readonly ResolvedRuleConfig[], config: ResolvedConfig): TOutput;
}

export type { Adapter };
