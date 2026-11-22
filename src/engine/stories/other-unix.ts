// The chapters of the story "other-unix", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { portableScript } from '../chapters/portable-script';
import { rcServices } from '../chapters/rc-services';
import { lastRule } from '../chapters/last-rule';

export const chapters: Chapter[] = [portableScript, rcServices, lastRule];
