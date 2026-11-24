// The rhel family (see families.ts): a Rocky Linux 10 machine's own tools
// ("The Language Café"): dnf and rpm (rpm.ts), firewall-cmd (firewalld.ts),
// SELinux's commands (selinux.ts), with httpd's model (httpd-rhel.ts).

import { RHEL_PACKAGE_COMMANDS } from '../commands/rhel-packages';
import { SELINUX_COMMANDS } from '../commands/selinux';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('rhel', { ...RHEL_PACKAGE_COMMANDS, ...SELINUX_COMMANDS }, HOOKS);
