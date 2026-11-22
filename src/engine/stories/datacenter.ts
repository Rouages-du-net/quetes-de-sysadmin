// The chapters of the story "datacenter", in order: the module the game loads
// when the story is opened (see story-registry.ts). Its place among the
// stories, and what it opens after, are in chapters/index.ts.
import type { Chapter } from '../world';
import { datacenter } from '../chapters/first-day';
import { secondDay } from '../chapters/second-day';
import { reboot } from '../chapters/reboot-night';
import { fire } from '../chapters/fire';
import { certificate } from '../chapters/certificate';

export const chapters: Chapter[] = [datacenter, secondDay, reboot, fire, certificate];
