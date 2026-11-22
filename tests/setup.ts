// Before each test file: every text of every language, and every story, in
// memory, as the tests import the engine's modules directly (the game loads
// them when they are needed: src/engine/story-registry.ts, src/texts/index.ts).
import { STORIES } from '../src/engine/chapters';
import { registerStories } from '../src/engine/story-registry';
import { loadAllTexts } from '../src/texts';

registerStories(STORIES);
await loadAllTexts();
