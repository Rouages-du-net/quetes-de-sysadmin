// The postfix family (see families.ts): an outgoing mail server's tools
// ("Junk Mail", "The Lifeboat"): postconf, postfix, postqueue, mailq,
// postsuper (Postfix), opendkim-genkey, opendkim-testkey, with their model
// (mail.ts); mail(1) hands its message to Postfix on such a machine.

import { MAIL } from '../commands/mail';
import { submit } from '../mail';
import { registerFamily } from '../families';

export const HOOKS = { submit };

registerFamily('postfix', MAIL, HOOKS);
