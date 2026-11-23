// The chapters of the story "dance-troupe", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/objects';
import type { Chapter } from '../world';
import { publicBucket } from '../chapters/public-bucket';
import { offsiteCopy } from '../chapters/offsite-copy';
import { bigFile } from '../chapters/big-file';

export const chapters: Chapter[] = [publicBucket, offsiteCopy, bigFile];
