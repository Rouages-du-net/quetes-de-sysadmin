// The caddy family (see families.ts): Caddy ("The Patch"): caddy, and what Caddy answers to curl.

import { CADDY } from '../commands/caddy';
import { caddyRequest } from '../caddy';
import { registerFamily } from '../families';

export const HOOKS = { caddyRequest };

registerFamily('caddy', CADDY, HOOKS);
