// The chapters of the story "bastion", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { alarm } from '../chapters/alarm';
import { containment } from '../chapters/containment';
import { eradication } from '../chapters/eradication';
import { hardening } from '../chapters/hardening';

export const chapters: Chapter[] = [alarm, containment, eradication, hardening];
