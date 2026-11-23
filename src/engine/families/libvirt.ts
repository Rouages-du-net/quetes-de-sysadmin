// The libvirt family (see families.ts): KVM and libvirt ("The Health Centre"): virsh, qemu-img, virt-install, virt-clone, growpart, a guest's resize2fs.

import { VIRT, resizeGuestFs } from '../commands/libvirt';
import { registerFamily } from '../families';

export const HOOKS = { resizeGuestFs };

registerFamily('libvirt', VIRT, HOOKS);
