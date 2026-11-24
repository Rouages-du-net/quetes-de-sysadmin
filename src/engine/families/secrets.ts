// The secrets family (see families.ts): SOPS and age ("The Tenants' Union"):
// sops and age-keygen, and their model (sops.ts).

import { SECRETS } from '../commands/secrets';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('secrets', SECRETS, HOOKS);
