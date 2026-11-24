// The tls family (see families.ts): certificates' tools ("The Data Centre",
// "The Patch", "The Airwaves"): openssl and update-ca-certificates with an
// internal certificate authority's model (pki.ts), certbot; what nginx asks
// of an internal PKI (a key, a client's certificate) and curl on a story
// with one.

import { OPENSSL, pkiCurl } from '../commands/openssl';
import { CERTBOT } from '../commands/certbot';
import { readCrls, readKey, verify, VERIFY_ERRORS } from '../pki';
import { registerFamily } from '../families';

export const HOOKS = { pkiCurl, readKey, readCrls, verify, VERIFY_ERRORS };

registerFamily('tls', { ...OPENSSL, ...CERTBOT }, HOOKS);
