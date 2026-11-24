// The chapters of the story "letters", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/apache';
import type { Chapter } from '../world';
import { door } from '../chapters/shut-the-door';
import { firewall } from '../chapters/firewall';
import { sentinel } from '../chapters/sentinel';
import { colocation } from '../chapters/sharing';
import { atMe } from '../chapters/works-for-me';
import { concert } from '../chapters/concert';
import { port } from '../chapters/port';
import { repeatOffence } from '../chapters/repeat-offenders';
import { workshop } from '../chapters/repair-cafe';

export const chapters: Chapter[] = [door, firewall, sentinel, colocation, atMe, concert, port, repeatOffence, workshop];
