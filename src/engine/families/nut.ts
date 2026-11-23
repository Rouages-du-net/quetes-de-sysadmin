// The nut family (see families.ts): Network UPS Tools ("The Climbing Wall"):
// upsc, upscmd, upsrw, upsmon, upsd, upsdrvctl, upssched and ipmitool, with
// the power's model (nut.ts).

import { NUT_COMMANDS } from '../commands/nut';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('nut', NUT_COMMANDS, HOOKS);
