import { defineConfig } from 'vitest/config';

// Tests du moteur : chaque quête rejouée jusqu'au bout (tests/*.test.ts).
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
