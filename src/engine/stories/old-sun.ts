// The chapters of the story "old-sun", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/postgres';
import type { Chapter } from '../world';
import { readFirst } from '../chapters/read-first';
import { byteOrder } from '../chapters/byte-order';
import { switchOver } from '../chapters/switch-over';

export const chapters: Chapter[] = [readFirst, byteOrder, switchOver];
