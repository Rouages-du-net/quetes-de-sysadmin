// The storage family (see families.ts): the tools of described disks ("The
// Lab"): smartctl, mdadm, sfdisk, grub-install, and LVM's pvs, vgs, lvs,
// pvcreate, vgextend, pvmove, lvextend, resize2fs, update-initramfs…; lsblk
// on a machine whose storage is described. The storage's model (storage.ts,
// lvm.ts) stays in the core, which fstab, LUKS and the boot read.

import { STOCKAGE, lsblkStockage } from '../commands/storage';
import { LVM } from '../commands/lvm';
import { registerFamily } from '../families';

export const HOOKS = { lsblk: lsblkStockage };

registerFamily('storage', { ...STOCKAGE, ...LVM }, HOOKS);
