// The chapters of the story "language-cafe", in order: the module the game
// loads when the story is opened (see story-registry.ts). Its place among
// the stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/rhel';
import type { Chapter } from '../world';
import { newNeighbour } from '../chapters/new-neighbour';
import { wrongLabel } from '../chapters/wrong-label';
import { portAndBoolean } from '../chapters/port-and-boolean';

export const chapters: Chapter[] = [newNeighbour, wrongLabel, portAndBoolean];
