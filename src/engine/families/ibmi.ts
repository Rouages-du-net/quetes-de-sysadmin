// The ibmi family (see families.ts): IBM i ("The Order Book"): the CL commands, system, db2, and the 5250 sign-on.

import { IBMI, signOn } from '../commands/ibmi';
import { registerFamily } from '../families';

export const HOOKS = { signOn };

registerFamily('ibmi', IBMI, HOOKS);
