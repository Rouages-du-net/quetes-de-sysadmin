// The iac family (see families.ts): infrastructure as code with OpenTofu
// ("The Mapping Party"): the tofu command and its model (hcl.ts, tofu.ts),
// with the hashicorp/dns provider on the game's BIND.

import type { Command } from '../commands/index';
import { tofu } from '../tofu';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('iac', { tofu: { ownOptions: true, launch: tofu } satisfies Command }, HOOKS);
