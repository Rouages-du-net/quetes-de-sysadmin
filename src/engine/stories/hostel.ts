// The chapters of the story "hostel", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine families load with it (see families.ts): OpenBao, and jq for
// reading the audit log.
import '../families/openbao';
import '../families/jq';
import type { Chapter } from '../world';
import { sealedChapter } from '../chapters/sealed';
import { needToKnow } from '../chapters/need-to-know';
import { leakedToken } from '../chapters/leaked-token';

export const chapters: Chapter[] = [sealedChapter, needToKnow, leakedToken];
