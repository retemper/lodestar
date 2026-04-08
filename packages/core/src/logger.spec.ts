import { describe, it, expect, vi } from 'vitest';
import { createLogger, silentLogger } from './logger';

describe('createLogger', () => {
  it('기본 레벨(info)에서 info 이상을 출력한다', () => {
    const write = vi.fn();
    const logger = createLogger({ write });

    logger.debug('디버그');
    logger.info('정보');
    logger.warn('경고');
    logger.error('에러');

    expect(write).not.toHaveBeenCalledWith('디버그');
    expect(write).toHaveBeenCalledWith('정보');
    expect(write).toHaveBeenCalledWith('경고');
    expect(write).toHaveBeenCalledWith('에러');
    expect(write).toHaveBeenCalledTimes(3);
  });

  it('debug 레벨에서 모든 메시지를 출력한다', () => {
    const write = vi.fn();
    const logger = createLogger({ level: 'debug', write });

    logger.debug('디버그');
    logger.info('정보');

    expect(write).toHaveBeenCalledWith('디버그');
    expect(write).toHaveBeenCalledWith('정보');
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('error 레벨에서 error만 출력한다', () => {
    const write = vi.fn();
    const logger = createLogger({ level: 'error', write });

    logger.debug('디버그');
    logger.info('정보');
    logger.warn('경고');
    logger.error('에러');

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('에러');
  });

  it('silent 레벨에서 아무것도 출력하지 않는다', () => {
    const write = vi.fn();
    const logger = createLogger({ level: 'silent', write });

    logger.debug('디버그');
    logger.info('정보');
    logger.warn('경고');
    logger.error('에러');

    expect(write).not.toHaveBeenCalled();
  });

  it('warn 레벨에서 warn과 error만 출력한다', () => {
    const write = vi.fn();
    const logger = createLogger({ level: 'warn', write });

    logger.debug('디버그');
    logger.info('정보');
    logger.warn('경고');
    logger.error('에러');

    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledWith('경고');
    expect(write).toHaveBeenCalledWith('에러');
  });
});

describe('silentLogger', () => {
  it('모든 메서드가 no-op이다', () => {
    expect(() => {
      silentLogger.debug('a');
      silentLogger.info('b');
      silentLogger.warn('c');
      silentLogger.error('d');
    }).not.toThrow();
  });
});
