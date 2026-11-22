// The chapters of the story "allotments", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/mariadb';
import type { Chapter } from '../world';
import { sleepingConnections } from '../chapters/sleeping-connections';
import { leastPrivilegeChapter } from '../chapters/least-privilege';
import { brokenReplica } from '../chapters/broken-replica';

export const chapters: Chapter[] = [sleepingConnections, leastPrivilegeChapter, brokenReplica];
