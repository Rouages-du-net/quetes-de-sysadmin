// The chapters of the story "shelter", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// It needs no engine family: every tool it uses is in the core.
import type { Chapter } from '../world';
import { whatWeHave } from '../chapters/what-we-have';
import { rebuild } from '../chapters/rebuild';
import { switchAndLearn } from '../chapters/switch-and-learn';

export const chapters: Chapter[] = [whatWeHave, rebuild, switchAndLearn];
