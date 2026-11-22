// The chapters of the story "staff-room", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { stuckQueue } from '../chapters/stuck-queue';
import { newPrinter } from '../chapters/new-printer';
import { paperTrail } from '../chapters/paper-trail';

export const chapters: Chapter[] = [stuckQueue, newPrinter, paperTrail];
