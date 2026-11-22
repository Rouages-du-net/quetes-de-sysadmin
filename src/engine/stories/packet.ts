// The chapters of the story "packet", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { pkg } from '../chapters/lost-packet';

export const chapters: Chapter[] = [pkg];
