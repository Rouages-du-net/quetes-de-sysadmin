// The chapters of the story "health-centre", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine families load with it (see families.ts).
import '../families/libvirt';
import '../families/storage';
import type { Chapter } from '../world';
import { coldStart } from '../chapters/cold-start';
import { wrongSide } from '../chapters/wrong-side';
import { tightFit } from '../chapters/tight-fit';

export const chapters: Chapter[] = [coldStart, wrongSide, tightFit];
