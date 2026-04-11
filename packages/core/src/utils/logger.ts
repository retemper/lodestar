import type { LogLevel, Logger } from '@retemper/lodestar-types';

/** Numeric priority for each log level (higher = more severe) */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  error: 3,
  info: 1,
  silent: 4,
  warn: 2,
};

/** Options for creating a logger */
interface CreateLoggerOptions {
  /** Minimum level to emit (default: 'info') */
  readonly level?: LogLevel;
  /** Custom write function (default: process.stderr.write) */
  readonly write?: (message: string) => void;
}

/** Create a logger that writes to stderr with level filtering */
function createLogger(options?: CreateLoggerOptions): Logger {
  const level = options?.level ?? 'info';
  const write = options?.write ?? ((msg: string) => process.stderr.write(msg + '\n'));
  const threshold = LEVEL_PRIORITY[level];

  const emit = (msgLevel: LogLevel, message: string): void => {
    if (LEVEL_PRIORITY[msgLevel] >= threshold) {
      write(message);
    }
  };

  return {
    debug: (message) => emit('debug', message),
    error: (message) => emit('error', message),
    info: (message) => emit('info', message),
    warn: (message) => emit('warn', message),
  };
}

/** No-op logger that discards all messages */
const silentLogger: Logger = {
  debug() {},
  error() {},
  info() {},
  warn() {},
};

export { createLogger, silentLogger };
export type { CreateLoggerOptions };
