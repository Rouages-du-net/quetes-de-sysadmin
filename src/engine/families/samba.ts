// The samba family (see families.ts): Samba's tools ("The Photo Club",
// "Next Door Windows"): testparm, smbpasswd, pdbedit, smbclient and the
// smb.conf(5) page, with Samba's model (samba.ts).

import { SAMBA } from '../commands/samba';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('samba', SAMBA, HOOKS);
