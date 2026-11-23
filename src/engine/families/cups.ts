// The cups family (see families.ts): CUPS ("The Staff Room"): lpstat, lp, lpadmin, cupsctl…

import { CUPS } from '../commands/cups';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('cups', CUPS, HOOKS);
