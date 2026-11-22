// The chapters of the story "gazette", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { bareRepo } from '../chapters/bare-repo';
import { rollback } from '../chapters/rollback';
import { greenBlue } from '../chapters/blue-green';
import { canary } from '../chapters/canary';
import { migration } from '../chapters/migration';

export const chapters: Chapter[] = [bareRepo, rollback, greenBlue, canary, migration];
