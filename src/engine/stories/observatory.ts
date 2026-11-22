// The chapters of the story "observatory", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { heavyLoad } from '../chapters/heavy-load';
import { quota } from '../chapters/quota';
import { tooManyFiles } from '../chapters/too-many-files';
import { stuckProcess } from '../chapters/stuck-process';

export const chapters: Chapter[] = [heavyLoad, quota, tooManyFiles, stuckProcess];
