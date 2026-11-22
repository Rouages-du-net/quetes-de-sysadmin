// The chapters of the story "junk-mail", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { postman } from '../chapters/postman';
import { signature } from '../chapters/signature';
import { chapterPolicy } from '../chapters/policy';

export const chapters: Chapter[] = [postman, signature, chapterPolicy];
