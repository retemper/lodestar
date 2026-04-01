import type { PluginEntry, WrittenRuleConfig } from './config.js';
import type { Severity } from './rule.js';

/** Preset — an opinionated bundle of plugins + rules + adapter settings */
interface Preset {
  readonly name: string;
  readonly plugins?: readonly PluginEntry[];
  readonly rules?: Readonly<Record<string, Severity | WrittenRuleConfig>>;
  readonly adapters?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

/** Helper to define a preset with type inference */
function definePreset(preset: Preset): Preset {
  return preset;
}

export { definePreset };
export type { Preset };
