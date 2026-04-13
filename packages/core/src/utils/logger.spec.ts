import { describe, it, expect, vi } from 'vitest';
import { createLogger, silentLogger } from './logger';

describe('createLogger', () => {
  it('outputs info and above at default level (info)', () => {
    const write = vi.fn();
    const logger = createLogger({ write });

    logger.debug('debug');
    logger.info('info');
    logger.warn('warnings');
    logger.error('errors');

    expect(write).not.toHaveBeenCalledWith('debug');
    expect(write).toHaveBeenCalledWith('info');
    expect(write).toHaveBeenCalledWith('warnings');
    expect(write).toHaveBeenCalledWith('errors');
    expect(write).toHaveBeenCalledTimes(3);
  });

  it('outputs all messages at debug level', () => {
    const write = vi.fn();
    const logger = createLogger({ level: 'debug', write });

    logger.debug('debug');
    logger.info('info');

    expect(write).toHaveBeenCalledWith('debug');
    expect(write).toHaveBeenCalledWith('info');
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('outputs only error at error level', () => {
    const write = vi.fn();
    const logger = createLogger({ level: 'error', write });

    logger.debug('debug');
    logger.info('info');
    logger.warn('warnings');
    logger.error('errors');

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('errors');
  });

  it('outputs nothing at silent level', () => {
    const write = vi.fn();
    const logger = createLogger({ level: 'silent', write });

    logger.debug('debug');
    logger.info('info');
    logger.warn('warnings');
    logger.error('errors');

    expect(write).not.toHaveBeenCalled();
  });

  it('outputs only warn and error at warn level', () => {
    const write = vi.fn();
    const logger = createLogger({ level: 'warn', write });

    logger.debug('debug');
    logger.info('info');
    logger.warn('warnings');
    logger.error('errors');

    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledWith('warnings');
    expect(write).toHaveBeenCalledWith('errors');
  });

  it('outputs to stderr when write option is absent', () => {
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = createLogger();

    logger.info('test message');

    expect(stderrWrite).toHaveBeenCalledWith('test message\n');
    stderrWrite.mockRestore();
  });

  it('defaults to info level when created without options', () => {
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = createLogger();

    logger.debug('should not appear');
    expect(stderrWrite).not.toHaveBeenCalled();

    logger.info('should appear');
    expect(stderrWrite).toHaveBeenCalledTimes(1);
    stderrWrite.mockRestore();
  });
});

describe('silentLogger', () => {
  it('all methods are no-op', () => {
    expect(() => {
      silentLogger.debug('a');
      silentLogger.info('b');
      silentLogger.warn('c');
      silentLogger.error('d');
    }).not.toThrow();
  });
});
