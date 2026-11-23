// The forge family (see families.ts): Forgejo and its runner ("The Tool Library"): forgejo, forgejo-runner, curl and git push towards the forge.

import { FORGE, forgeCurl } from '../commands/forge';
import { forgeReceive, forgeReceived, forgeRemote } from '../forge';
import { registerFamily } from '../families';

export const HOOKS = { forgeCurl, forgeReceive, forgeReceived, forgeRemote };

registerFamily('forge', FORGE, HOOKS);
