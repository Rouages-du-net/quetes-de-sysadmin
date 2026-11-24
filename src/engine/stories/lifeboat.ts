// The chapters of the story "lifeboat", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine families load with it (see families.ts).
import '../families/inbound';
import '../families/postfix';
import type { Chapter } from '../world';
import { mailboxFull } from '../chapters/mailbox-full';
import { spamTide } from '../chapters/spam-tide';
import { sortingOffice } from '../chapters/sorting-office';

export const chapters: Chapter[] = [mailboxFull, spamTide, sortingOffice];
