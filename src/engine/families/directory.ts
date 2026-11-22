// The directory family (see families.ts): OpenLDAP and FreeRADIUS ("The Hive"): ldapsearch, ldapadd, slapcat…, freeradius, radtest.

import { LDAP } from '../commands/ldap';
import { RADIUS } from '../commands/radius';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('directory', { ...LDAP, ...RADIUS }, HOOKS);
