// The chapters of the story "canteen", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { bootOrder } from '../chapters/boot-order';
import { restartLoop } from '../chapters/restart-loop';
import { slowBoot } from '../chapters/slow-boot';
import { lateDisk } from '../chapters/late-disk';

export const chapters: Chapter[] = [bootOrder, restartLoop, slowBoot, lateDisk];
