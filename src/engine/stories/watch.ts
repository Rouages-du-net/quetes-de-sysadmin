// The chapters of the story "watch", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/security';
import type { Chapter } from '../world';
import { bulletin } from '../chapters/bulletin';
import { priority } from '../chapters/priority';
import { fix } from '../chapters/fix';
import { proof } from '../chapters/proof';
import { routine } from '../chapters/routine';

export const chapters: Chapter[] = [bulletin, priority, fix, proof, routine];
