// The apache family (see families.ts): Apache's tools ("The Neighbourhood
// Letters"): apache2ctl, apachectl, a2ensite, a2enmod… with Apache's model
// (apache.ts).

import { APACHE } from '../commands/apache';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('apache', APACHE, HOOKS);
