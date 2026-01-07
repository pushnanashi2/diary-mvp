module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'api/**/*.js',
    '!api/server.js',
    '!api/scripts/**',
    '!api/config/**',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },
  testMatch: [
    '**/tests/**/*.test.js',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/worker/',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: true,
  maxWorkers: 1,
};
