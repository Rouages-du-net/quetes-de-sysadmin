// The ansible family (see families.ts): Ansible ("The Fleet"): ansible, ansible-playbook, ansible-inventory, ansible-doc.

import { ANSIBLE } from '../commands/ansible';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('ansible', ANSIBLE, HOOKS);
