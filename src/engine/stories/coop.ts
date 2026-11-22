// The chapters of the story "coop", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { departure } from '../chapters/departure';
import { rights } from '../chapters/shared-rights';
import { secret } from '../chapters/secret';
import { proxy } from '../chapters/proxy';
import { updates } from '../chapters/updates';
import { automatic } from '../chapters/auto-updates';

export const chapters: Chapter[] = [departure, rights, secret, proxy, updates, automatic];
