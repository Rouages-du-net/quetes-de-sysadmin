// The chapters of the story "music-school", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/windows';
import type { Chapter } from '../world';
import { twoLocks } from '../chapters/two-locks';
import { serviceLogon } from '../chapters/service-logon';
import { logFlood } from '../chapters/log-flood';
import { silentBackup } from '../chapters/silent-backup';

export const chapters: Chapter[] = [twoLocks, serviceLogon, logFlood, silentBackup];
