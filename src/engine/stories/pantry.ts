// The chapters of the story "pantry", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { lostDisk } from '../chapters/lost-disk';
import { spareKey } from '../chapters/spare-key';
import { restoreDrill } from '../chapters/restore-drill';

export const chapters: Chapter[] = [lostDisk, spareKey, restoreDrill];
