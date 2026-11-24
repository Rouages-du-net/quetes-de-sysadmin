// The security family (see families.ts): the auditor's tools ("The Audit",
// "The Watch", "The Bastion", "The Ferry"): nmap on the story's network
// (scan.ts), Lynis (lynis.ts), gpg (gpg.ts).

import { NMAP } from '../commands/nmap';
import { LYNIS } from '../commands/lynis';
import { GPG } from '../commands/gpg';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('security', { ...NMAP, ...LYNIS, ...GPG }, HOOKS);
