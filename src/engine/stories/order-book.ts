// The chapters of the story "order-book", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { inquiry } from '../chapters/inquiry';
import { spooled } from '../chapters/spooled';
import { saveFile } from '../chapters/save-file';

export const chapters: Chapter[] = [inquiry, spooled, saveFile];
