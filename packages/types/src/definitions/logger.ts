/** Log severity levels, ordered from most to least verbose */
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/** Structured logger for CLI and internal diagnostics */
interface Logger {
  /** Verbose diagnostic information (hidden by default) */
  debug(message: string): void;
  /** General operational messages */
  info(message: string): void;
  /** Potential issues that don't prevent execution */
  warn(message: string): void;
  /** Failures that affect correctness */
  error(message: string): void;
}

export type { LogLevel, Logger };
