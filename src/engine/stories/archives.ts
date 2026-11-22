// The chapters of the story "archives", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { archives } from '../chapters/archives';
import { versions } from '../chapters/versions';

export const chapters: Chapter[] = [archives, versions];
