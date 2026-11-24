// The chapters of the story "mapping-party", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/iac';
import type { Chapter } from '../world';
import { firstPlan } from '../chapters/first-plan';
import { drift } from '../chapters/drift';

export const chapters: Chapter[] = [firstPlan, drift];
