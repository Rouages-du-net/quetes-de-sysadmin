// The chapters of the story "pool", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/k8s';
import type { Chapter } from '../world';
import { wontStart } from '../chapters/wont-start';
import { frontDesk } from '../chapters/front-desk';
import { lockerRoom } from '../chapters/locker-room';
import { deepEnd } from '../chapters/deep-end';

export const chapters: Chapter[] = [wontStart, frontDesk, lockerRoom, deepEnd];
