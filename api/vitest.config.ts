import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Integration suites each boot an in-memory MongoDB, so give them room.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: ['src/**/*.test.ts'],
    // Declared here so `npm test` needs no external configuration. These are
    // throwaway test values; the real ones live in the environment.
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-only-secret-long-enough-to-satisfy-validation',
      MONGODB_URI: 'mongodb://in-memory-server-supplies-the-real-uri/srms_test',
      CORS_ORIGINS: 'http://localhost:5173',
    },
  },
});
