// The k8s family (see families.ts): A k3s cluster ("The Pool"): kubectl and k3s.

import { KUBECTL } from '../commands/kubectl';
import { K3S } from '../commands/k3s';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('k8s', { ...KUBECTL, ...K3S }, HOOKS);
