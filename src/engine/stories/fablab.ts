// The chapters of the story "fablab", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/docker';
import type { Chapter } from '../world';
import { update } from '../chapters/update';
import { composition } from '../chapters/compose';
import { bypass } from '../chapters/firewall-hole';
import { powersFull } from '../chapters/full-powers';

export const chapters: Chapter[] = [update, composition, bypass, powersFull];
