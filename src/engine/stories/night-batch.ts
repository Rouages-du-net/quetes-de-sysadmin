// The chapters of the story "night-batch", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { copybook } from '../chapters/copybook';
import { returnCode } from '../chapters/return-code';
import { lateFile } from '../chapters/late-file';

export const chapters: Chapter[] = [copybook, returnCode, lateFile];
