// The chapters of the story "audit", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { scope } from '../chapters/scope';
import { report } from '../chapters/report';
import { exposure } from '../chapters/exposure';
import { traces } from '../chapters/traces';
import { againstVisit } from '../chapters/follow-up';

export const chapters: Chapter[] = [scope, report, exposure, traces, againstVisit];
