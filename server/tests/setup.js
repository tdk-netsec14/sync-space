/**
 * server/tests/setup.js
 *
 * Jest global setup/teardown for backend integration tests.
 * Uses the dedicated local MongoDB test database so tests never
 * touch the development or production database.
 *
 * The TEST_DB_URI can be overridden via environment variable.
 * Default: mongodb://127.0.0.1:27017/syncspace_test
 */

const mongoose = require('mongoose');

const TEST_DB_URI = process.env.TEST_DB_URI || 'mongodb://127.0.0.1:27017/syncspace_test';

// Set test environment so auth cookies use non-secure flags and
// stack traces are visible (not hidden in production mode).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'jest-test-secret-do-not-use-in-prod';
process.env.JWT_ACCESS_SECRET = 'jest-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'jest-test-refresh-secret';
process.env.CSRF_SECRET = 'jest-test-csrf-secret';
process.env.AI_ENABLED = 'true';

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000
  });
});

afterEach(async () => {
  // Wipe all collections between tests for isolation
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((col) => col.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});
