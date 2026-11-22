// The chapters of the story "theatre", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { tooManyClients } from '../chapters/too-many-clients';
import { slowQuery } from '../chapters/slow-query';
import { readOnlyChapter } from '../chapters/read-only';
import { failover } from '../chapters/failover';

export const chapters: Chapter[] = [tooManyClients, slowQuery, readOnlyChapter, failover];
