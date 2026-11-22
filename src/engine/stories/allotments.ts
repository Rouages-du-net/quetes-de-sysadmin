// The chapters of the story "allotments", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// It also brings MariaDB's client programs (see commands/mariadb.ts): they
// load with the story, not with the first visit.
import type { Chapter } from '../world';
import { sleepingConnections } from '../chapters/sleeping-connections';
import { leastPrivilegeChapter } from '../chapters/least-privilege';
import { brokenReplica } from '../chapters/broken-replica';
import { setMariadbPrograms } from '../commands/mariadb';
import { MARIADB_PROGRAMS } from '../mariadb-client';

setMariadbPrograms(MARIADB_PROGRAMS);

export const chapters: Chapter[] = [sleepingConnections, leastPrivilegeChapter, brokenReplica];
