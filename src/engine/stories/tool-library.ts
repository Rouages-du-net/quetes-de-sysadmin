// The chapters of the story "tool-library", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/forge';
import type { Chapter } from '../world';
import { whoCanPush } from '../chapters/who-can-push';
import { leakyPipeline } from '../chapters/leaky-pipeline';
import { signedRelease } from '../chapters/signed-release';

export const chapters: Chapter[] = [whoCanPush, leakyPipeline, signedRelease];
