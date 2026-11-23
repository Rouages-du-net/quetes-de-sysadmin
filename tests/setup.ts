// Before each test file: every text of every language, every story, every
// engine family and the manual's examples in memory, as the tests import the engine's modules directly
// (the game loads them when they are needed: src/engine/story-registry.ts,
// src/engine/families.ts, src/texts/index.ts).
import { STORIES } from '../src/engine/chapters';
import { registerStories } from '../src/engine/story-registry';
import { loadAllTexts } from '../src/texts';
import { FAMILIES } from '../src/engine/families';
import { loadExamples } from '../src/engine/commands/manual';

registerStories(STORIES);
await loadAllTexts();
await Promise.all([...Object.values(FAMILIES).map((load) => load()), loadExamples()]);
