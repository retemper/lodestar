/** Severity levels for log messages */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Simple logger interface usable from any architectural layer */
interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** Format a log entry with timestamp and level */
function formatLogEntry(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
}

/** Default logger that writes to the console */
const logger: Logger = {
  debug(message: string) {
    console.debug(formatLogEntry('debug', message));
  },
  info(message: string) {
    console.info(formatLogEntry('info', message));
  },
  warn(message: string) {
    console.warn(formatLogEntry('warn', message));
  },
  error(message: string) {
    console.error(formatLogEntry('error', message));
  },
};

export { logger };
export type { Logger, LogLevel };
