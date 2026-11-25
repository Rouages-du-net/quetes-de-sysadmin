// The openbao family (see families.ts): OpenBao, the secrets manager
// ("The Hostel"): the bao command and its server's model (openbao.ts).

import type { Command } from '../commands/index';
import { baoCommand } from '../commands/bao';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('openbao', { bao: { ownOptions: true, launch: baoCommand } satisfies Command }, HOOKS);
