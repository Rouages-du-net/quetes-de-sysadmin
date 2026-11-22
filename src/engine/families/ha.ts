// The ha family (see families.ts): keepalived and HAProxy ("The Blood Drive"): keepalived, tcpdump, pidof, haproxy, socat, curl through the balancer.

import { KEEPALIVED_COMMANDS } from '../commands/keepalived';
import { HAPROXY_COMMANDS, haCurl } from '../commands/haproxy';
import { registerFamily } from '../families';

export const HOOKS = { haCurl };

registerFamily('ha', { ...KEEPALIVED_COMMANDS, ...HAPROXY_COMMANDS }, HOOKS);
