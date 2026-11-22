import { defineConfig } from 'vitest/config';
import { qdsTexts } from './src/texts/plugin.mjs';
import { versionDefine } from './src/version.mjs';

// Engine tests: each quest replayed to the end (tests/*.test.ts). The texts
// come in the same groups as in the game (src/texts/plugin.mjs);
// tests/setup.ts loads them all and registers every story.
export default defineConfig({
  plugins: [qdsTexts()],
  define: versionDefine(),
  // No transform cache on disk: it would keep import.meta.glob's list of
  // story modules (story-registry.ts) and the texts' groups after a story or
  // a text file is added.
  test: { include: ['tests/**/*.test.ts'], setupFiles: ['tests/setup.ts'], fsModuleCache: false },
});
