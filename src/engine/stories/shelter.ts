// The chapters of the story "shelter", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/postgres';
import type { Chapter } from '../world';
import { whatWeHave } from '../chapters/what-we-have';
import { rebuild } from '../chapters/rebuild';
import { switchAndLearn } from '../chapters/switch-and-learn';

export const chapters: Chapter[] = [whatWeHave, rebuild, switchAndLearn];
