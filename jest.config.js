/**
 * jest.config.js
 *
 * Backend Jest configuration for SyncSpace integration + unit tests.
 *
 * - testEnvironment: node  (no DOM needed for server tests)
 * - setupFilesAfterEnv: runs setup.js before each test suite — connects
 *   to the local test MongoDB and registers beforeAll/afterEach/afterAll hooks
 * - testMatch: only picks up files in server/tests/
 * - testTimeout: 30 seconds (supertest + DB ops can be slow on first run)
 * - forceExit: ensures Jest exits even if a stray open handle lingers
 */
module.exports = {
  testEnvironment: 'node',

  // Runs before each test FILE — sets up Mongoose connection & teardown hooks
  setupFilesAfterEnv: ['<rootDir>/server/tests/setup.js'],

  testMatch: ['<rootDir>/server/tests/**/*.test.js'],

  verbose: true,
  testTimeout: 30000,
  forceExit: true,

  transformIgnorePatterns: ['/node_modules/'],

  collectCoverageFrom: [
    'server/**/*.js',
    '!server/tests/**',
    '!server/index.js'
  ]
};
