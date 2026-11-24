// The chapters of the story "community-centre", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/lftp';
import type { Chapter } from '../world';
import { keys } from '../chapters/keys';
import { jump } from '../chapters/jump';
import { tunnel } from '../chapters/tunnel';
import { transfers } from '../chapters/transfers';
import { host } from '../chapters/web-host';

export const chapters: Chapter[] = [keys, jump, tunnel, transfers, host];
