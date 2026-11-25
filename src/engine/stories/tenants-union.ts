// The chapters of the story "tenants-union", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine families load with it (see families.ts).
import '../families/secrets';
import '../families/postgres';
import type { Chapter } from '../world';
import { outOfTheOpen } from '../chapters/out-of-the-open';
import { keysChangeHands } from '../chapters/keys-change-hands';

export const chapters: Chapter[] = [outOfTheOpen, keysChangeHands];
