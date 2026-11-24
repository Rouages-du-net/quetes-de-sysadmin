// The chapters of the story "zine-library", in order: the module the game
// loads when the story is opened (see story-registry.ts). Its place among
// the stories, and what it opens after, are in chapters/index.ts.
// Its engine family loads with it (see families.ts).
import '../families/apparmor';
import type { Chapter } from '../world';
import { deniedUpload } from '../chapters/denied-upload';
import { backupProfile } from '../chapters/backup-profile';

export const chapters: Chapter[] = [deniedUpload, backupProfile];
