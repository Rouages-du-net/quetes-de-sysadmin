// The chapters of the story "walking-club", in order: the module the game
// loads when the story is opened (see story-registry.ts). Its place among
// the stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/podman';
import type { Chapter } from '../world';
import { noRootNeeded } from '../chapters/no-root-needed';
import { loggedOut } from '../chapters/logged-out';

export const chapters: Chapter[] = [noRootNeeded, loggedOut];
