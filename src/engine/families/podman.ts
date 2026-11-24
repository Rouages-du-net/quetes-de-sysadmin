// The podman family (see families.ts): rootless Podman ("The Walking Club"):
// podman, loginctl, Quadlet's dry run, and systemctl --user (a hook the
// core's systemctl calls), with the model of ../podman.ts.

import { PODMAN_COMMANDS, HOOKS_PODMAN } from '../commands/podman';
import { registerFamily } from '../families';

export const HOOKS = HOOKS_PODMAN;

registerFamily('podman', PODMAN_COMMANDS, HOOKS);
