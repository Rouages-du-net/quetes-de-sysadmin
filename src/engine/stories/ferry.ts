// The chapters of the story "ferry", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/security';
import type { Chapter } from '../world';
import { newCard } from '../chapters/new-card';
import { otherDoor } from '../chapters/other-door';
import { bothWays } from '../chapters/both-ways';

export const chapters: Chapter[] = [newCard, otherDoor, bothWays];
