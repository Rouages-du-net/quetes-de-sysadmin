// The chapters of the story "blood-drive", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/ha';
import type { Chapter } from '../world';
import { noFailover } from '../chapters/no-failover';
import { sickServer } from '../chapters/sick-server';
import { splitBrain } from '../chapters/split-brain';

export const chapters: Chapter[] = [noFailover, sickServer, splitBrain];
