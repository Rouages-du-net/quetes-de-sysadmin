// The jq family (see families.ts): jq ("The Bike Share", "The Tool Library").

import { JQ } from '../commands/jq';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('jq', JQ, HOOKS);
