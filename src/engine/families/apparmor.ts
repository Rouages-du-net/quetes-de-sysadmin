// The apparmor family (see families.ts): AppArmor's tools ("The Zine
// Library"): aa-status, apparmor_parser, aa-enforce, aa-complain,
// aa-disable, aa-autodep, aa-logprof, aa-genprof, with the policy's model
// (apparmor.ts).

import { APPARMOR_COMMANDS } from '../commands/apparmor';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('apparmor', APPARMOR_COMMANDS, HOOKS);
