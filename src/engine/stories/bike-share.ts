// The chapters of the story "bike-share", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine families load with it (see families.ts).
import '../families/jq';
import '../families/prometheus';
import type { Chapter } from '../world';
import { blindSpot } from '../chapters/blind-spot';
import { threshold } from '../chapters/threshold';
import { quietHours } from '../chapters/quiet-hours';

export const chapters: Chapter[] = [blindSpot, threshold, quietHours];
