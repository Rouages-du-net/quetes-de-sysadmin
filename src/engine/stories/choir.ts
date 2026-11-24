// The chapters of the story "choir", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/postgres';
import type { Chapter } from '../world';
import { keptForever } from '../chapters/kept-forever';
import { accessRequest } from '../chapters/access-request';
import { forgetMe } from '../chapters/forget-me';

export const chapters: Chapter[] = [keptForever, accessRequest, forgetMe];
