// The chapters of the story "photo-club", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/samba';
import type { Chapter } from '../world';
import { nfsExport } from '../chapters/nfs-export';
import { nfsOwners } from '../chapters/nfs-owners';
import { sambaShare } from '../chapters/samba-share';

export const chapters: Chapter[] = [nfsExport, nfsOwners, sambaShare];
