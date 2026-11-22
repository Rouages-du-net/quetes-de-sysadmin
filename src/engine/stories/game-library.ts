// The chapters of the story "game-library", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { ransom } from '../chapters/ransom';
import { chapterSnapshots } from '../chapters/snapshots';
import { base } from '../chapters/database';

export const chapters: Chapter[] = [ransom, chapterSnapshots, base];
