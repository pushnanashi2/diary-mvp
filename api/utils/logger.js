/**
 * Logging Utility
 * 統一されたロギング機能
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'];

function formatMessage(level, ...args) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${args.join(' ')}`;
}

export const logger = {
  error(...args) {
    if (currentLevel >= LOG_LEVELS.ERROR) {
      console.error(formatMessage('ERROR', ...args));
    }
  },

  warn(...args) {
    if (currentLevel >= LOG_LEVELS.WARN) {
      console.warn(formatMessage('WARN', ...args));
    }
  },

  info(...args) {
    if (currentLevel >= LOG_LEVELS.INFO) {
      console.info(formatMessage('INFO', ...args));
    }
  },

  debug(...args) {
    if (currentLevel >= LOG_LEVELS.DEBUG) {
      console.debug(formatMessage('DEBUG', ...args));
    }
  }
};
