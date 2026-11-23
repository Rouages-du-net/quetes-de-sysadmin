// The chapters of the story "hive", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/directory';
import type { Chapter } from '../world';
import { vlan } from '../chapters/vlan';
import { dhcp } from '../chapters/dhcp';
import { zones } from '../chapters/zones';
import { vpn } from '../chapters/remote-work';
import { dmz } from '../chapters/dmz';
import { annex } from '../chapters/annex';
import { chapterDirectory } from '../chapters/directory';
import { wifi } from '../chapters/wifi';

export const chapters: Chapter[] = [vlan, dhcp, zones, vpn, dmz, annex, chapterDirectory, wifi];
