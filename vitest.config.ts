import { defineConfig } from 'vitest/config';
import { qdsTexts } from './src/texts/plugin.mjs';

// Engine tests: each quest replayed to the end (tests/*.test.ts). The texts
// come in the same groups as in the game (src/texts/plugin.mjs);
// tests/setup.ts loads them all and registers every story.
export default defineConfig({
  plugins: [qdsTexts()],
  test: { include: ['tests/**/*.test.ts'], setupFiles: ['tests/setup.ts'] },
});
