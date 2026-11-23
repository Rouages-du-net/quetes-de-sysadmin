// The chapters of the story "card-catalogue", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/windows';
import type { Chapter } from '../world';
import { comingsAndGoings } from '../chapters/comings-and-goings';
import { stalePassword } from '../chapters/stale-password';
import { unappliedPolicy } from '../chapters/unapplied-policy';
import { dormantAccounts } from '../chapters/dormant-accounts';

export const chapters: Chapter[] = [comingsAndGoings, stalePassword, unappliedPolicy, dormantAccounts];
