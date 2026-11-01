// The Lab: the disks of the photo club's server (SMART, software RAID,
// replacing a disk). Each chapter is replayed to the end, with another
// solution and false leads, in each language; the expected texts are
// checked in French. Also: the outputs of smartctl, mdadm, sfdisk, lsblk
// and /proc/mdstat, and their error messages.

import { describe, expect, it } from 'vitest';
import { machineName } from '../src/engine/machines';
import { Shell } from '../src/engine/shell';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { name } from '../src/engine/world';
import { SERIES } from '../src/engine/chapters/lab';
import { storageOf } from '../src/engine/storage';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const MDP = 'film-2027';

for (const language of LANGUAGES)
  describe(`The Lab — ${language}`, () => {
    const fr = language === 'fr';
    const L = (line: string) => inLanguage(translator(language), line);
    // The volume group (lab, labo in French) and the machine's name, which names the arrays (lab:2).
    const VG = name(translator(language), 'lab');
    const HOST = machineName(translator(language), 'lab');
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    // A game: each line (written with the French names), with sudo's password if asked for.
    function part(id: string) {
      const s = new Shell(chapter(id), language);
      const one = (l: string) => {
        let output = s.execute(L(l)) ?? '';
        if (s.waiting) output += '\n' + (s.execute(machinesInLanguage(s.t, MDP)) ?? '');
        const errors = s.recoverErrors();
        return [output, ...errors].filter(Boolean).join('\n');
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      return { s, jouer: play, st: () => storageOf(s)! };
    }

    it('chapter 1 — solution: mails, mdstat, SMART of both disks, sdb taken out of md0 and md1, ticket', () => {
      const { s, jouer: play, st } = part('tired-disk');
      let all = play(['cat message_from_odile.txt', 'mail', 'cat /var/mail/you', 'cat /proc/mdstat']);
      expect(all).toContain(`SMART error (CurrentPendingSector) detected on host: ${machineName(translator(language), 'lab')}`);
      expect(all).toContain('md0 : active raid1 sdb2[1] sda2[0]');
      expect(all).toContain('[2/2] [UU]');
      contains(all, 'smartd et le noyau parlent du même disque');
      all = play(['sudo smartctl -a /dev/sdb', 'sudo smartctl -a /dev/sda']);
      expect(all).toContain('SMART overall-health self-assessment test result: PASSED');
      expect(all).toMatch(/5 Reallocated_Sector_Ct\s+0x0033\s+153\s+153\s+140\s+Pre-fail\s+Always\s+-\s+1208/);
      expect(all).toContain(`Serial Number:    ${SERIES.sda}`);
      contains(all, 'plus de mille secteurs réalloués');
      all = play(['sudo mdadm --manage /dev/md0 --fail /dev/sdb2 --remove /dev/sdb2']);
      expect(all).toContain('mdadm: set /dev/sdb2 faulty in /dev/md0\nmdadm: hot removed /dev/sdb2 from /dev/md0');
      contains(all, 'fait encore partie de /dev/md1');
      all = play(['sudo mdadm /dev/md1 -f /dev/sdb3', 'sudo mdadm /dev/md1 -r failed', 'cat /proc/mdstat']);
      expect(all).toContain('mdadm: hot removed /dev/sdb3 from /dev/md1');
      expect(all).toContain('md1 : active raid1 sda3[0]\n      1919824896 blocks super 1.2 [2/1] [U_]');
      contains(all, 'ne fait plus partie');
      expect(s.finished).toBe(false);
      all = play(['lsblk -d -o NAME,SERIAL', `echo "Please replace the disk S/N ${SERIES.sdb}" > ~/ticket.txt`]);
      expect(all).toMatch(new RegExp(`sdb\\s+${SERIES.sdb}`));
      contains(all, 'Tu as terminé le chapitre 1 du Labo');
      expect(Object.values(st().arrays).every((g) => g.members.length === 1)).toBe(true);
      expect(s.finished).toBe(true);
    });

    it('chapter 1 — false leads: removing without --fail, taking out the healthy disk, a ticket with the wrong number', () => {
      const { s, jouer: play, st } = part('tired-disk');
      // An active member can't be removed.
      let all = play(['sudo mdadm /dev/md0 --remove /dev/sdb2']);
      expect(all).toContain('mdadm: hot remove failed for /dev/sdb2: Device or resource busy');
      contains(all, 'on ne retire pas un membre actif');
      // The healthy disk taken out by mistake: the array now only holds on sdb.
      all = play(['sudo mdadm /dev/md0 --fail /dev/sda2', 'cat /proc/mdstat']);
      expect(all).toContain('md0 : active raid1 sdb2[1] sda2[0](F)');
      contains(all, 'le disque SAIN');
      // md then refuses to take out the last up-to-date member.
      all = play(['sudo mdadm /dev/md0 --fail /dev/sdb2']);
      expect(all).toContain('mdadm: set device faulty failed for /dev/sdb2:  Device or resource busy');
      // Repair: remove, then put back (--re-add), and it catches up.
      all = play(['sudo mdadm /dev/md0 --re-add /dev/sda2']);
      expect(all).toContain('mdadm: Cannot open /dev/sda2: Device or resource busy');
      play(['sudo mdadm /dev/md0 --remove /dev/sda2', 'sudo mdadm /dev/md0 --re-add /dev/sda2', 'cat /proc/mdstat']);
      expect(st().arrays.md0.members.find((m) => m.part === 'sda2')?.state).toBe('active');
      // Then the right disk, in both arrays.
      play(['sudo mdadm /dev/md0 --fail /dev/sdb2 --remove /dev/sdb2', 'sudo mdadm /dev/md1 --fail /dev/sdb3 --remove /dev/sdb3']);
      // A ticket with sda's number: refused (the healthy disk would be unplugged).
      all = play([`echo "Disk to replace: ${SERIES.sda}" > ~/ticket.txt`]);
      contains(all, 'le numéro de série de sda');
      expect(s.finished).toBe(false);
      play([`echo "Disk to replace: ${SERIES.sdb}" > ~/ticket.txt`]);
      expect(s.finished).toBe(true);
    });

    it('chapter 2 — solution: sda\'s table copied, both partitions added, the rebuild, GRUB', () => {
      const { s, jouer: play, st } = part('new-disk');
      let all = play(['cat message_from_odile.txt', 'lsblk', 'cat /proc/mdstat']);
      expect(all).toMatch(/^sdb\s+8:16\s+0 1\.8T\s+0 disk$/m);
      expect(all).toContain('[2/1] [U_]');
      contains(all, 'Le nouveau sdb');
      all = play(['sudo sfdisk -d /dev/sda | sudo sfdisk /dev/sdb']);
      expect(all).toContain("/dev/sdb1: Created a new partition 1 of type 'BIOS boot' and of size 1 MiB.");
      expect(all).toContain('The partition table has been altered.');
      contains(all, 'sdb est découpé comme sda');
      all = play(['sudo mdadm --manage /dev/md0 --add /dev/sdb2', 'sudo mdadm --manage /dev/md1 --add /dev/sdb3', 'cat /proc/mdstat']);
      expect(all).toContain('mdadm: added /dev/sdb2');
      expect(all).toMatch(/recovery = +\d+\.\d% \(\d+\/1919824896\) finish=[\d.]+min speed=180000K\/sec/);
      expect(s.finished).toBe(false);
      // The rebuild takes a few commands.
      for (let i = 0; i < 6 && !st().arrays.md1.members.every((m) => m.state === 'active'); i++) play(['cat /proc/mdstat']);
      all = play(['cat /proc/mdstat']);
      expect(all).toContain('md1 : active raid1 sdb3[1] sda3[0]\n      1919824896 blocks super 1.2 [2/2] [UU]');
      all = play(['sudo grub-install /dev/sdb']);
      expect(all).toContain('Installation finished. No error reported.');
      contains(all, 'Tu as terminé le chapitre 2 du Labo');
      expect(s.finished).toBe(true);
    });

    it('chapter 2 — another solution: GRUB first, a single mdadm command per array, the table kept in a file', () => {
      const { s, jouer: play } = part('new-disk');
      play(['sudo sfdisk -d /dev/sda > table.txt', 'cat table.txt | sudo sfdisk /dev/sdb', 'sudo grub-install /dev/sdb', 'sudo mdadm /dev/md1 -a /dev/sdb3', 'sudo mdadm /dev/md0 -a /dev/sdb2']);
      for (let i = 0; i < 8 && !s.finished; i++) play(['sudo mdadm --detail /dev/md1']);
      expect(s.finished).toBe(true);
    });

    it('chapter 2 — false leads: adding too early, the reversed direction, the whole disk, GRUB on a partition', () => {
      const { s, jouer: play, st } = part('new-disk');
      let all = play(['sudo mdadm --manage /dev/md0 --add /dev/sdb2']);
      expect(all).toContain('mdadm: Cannot find /dev/sdb2: No such file or directory');
      contains(all, 'sdb est encore vierge');
      // The reversed direction: sfdisk refuses to write to sda, which is in service.
      all = play(['sudo sfdisk -d /dev/sdb | sudo sfdisk /dev/sda']);
      expect(all).toContain('sfdisk: /dev/sdb: does not contain a recognized partition table');
      expect(all).toContain('This disk is currently in use - repartitioning is probably a bad idea.');
      contains(all, 'le disque nommé en dernier qui est écrasé');
      expect(st().disks.sda.partitions).toHaveLength(3);
      // GRUB on a blank disk (no BIOS boot partition), then on a partition.
      all = play(['sudo grub-install /dev/sdb']);
      expect(all).toContain('this GPT partition label contains no BIOS Boot Partition');
      // The whole disk in an array: it overwrites its table.
      all = play(['sudo mdadm /dev/md0 --add /dev/sdb']);
      expect(all).toContain('mdadm: added /dev/sdb');
      contains(all, 'le disque sdb ENTIER');
      play(['sudo mdadm /dev/md0 --fail /dev/sdb --remove /dev/sdb', 'sudo sfdisk -d /dev/sda | sudo sfdisk /dev/sdb']);
      all = play(['sudo grub-install /dev/sdb1']);
      expect(all).toContain("grub-install: error: unable to identify a filesystem in /dev/sdb1; safety check can't be performed.");
      play(['sudo mdadm /dev/md0 --add /dev/sdb2', 'sudo mdadm /dev/md1 --add /dev/sdb3', 'sudo grub-install /dev/sdb']);
      for (let i = 0; i < 8 && !s.finished; i++) play(['cat /proc/mdstat']);
      expect(s.finished).toBe(true);
    });

    it('the tools\' messages: without root, without argument, unknown, unknown option', () => {
      const { s, jouer: play } = part('tired-disk');
      expect(s.execute('smartctl -a /dev/sda')).toContain('Smartctl open device: /dev/sda failed: Permission denied');
      expect(s.execute('mdadm --detail /dev/md0')).toContain('mdadm: cannot open /dev/md0: Permission denied');
      expect(s.execute('cat /proc/mdstat')).toContain('Personalities : [raid1]');
      const all = play([
        'sudo smartctl',
        'sudo smartctl -a /dev/sdz',
        'sudo smartctl --frobnicate /dev/sda',
        'sudo mdadm',
        'sudo mdadm --detail /dev/md9',
        'sudo mdadm --detail /dev/sda2',
        'sudo mdadm /dev/md0 --fail /dev/sdc2',
        'sudo mdadm --detail --scan',
        'lsblk -o NAME,COLOUR',
        'sudo smartctl -t short /dev/sdb',
        'sudo smartctl -l selftest /dev/sdb',
      ]);
      expect(all).toContain('ERROR: smartctl requires a device name as the final command-line argument.');
      expect(all).toContain('Smartctl open device: /dev/sdz failed: No such device');
      expect(all).toContain('=======> UNRECOGNIZED OPTION: frobnicate');
      expect(all).toContain('Usage: mdadm --help\n  for help');
      expect(all).toContain('mdadm: cannot open /dev/md9: No such file or directory');
      expect(all).toContain('mdadm: /dev/sda2 does not appear to be an md device');
      expect(all).toContain('mdadm: set device faulty failed for /dev/sdc2:  No such device');
      expect(all).toContain(`ARRAY /dev/md/0 metadata=1.2 name=${HOST}:0 UUID=5d1e0a3c:7b2f4e91:a6c83f0d:9b1e2c47`);
      expect(all).toContain('lsblk: unknown column: COLOUR');
      expect(all).toContain('Testing has begun.');
      expect(all).toMatch(/# 1  Short offline\s+Completed: read failure\s+90%/);
      // sfdisk and grub-install: in chapter 2.
      const two = part('new-disk');
      const outputs = two.jouer(['sudo sfdisk -l /dev/sda', 'sudo sfdisk --force /dev/sdb', 'sudo sfdisk /dev/sdb', 'sudo sfdisk -d /dev/sda | sudo sfdisk /dev/sda', 'sudo grub-install /dev/sdz']);
      expect(outputs).toMatch(/\/dev\/sda3\s+67112960 3907029134 3839916175\s+1\.8T Linux RAID/);
      expect(outputs).toContain("sfdisk: unrecognized option '--force'");
      contains(outputs, 'le mode interactif');
      expect(outputs).toContain('This disk is currently in use');
      expect(outputs).toContain('grub-install: error: cannot find a GRUB drive for /dev/sdz.  Check your device.map.');
      // The manual: each command has its page and its --help.
      for (const c of ['smartctl', 'mdadm']) {
        expect(s.execute(`man ${c}`)).toContain(`${c.toUpperCase()}(8)`);
        expect(s.execute(`${c} --help`)).toBeTruthy();
      }
      for (const c of ['sfdisk', 'grub-install']) expect(two.s.execute(`man ${c}`)).toContain(`${c.toUpperCase()}(8)`);
      expect(play(['man -k RAID'])).toContain('mdadm (8)');
    });

    it('chapter 3 — solution: an array of the new disks, pvcreate, vgextend, lvextend then resize2fs, mdadm.conf, initramfs', () => {
      const { s, jouer: play, st } = part('more-room');
      let all = play(['cat message_from_odile.txt', 'df -h /srv', 'sudo vgs', 'lsblk']);
      expect(all).toMatch(new RegExp(`/dev/mapper/${VG}-photos.* 97% /srv`));
      expect(all).toMatch(new RegExp(`${VG} +1 +1 +0 wz--n- <1\\.79t +0\n`));
      expect(all).toMatch(/^sdc +8:32 +0 3\.6T +0 disk$/m);
      contains(all, 'un volume logique LVM');
      all = play(['sudo mdadm --create /dev/md2 --level=1 --raid-devices=2 /dev/sdc /dev/sdd']);
      expect(all).toContain('may not be suitable as a boot device');
      all = play(['y', 'cat /proc/mdstat']);
      expect(all).toContain('mdadm: array /dev/md2 started.');
      expect(all).toMatch(/md2 : active raid1 sdd\[1\] sdc\[0\]\n +\d+ blocks super 1\.2 \[2\/2\] \[UU\]\n +\[=*>\.*\] +resync = /);
      all = play(['sudo pvcreate /dev/md2', 'sudo vgextend lab /dev/md2', 'sudo lvextend -l +100%FREE /dev/lab/photos', 'df -h /srv']);
      expect(all).toContain('Physical volume "/dev/md2" successfully created.');
      expect(all).toContain(`Volume group "${VG}" successfully extended`);
      expect(all).toMatch(new RegExp(`Size of logical volume ${VG}/photos changed from <1\\.79 TiB \\(\\d+ extents\\) to <5\\.43 TiB`));
      expect(all).toMatch(/ 97% \/srv/);
      contains(all, 'df ne voit rien');
      all = play([`sudo resize2fs /dev/mapper/${VG}-photos`, 'df -h /srv']);
      expect(all).toContain('on-line resizing required');
      expect(all).toMatch(/ 32% \/srv/);
      expect(s.finished).toBe(false);
      all = play(['sudo mdadm --detail --brief /dev/md2 | sudo tee -a /etc/mdadm/mdadm.conf']);
      expect(all).toMatch(new RegExp(`^ARRAY /dev/md2 metadata=1\\.2 name=${HOST}:2 UUID=[0-9a-f:]{35}$`, 'm'));
      expect(s.finished).toBe(false);
      all = play(['sudo update-initramfs -u']);
      expect(all).toContain('update-initramfs: Generating /boot/initrd.img-6.12.48+deb13-amd64');
      contains(all, 'Tu as terminé le chapitre 3 du Labo');
      expect(Object.keys(st().lvm!.pvs).sort()).toEqual(['md1', 'md2']);
      expect(s.finished).toBe(true);
    });

    it('chapter 3 — another solution: --run, vgextend without pvcreate, lvextend -r -L, mdadm.conf written with nano', () => {
      const { s, jouer: play } = part('more-room');
      let all = play(['sudo mdadm -C /dev/md2 -l1 -n2 --run /dev/sdc /dev/sdd', 'sudo vgextend lab /dev/md2', 'sudo lvextend -r -L +2T /dev/lab/photos']);
      expect(all).toContain('Physical volume "/dev/md2" successfully created.');
      expect(all).toContain(`File system ext4 found on ${VG}/photos mounted at /srv.`);
      expect(all).toContain(`Extended file system ext4 on ${VG}/photos.`);
      all = play(['sudo mdadm --detail --brief /dev/md2']);
      const line = /ARRAY .*/.exec(all)![0];
      s.execute('sudo nano /etc/mdadm/mdadm.conf');
      s.saveEdition(s.edition!.text + '\n' + line + '\n');
      s.quitEdition();
      play(['sudo update-initramfs -u']);
      expect(s.finished).toBe(true);
    });

    it('chapter 3 — false lead: a lone disk in the group, repaired with a degraded array and pvmove', () => {
      const { s, jouer: play, st } = part('more-room');
      // sdc given as is to LVM, and the volume extended onto it: no more redundancy.
      let all = play(['sudo vgextend lab /dev/sdc', 'sudo lvextend -r -L +500G /dev/lab/photos']);
      expect(all).toContain(`Volume group "${VG}" successfully extended`);
      contains(all, 'tel quel, sans');
      // It can neither join an array nor leave the group while it holds data.
      all = play(['sudo mdadm --create /dev/md2 --level=1 --raid-devices=2 /dev/sdc /dev/sdd', 'sudo vgreduce lab /dev/sdc', 'sudo pvmove /dev/sdc']);
      expect(all).toContain('mdadm: cannot open /dev/sdc: Device or resource busy');
      expect(all).toContain('Physical volume "/dev/sdc" still in use');
      expect(all).toMatch(/Insufficient free space: \d+ extents needed, but only 0 available/);
      // A degraded array on sdd, the data moved, sdc freed then added to the array.
      all = play([
        'sudo mdadm --create /dev/md2 --level=1 --raid-devices=2 --run /dev/sdd missing',
        'sudo vgextend lab /dev/md2',
        'sudo pvmove /dev/sdc /dev/md2',
        'sudo vgreduce lab /dev/sdc',
        'sudo pvremove /dev/sdc',
        'sudo mdadm /dev/md2 --add /dev/sdc',
        'cat /proc/mdstat',
      ]);
      expect(all).toContain('/dev/sdc: Moved: 100.00%');
      expect(all).toContain(`Removed "/dev/sdc" from volume group "${VG}"`);
      expect(all).toContain('Labels on physical volume "/dev/sdc" successfully wiped.');
      expect(all).toContain('mdadm: added /dev/sdc');
      expect(all).toMatch(/md2 : active raid1 sdc\[\d\] sdd\[0\]/);
      // 500 GB isn't enough for the contest: the rest of the space.
      expect(s.finished).toBe(false);
      play(['sudo lvextend -r -l +100%FREE /dev/lab/photos', 'sudo mdadm --detail --brief /dev/md2 | sudo tee -a /etc/mdadm/mdadm.conf', 'sudo update-initramfs -u']);
      expect(Object.keys(st().lvm!.pvs).sort()).toEqual(['md1', 'md2']);
      expect(s.finished).toBe(true);
    });

    it('chapter 3 — false leads: lvextend without the file system, the duplicates of --scan, the initramfs rebuilt too early', () => {
      const { s, jouer: play } = part('more-room');
      play(['sudo mdadm --create /dev/md2 --level=1 --raid-devices=2 --run /dev/sdc /dev/sdd', 'sudo vgextend lab /dev/md2', 'sudo lvextend -l +100%FREE /dev/lab/photos']);
      let all = play(['sudo lvextend -l +100%FREE /dev/lab/photos', 'sudo update-initramfs -u', 'sudo resize2fs /dev/lab/photos', 'sudo resize2fs /dev/lab/photos']);
      expect(all).toMatch(/New size \(\d+ extents\) matches existing size/);
      expect(all).toMatch(/The filesystem is already \d+ \(4k\) blocks long\.  Nothing to do!/);
      all = play(['sudo mdadm --detail --scan | sudo tee -a /etc/mdadm/mdadm.conf']);
      contains(all, 'décrit maintenant une grappe deux fois');
      expect(s.finished).toBe(false);
      // One line per array, then the initramfs to rebuild (the previous one doesn't know md2).
      s.execute('sudo nano /etc/mdadm/mdadm.conf');
      const views = new Set<string>();
      const keep = (l: string) => {
        if (!l.startsWith('ARRAY')) return true;
        const uuid = /UUID=([0-9a-f:]+)/.exec(l)![1];
        if (views.has(uuid)) return false;
        views.add(uuid);
        return true;
      };
      s.saveEdition(s.edition!.text.split('\n').filter(keep).join('\n'));
      s.quitEdition();
      expect(s.finished).toBe(false);
      play(['sudo update-initramfs -u']);
      expect(s.finished).toBe(true);
    });

    // Chapter 4: /etc/fstab is fixed with nano (as root, on the host's console).
    const THEO_LINE = '/dev/sdc1  /srv/scans  ext4  defaults  0  2';
    const fix = (s: Shell, fresh: string | null) => {
      s.execute('nano /etc/fstab');
      const text = s.edition!.text;
      const output = s.saveEdition(fresh === null ? text.replace(THEO_LINE + '\n', '').replace(THEO_LINE, '') : text.replace(THEO_LINE, fresh));
      return output + '\n' + s.quitEdition();
    };
    const BY_UUID = 'UUID=c27a9e41-5b3d-4f8a-a1e6-9d0b2c4f7e13  /srv/scans  ext4  defaults,nofail  0  2';

    it('chapter 4 — solution: the journal, lsblk -f, fstab by UUID with nofail, findmnt --verify, daemon-reload, mount -a, systemctl default', () => {
      const { s, jouer: play } = part('stuck-boot');
      expect(s.who).toBe('root');
      let all = play(['cat message_from_odile.txt', 'journalctl -xb -p err', 'lsblk -f', 'findmnt --verify', 'mount -a']);
      expect(all).toContain('You are in emergency mode.');
      expect(all).toContain('Timed out waiting for device dev-sdc1.device - /dev/sdc1.');
      expect(all).toContain('Dependency failed for local-fs.target - Local File Systems.');
      expect(all).toMatch(/└─sde1 +ext4 +SCANS +c27a9e41-5b3d-4f8a-a1e6-9d0b2c4f7e13/);
      expect(all).toContain('[E] unreachable source: /dev/sdc1: No such file or directory');
      expect(all).toContain('mount: /srv/scans: special device /dev/sdc1 does not exist.');
      contains(all, 'systemd a attendu /dev/sdc1');
      contains(all, 'entré dans md2');
      all = fix(s, BY_UUID);
      contains(all, 'fstab est juste');
      all = play(['findmnt --verify', 'systemctl daemon-reload', 'mount -a', 'findmnt /srv/scans']);
      expect(all).toContain('Success, no errors or warnings detected');
      expect(all).toMatch(/\/srv\/scans \/dev\/sde1 +ext4/);
      expect(s.finished).toBe(false);
      all = play(['systemctl default', 'systemctl is-active nginx']);
      contains(all, 'Tu as terminé le chapitre 4');
      expect(all).toContain('active');
      expect(s.finished).toBe(true);
    });

    it('chapter 4 — another solution: LABEL=, then reboot (systemd rereads fstab at boot)', () => {
      const { s, jouer: play } = part('stuck-boot');
      fix(s, 'LABEL=SCANS /srv/scans ext4 nofail 0 2');
      play(['blkid -L SCANS', 'reboot']);
      expect(s.state.rescue).toBe(false);
      expect(s.finished).toBe(true);
    });

    it('chapter 4 — false leads: resuming too early, /dev/sde1, without nofail, without daemon-reload, the line deleted', () => {
      const { s, jouer: play } = part('stuck-boot');
      // Resuming the boot without fixing anything: back to rescue mode.
      let all = play(['exit']);
      expect(all).toContain('You are in emergency mode.');
      contains(all, 'corriger fstab');
      expect(s.state.rescue).toBe(true);
      // The line deleted: the server would boot, but without the scans.
      all = fix(s, null);
      contains(all, 'ne seraient plus jamais montés');
      s.execute('nano /etc/fstab');
      s.saveEdition(s.edition!.text + '\n' + THEO_LINE + '\n');
      s.quitEdition();
      // /dev/sde1 : juste aujourd'hui, fragile demain.
      all = fix(s, '/dev/sde1  /srv/scans  ext4  defaults  0  2');
      contains(all, 'prochain disque ajouté');
      // The right UUID, without nofail.
      s.execute('nano /etc/fstab');
      s.saveEdition(s.edition!.text.replace('/dev/sde1  /srv/scans  ext4  defaults  0  2', 'UUID=c27a9e41-5b3d-4f8a-a1e6-9d0b2c4f7e13  /srv/scans  ext4  defaults  0  2'));
      all = s.quitEdition();
      contains(all, 'nofail');
      // With nofail, but systemd hasn't reread fstab: systemctl default falls back again.
      s.execute('nano /etc/fstab');
      s.saveEdition(s.edition!.text.replace('ext4  defaults  0  2', 'ext4  defaults,nofail  0  2'));
      s.quitEdition();
      all = play(['systemctl default']);
      expect(all).toContain('You are in emergency mode.');
      contains(all, 'ancienne version');
      // An unreadable line is reported by mount -a.
      all = play(['systemctl daemon-reload', 'mount -a', 'systemctl default']);
      expect(s.finished).toBe(true);
    });

    it('chapter 4 — the messages: blkid, findmnt, mount (an unreadable line, an unknown source)', () => {
      const { s, jouer: play } = part('stuck-boot');
      s.execute('nano /etc/fstab');
      s.saveEdition(s.edition!.text + '\n/dev/sdz9 /mnt\n');
      contains(s.quitEdition(), 'une ligne illisible');
      const all = play(['mount -a', 'findmnt --verify', 'blkid /dev/sdz9', 'blkid -U c27a9e41-5b3d-4f8a-a1e6-9d0b2c4f7e13', 'mount /srv/scans', 'mount /nowhere']);
      expect(all).toMatch(/mount: \/etc\/fstab: parse error at line \d+ -- ignored/);
      expect(all).toMatch(/1 parse error, 1 error, 0 warnings/);
      expect(all).toContain('/dev/sde1');
      expect(all).toContain("mount: /nowhere: can't find in /etc/fstab.");
      for (const c of ['blkid', 'findmnt', 'fstab']) expect(s.execute(`man ${c}`)).toMatch(new RegExp(`${c.toUpperCase()}\\([58]\\)`));
    });

    it('the story opens after "The full disk", and is played from the workstation', () => {
      const before = prerequisites('lab');
      expect(before).toContain('full-disk');
      const c = new Console({ language, finished: before });
      expect(c.isOpen('lab')).toBe(true);
      const all = [c.execute(machinesInLanguage(translator(language), 'ssh lab')), c.execute('yes')].join('\n');
      expect(all).toContain(machinesInLanguage(translator(language), 'lab.internal'));
      expect(c.remote?.shell.chapter.id).toBe('tired-disk');
      expect(new Console({ language, finished: before.filter((x) => x !== 'full-disk') }).isOpen('lab')).toBe(false);
    });
  });
