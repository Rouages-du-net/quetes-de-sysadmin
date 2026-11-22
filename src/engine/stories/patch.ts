// The chapters of the story "patch", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/caddy';
import type { Chapter } from '../world';
import { padlock } from '../chapters/padlock';

export const chapters: Chapter[] = [padlock];
