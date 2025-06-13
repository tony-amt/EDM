module.exports = {
  testEnvironment: 'node',
  verbose: true,
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    '/dist/',
    'src/index.js'
  ],
  coverageReporters: ['text', 'lcov', 'clover'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ],
  setupFilesAfterEnv: ['./test/setup.js'],
  testTimeout: 10000,
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
}; 