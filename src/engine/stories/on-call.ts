// The chapters of the story "on-call", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { fullDisk } from '../chapters/full-disk';
import { chapterMemory } from '../chapters/memory';
import { inodes } from '../chapters/inodes';
import { clock } from '../chapters/clock';
import { probe } from '../chapters/probe';
import { postMortem } from '../chapters/post-mortem';
import { bottleneck } from '../chapters/bottleneck';

export const chapters: Chapter[] = [fullDisk, chapterMemory, inodes, clock, probe, postMortem, bottleneck];
