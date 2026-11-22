// The chapters of the story "fleet", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { inventory } from '../chapters/inventory';
import { playbook } from '../chapters/playbook';
import { rehearsal } from '../chapters/rehearsal';

export const chapters: Chapter[] = [inventory, playbook, rehearsal];
