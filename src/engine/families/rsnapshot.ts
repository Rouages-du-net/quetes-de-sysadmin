// The rsnapshot family (see families.ts): rsnapshot ("The Game Library").

import { RSNAPSHOT } from '../commands/rsnapshot';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('rsnapshot', RSNAPSHOT, HOOKS);
