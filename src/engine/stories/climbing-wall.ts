// The chapters of the story "climbing-wall", in order: the module the game
// loads when the story is opened (see story-registry.ts). Its place among
// the stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/nut';
import type { Chapter } from '../world';
import { lastCut } from '../chapters/last-cut';
import { downInOrder } from '../chapters/down-in-order';
import { oldBattery } from '../chapters/old-battery';

export const chapters: Chapter[] = [lastCut, downInOrder, oldBattery];
