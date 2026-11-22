// The chapters of the story "huts", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { centralLogs } from '../chapters/central-logs';
import { journalFull } from '../chapters/journal-full';
import { sshAlerts } from '../chapters/ssh-alerts';

export const chapters: Chapter[] = [centralLogs, journalFull, sshAlerts];
