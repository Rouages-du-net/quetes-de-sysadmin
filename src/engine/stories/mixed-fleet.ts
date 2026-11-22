// The chapters of the story "mixed-fleet", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { lineEndings } from '../chapters/line-endings';
import { smbMount } from '../chapters/smb-mount';
import { fullVolume } from '../chapters/full-volume';

export const chapters: Chapter[] = [lineEndings, smbMount, fullVolume];
