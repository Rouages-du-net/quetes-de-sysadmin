// The stories, loaded when they are opened. Each story's chapters are in
// stories/<id>.ts, a module of its own: the build makes it a chunk (with the
// engines only its chapters use), fetched with the story's texts
// (catalogue.json: its text files) the first time the player opens it or
// reaches its machine. What the menu needs about every story is in the
// catalogue (catalogue.ts), not here.
//
// Adding a story: its module in stories/, its place in chapters/index.ts,
// then `npm run catalogue` (tests/catalogue.test.ts checks all three agree).

import { CATALOGUE } from './catalogue';
import { NeedsLoading } from './loading';
import type { Chapter, Story } from './world';
import { loadTexts, type Language } from '../texts';

export const STORY_MODULES = import.meta.glob<{ chapters: Chapter[] }>('./stories/*.ts');

const loaded = new Map<string, Story>();
const loading = new Map<string, Promise<Story>>();

/** Stories already in memory (the tests register the game's: tests/setup.ts). */
export function registerStories(stories: readonly Story[]) {
  for (const s of stories) loaded.set(s.id, s);
}

/** A story if it is loaded. */
export const loadedStory = (id: string): Story | undefined => loaded.get(id);

/** A loaded story; otherwise NeedsLoading (the interface loads it and runs the line again). */
export function storyById(id: string, language?: Language): Story {
  const s = loaded.get(id);
  if (!s) throw new NeedsLoading(`story ${id}`, () => loadStory(id, language));
  return s;
}

/** Loads a story's chapters and its texts in this language (and keeps them). */
export function loadStory(id: string, language?: Language): Promise<Story> {
  const texts = loadTexts(language, `story-${id}`);
  const known = loaded.get(id);
  if (known) return texts.then(() => known);
  let p = loading.get(id);
  if (!p) {
    const info = CATALOGUE.find((s) => s.id === id);
    const module = STORY_MODULES[`./stories/${id}.ts`];
    if (!info || !module) return Promise.reject(new Error(`Unknown story: ${id}`));
    p = module().then((m) => {
      const story: Story = { id, ...(info.after ? { after: [...info.after] } : {}), chapters: m.chapters };
      loaded.set(id, loaded.get(id) ?? story);
      return loaded.get(id)!;
    });
    // A failed download (offline) can be tried again.
    p.catch(() => loading.delete(id));
    loading.set(id, p);
  }
  return Promise.all([p, texts]).then(([s]) => s);
}
