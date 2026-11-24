// The lftp family (see families.ts): lftp towards a shared FTPS hosting
// ("The Community Centre"), with the host's model (web-host.ts).

import { LFTP } from '../commands/lftp';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('lftp', LFTP, HOOKS);
