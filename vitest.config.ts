import { defineConfig } from 'vitest/config';

// Engine tests: each quest replayed to the end (tests/*.test.ts).
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
