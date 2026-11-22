// The chapters of the story "eraser", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { awakening } from '../chapters/lighthouse';
import { village } from '../chapters/village';
import { root } from '../chapters/root';
import { backup } from '../chapters/backup';

export const chapters: Chapter[] = [awakening, village, root, backup];
