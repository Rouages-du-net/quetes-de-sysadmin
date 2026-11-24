// The docker family (see families.ts): the docker command ("The Workshop"):
// images, containers, volumes and Docker Compose (compose.ts). The machine's
// Docker model (docker.ts: its processes, sockets and HTTP answers) stays in
// the core, which ps, ss and curl read.

import { DOCKER } from '../commands/docker';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('docker', DOCKER, HOOKS);
