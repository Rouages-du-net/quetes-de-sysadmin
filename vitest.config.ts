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
  // Tests that replay every chapter of the game grow with each story and run
  // side by side with the others: 5 s (Vitest's default) is too short on a
  // busy machine.
  // isolate: false: each worker keeps its modules from one test file to the
  // next, so tests/setup.ts loads every text, story and engine family once
  // per worker rather than once per file (about half of the suite's time).
  // The engine keeps no state between games (each test builds its own Shell
  // or Console); a test that changes something global puts it back (see
  // tests/streak.test.ts and TZ). Check with a shuffled order:
  //   npx vitest run --sequence.shuffle.files --sequence.seed=N
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    fsModuleCache: false,
    isolate: false,
    testTimeout: 30_000,
  },
});
