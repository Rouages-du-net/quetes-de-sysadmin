// The inbound family (see families.ts): an inbound mail server's tools
// ("The Lifeboat"): doveadm, doveconf (Dovecot), sievec, sieve-test
// (Pigeonhole), rspamc, rspamadm (rspamd), with their models (dovecot.ts,
// sieve.ts, rspamd.ts, inbound.ts) and the doveadm-search-query(7) page.

import type { Command } from '../commands/index';
import { INBOUND_PROGRAMS } from '../inbound-client';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily(
  'inbound',
  {
    ...Object.fromEntries(Object.entries(INBOUND_PROGRAMS).map(([name, launch]) => [name, { ownOptions: true, launch } satisfies Command])),
    // The search queries doveadm's mail commands take: a page of the manual (man doveadm-search-query).
    'doveadm-search-query': { section: 7, launch: () => '' },
  },
  HOOKS,
);
