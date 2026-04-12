/** Minimal JSON Schema 7 type for rule option validation */
interface JSONSchema7 {
  readonly type?: string | readonly string[];
  readonly properties?: Readonly<Record<string, JSONSchema7>>;
  readonly required?: readonly string[];
  readonly items?: JSONSchema7;
  readonly enum?: readonly unknown[];
  readonly default?: unknown;
  readonly description?: string;
  readonly additionalProperties?: boolean | JSONSchema7;
}

export type { JSONSchema7 };
