import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['services/**/*.js', 'utils/**/*.js', 'middleware/**/*.js'],
    },
    setupFiles: ['tests/setup.js'],
  },
});
