// The luks family (see families.ts): cryptsetup, cryptdisks_start,
// cryptdisks_stop and the crypttab(5) page ("The Pantry"). LUKS's model
// (luks.ts) stays in the core, which lsblk, blkid and mount read.

import { CRYPTSETUP } from '../commands/cryptsetup';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('luks', CRYPTSETUP, HOOKS);
