// The chapters of the story "time-machine", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { time } from '../chapters/manuscript';

export const chapters: Chapter[] = [time];
