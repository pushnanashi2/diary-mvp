/**
 * Logger Unit Tests
 * ロガーのユニットテスト
 */

import { logger } from '../../utils/logger.js';

describe('Logger', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      debug: jest.spyOn(console, 'debug').mockImplementation()
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  test('errorメソッドがconsole.errorを呼び出す', () => {
    logger.error('Test error message');
    expect(consoleSpy.error).toHaveBeenCalled();
  });

  test('warnメソッドがconsole.warnを呼び出す', () => {
    logger.warn('Test warning message');
    expect(consoleSpy.warn).toHaveBeenCalled();
  });

  test('infoメソッドがconsole.infoを呼び出す', () => {
    logger.info('Test info message');
    expect(consoleSpy.info).toHaveBeenCalled();
  });

  test('ログメッセージにタイムスタンプが含まれる', () => {
    logger.info('Test');
    const logCall = consoleSpy.info.mock.calls[0][0];
    expect(logCall).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
  });

  test('ログメッセージにレベルが含まれる', () => {
    logger.error('Test');
    const logCall = consoleSpy.error.mock.calls[0][0];
    expect(logCall).toContain('[ERROR]');
  });
});
