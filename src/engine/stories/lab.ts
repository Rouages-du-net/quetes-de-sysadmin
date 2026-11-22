// The chapters of the story "lab", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { fatigue } from '../chapters/tired-disk';
import { newDisk } from '../chapters/new-disk';
import { grow } from '../chapters/more-room';
import { rescue } from '../chapters/stuck-boot';

export const chapters: Chapter[] = [fatigue, newDisk, grow, rescue];
