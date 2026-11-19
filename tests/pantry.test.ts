// The Pantry: an encrypted backup disk (LUKS), a restic key that doesn't
// live on the server, and a restore drill on a borrowed laptop. Replayed
// with the console, in every language; the expected texts are checked in
// French. Also: cryptsetup's and restic's outputs and errors.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { storageOf } from '../src/engine/storage';
import { machineName } from '../src/engine/machines';
import { sha256 } from '../src/engine/commands/checksums';

const BEFORE = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('pantry')])];
const MDP = 'shelf-2029';
const DISK = 'tram-lemon-harbour-58';
const RECOVERY = 'basket-orchard-copper-73';

describe('sha256', () => {
  it('matches the reference digests', () => {
    expect(sha256(new TextEncoder().encode(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256(new TextEncoder().encode('a'.repeat(1000)))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
  });
});

for (const language of LANGUAGES)
  describe(`The Pantry — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => inLanguage(t, line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...BEFORE, ...finished] });
      const one = (l: string) => {
        let output = c.execute(machinesInLanguage(c.t, L(l))) ?? '';
        if (c.shell.waiting) output += '\n' + (c.execute(machinesInLanguage(c.t, MDP)) ?? '');
        return output;
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        one(command);
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      play(['ssh crate', 'yes']);
      const main = () => ((c.shell as unknown as { principal: typeof c.shell }).principal ?? c.shell);
      return { c, play, edit, st: () => storageOf(main())!, flag: (id: string) => main().flags.has(id), done: (id: string) => c.finished.includes(id) };
    };
    const uuidOf = (st: ReturnType<typeof storageOf>, dev = '/dev/sdb1') => st!.luks![dev].uuid;

    // ——— Chapter 1: "The Lost Disk" ———

    it('chapter 1 — solution: unmount, luksFormat, open, mkfs, key file, crypttab, fstab, copy, close, note', () => {
      const { play, edit, st, flag, done } = part();
      let all = play(['cat note_from_mei.txt', 'lsblk -f']);
      expect(all).toMatch(/sdb1 ext4 +OFFSITE .*\/mnt\/offsite/);
      contains(all, 'un disque amovible (RM 1)');
      all = play(['sudo umount /mnt/offsite', 'sudo cryptsetup luksFormat /dev/sdb1']);
      expect(all).toContain("WARNING: Device /dev/sdb1 already contains a 'ext4' superblock signature.");
      expect(all).toContain('This will overwrite data on /dev/sdb1 irrevocably.');
      all = play(['YES', DISK, DISK]);
      expect(flag('formatted')).toBe(true);
      contains(all, 'Le périphérique est maintenant en LUKS');
      all = play(['sudo cryptsetup open /dev/sdb1 offsite', DISK, 'lsblk']);
      expect(all).toMatch(/└─offsite 253:0 +0 +1\.8T +0 crypt/);
      all = play(['sudo mkfs.ext4 /dev/mapper/offsite']);
      expect(all).toContain('mke2fs 1.47.2 (1-Jan-2025)');
      expect(all).toContain('Writing superblocks and filesystem accounting information: done');
      all = play(['sudo dd if=/dev/urandom of=/root/offsite.key bs=512 count=8', 'sudo chmod 400 /root/offsite.key', 'sudo cryptsetup luksAddKey /dev/sdb1 /root/offsite.key', DISK]);
      expect(all).toContain('4096 bytes (4.1 kB, 4.0 KiB) copied');
      expect(flag('keyfile')).toBe(true);
      expect(flag('keyfile-open')).toBe(false);
      all = play(['sudo cryptsetup luksDump /dev/sdb1']);
      expect(all).toMatch(/Keyslots:\n {2}0: luks2[\s\S]*\n {2}1: luks2/);
      all = play(['sudo blkid /dev/sdb1']);
      expect(all).toContain(`/dev/sdb1: UUID="${uuidOf(st())}" TYPE="crypto_LUKS"`);
      play([`echo "offsite UUID=${uuidOf(st())} /root/offsite.key luks,noauto" | sudo tee -a /etc/crypttab`]);
      expect(flag('crypttab')).toBe(true);
      all = edit('sudo nano /etc/fstab', (x) => x.replace(/^LABEL=OFFSITE.*$/m, '/dev/mapper/offsite /mnt/offsite ext4 noauto,nofail 0 2'));
      expect(flag('fstab')).toBe(true);
      all = play(['sudo mount /mnt/offsite', 'sudo rsync -a /srv/pantry /mnt/offsite/', 'sudo cryptsetup status offsite']);
      expect(all).toContain('/dev/mapper/offsite is active and is in use.');
      contains(all, 'cette semaine au moins, il y a une sauvegarde');
      all = play(['sudo cryptsetup close offsite']);
      expect(all).toContain('Device offsite is still in use.');
      all = play(['sudo umount /mnt/offsite', 'sudo cryptsetup close offsite', 'sudo cryptsetup status offsite']);
      expect(all).toContain('/dev/mapper/offsite is inactive.');
      expect(done('lost-disk')).toBe(false);
      all = play(['rm note_from_mei.txt']);
      contains(all, 'Vous avez terminé le chapitre 1 de L\'Épicerie solidaire');
      expect(done('lost-disk')).toBe(true);
    });

    it('chapter 1 — another solution: the whole disk, the key file first, crypttab by-uuid, cryptdisks_start and cp', () => {
      const { play, edit, st, done } = part();
      play(['sudo umount /mnt/offsite', 'sudo dd if=/dev/urandom of=/root/offsite.key bs=1024 count=4', 'sudo chmod 600 /root/offsite.key']);
      play(['sudo cryptsetup luksFormat /dev/sdb /root/offsite.key', 'YES']);
      expect(st().luks!['/dev/sdb']).toBeDefined();
      expect(st().disks.sdb.partitions).toHaveLength(0);
      play(['sudo cryptsetup luksAddKey /dev/sdb --key-file /root/offsite.key', DISK, DISK]);
      play([`echo "usbcrypt /dev/disk/by-uuid/${uuidOf(st(), '/dev/sdb')} /root/offsite.key luks,nofail" | sudo tee -a /etc/crypttab`, 'sudo cryptdisks_start usbcrypt', 'sudo mkfs.ext4 -L PANTRY /dev/mapper/usbcrypt']);
      edit('sudo nano /etc/fstab', (x) => x.replace(/^LABEL=OFFSITE.*$/m, '/dev/mapper/usbcrypt /mnt/offsite ext4 noauto 0 2'));
      play(['sudo mount /mnt/offsite', 'sudo cp -r /srv/pantry /mnt/offsite/', 'sudo umount /mnt/offsite', 'sudo cryptdisks_stop usbcrypt', 'rm note_from_mei.txt']);
      expect(done('lost-disk')).toBe(true);
    });

    it('chapter 1 — false leads: the system disk, a mounted disk, "yes", mkfs on the header, an open key file, /dev/sdb1 in crypttab', () => {
      const { play, edit, st, flag, done } = part();
      let all = play(['sudo cryptsetup luksFormat /dev/sda1']);
      expect(all).toContain('Device /dev/sda1 is in use. Can not proceed with format operation.');
      contains(all, 'sda est le disque de cagette');
      all = play(['sudo cryptsetup luksFormat /dev/sdb1']);
      expect(all).toContain('Device /dev/sdb1 is in use. Can not proceed with format operation.');
      contains(all, 'démontez-le d\'abord');
      all = play(['sudo umount /mnt/offsite', 'sudo cryptsetup luksFormat /dev/sdb1', 'yes']);
      expect(all).toContain('Operation aborted.');
      contains(all, 'en majuscules');
      expect(st().luks?.['/dev/sdb1']).toBeUndefined();
      // The encrypted device mounted directly, then overwritten by mkfs.
      play(['sudo cryptsetup luksFormat /dev/sdb1', 'YES', DISK, 'not-the-same']);
      expect(st().luks?.['/dev/sdb1']).toBeUndefined();
      all = play(['sudo cryptsetup luksFormat /dev/sdb1', 'YES', DISK, DISK, 'sudo mount /dev/sdb1 /mnt/offsite']);
      expect(all).toContain("mount: /mnt/offsite: unknown filesystem type 'crypto_LUKS'.");
      contains(all, 'ne se monte jamais lui-même');
      all = play(['sudo mkfs.ext4 /dev/sdb1', 'y']);
      expect(flag('mkfs-header')).toBe(true);
      expect(st().luks?.['/dev/sdb1']).toBeUndefined();
      // Again, properly; a key file readable by all, a passphrase nobody else knows.
      play(['sudo cryptsetup luksFormat /dev/sdb1', 'YES', 'my-own-secret', 'my-own-secret']);
      expect(flag('own-passphrase')).toBe(true);
      play(['sudo cryptsetup open /dev/sdb1 offsite', 'wrong', 'my-own-secret', 'sudo mkfs.ext4 /dev/mapper/offsite']);
      all = play(['sudo dd if=/dev/urandom of=/root/offsite.key bs=512 count=8', 'sudo cryptsetup luksAddKey /dev/sdb1 /root/offsite.key', 'my-own-secret']);
      contains(all, 'quelqu\'un d\'autre que root peut');
      play(['sudo cryptsetup luksAddKey /dev/sdb1 --key-file /root/offsite.key', DISK, DISK, 'sudo cryptsetup luksRemoveKey /dev/sdb1', 'my-own-secret']);
      expect(Object.values(st().luks!['/dev/sdb1'].slots).map((k) => k.kind).sort()).toEqual(['keyfile', 'passphrase']);
      all = play([`echo "offsite /dev/sdb1 /root/offsite.key luks,noauto" | sudo tee -a /etc/crypttab`]);
      contains(all, 'désigne le disque par /dev/sdX');
      edit('sudo nano /etc/crypttab', (x) => x.replace('/dev/sdb1', `UUID=${uuidOf(st())}`));
      edit('sudo nano /etc/fstab', (x) => x.replace(/^LABEL=OFFSITE.*$/m, '/dev/mapper/offsite /mnt/offsite ext4 noauto,nofail 0 2'));
      play(['sudo mount /mnt/offsite', 'sudo rsync -a /srv/pantry /mnt/offsite/', 'sudo umount /mnt/offsite', 'sudo cryptdisks_stop offsite', 'rm note_from_mei.txt']);
      // The key file is still readable by everyone.
      expect(done('lost-disk')).toBe(false);
      all = play(['sudo cryptdisks_start offsite']);
      expect(all).toContain('WARNING: key file /root/offsite.key has insecure permissions, owner, or mode.');
      play(['sudo cryptdisks_stop offsite', 'sudo chmod 400 /root/offsite.key']);
      expect(done('lost-disk')).toBe(true);
    });

    // ——— Chapter 2: "The Spare Key" ———

    it('chapter 2 — solution: the job\'s variables, sudo -E, key list, key add, check, note, close', () => {
      const { play, flag, done } = part(['lost-disk']);
      let all = play(['sudo cryptdisks_start offsite', 'sudo mount /mnt/offsite', 'sudo cat /usr/local/sbin/nightly-backup']);
      expect(all).toContain('offsite (started)...done.');
      expect(all).toContain('export RESTIC_PASSWORD_FILE=/root/.restic-pass');
      contains(all, 'il exporte deux variables');
      all = play(['export RESTIC_REPOSITORY=/mnt/offsite/restic RESTIC_PASSWORD_FILE=/root/.restic-pass', 'sudo restic snapshots']);
      expect(all).toContain('Fatal: Please specify repository location (-r or --repository-file)');
      contains(all, 'sudo le lance avec un environnement vide');
      all = play(['sudo -E restic snapshots', 'sudo -E restic key list']);
      expect(all).toMatch(/^4 snapshots$/m);
      expect(all).toMatch(/^ ID +User +Host +Created$/m);
      expect(all.match(/^[* ][0-9a-f]{8} {2}root/gm)).toHaveLength(1);
      all = play(['sudo restic -r /mnt/offsite/restic snapshots', RECOVERY]);
      expect(all).toContain('Fatal: wrong password or no key found');
      contains(all, 'n\'ouvre rien aujourd\'hui');
      all = play(['sudo -E restic key add', RECOVERY, RECOVERY]);
      expect(all).toMatch(/saved new key with ID [0-9a-f]{64}/);
      expect(flag('escrowed')).toBe(true);
      all = play(['sudo -E restic check']);
      expect(all).toContain('no errors were found');
      expect(flag('checked')).toBe(true);
      play(['rm note_from_mei.txt', 'sudo umount /mnt/offsite']);
      expect(done('spare-key')).toBe(false);
      all = play(['sudo cryptdisks_stop offsite']);
      contains(all, 'Vous avez terminé le chapitre 2');
      expect(done('spare-key')).toBe(true);
    });

    it('chapter 2 — another solution: -r and -p, the password typed, cryptsetup open', () => {
      const { play, done } = part(['lost-disk']);
      play(['sudo cryptsetup open /dev/sdb1 offsite', DISK, 'sudo mount /dev/mapper/offsite /mnt/offsite']);
      play(['sudo RESTIC_PASSWORD_FILE=/root/.restic-pass restic -r /mnt/offsite/restic key add --user mei --host envelope', RECOVERY, RECOVERY]);
      play(['sudo restic -r /mnt/offsite/restic check --read-data', RECOVERY, 'sudo restic -r /mnt/offsite/restic -p /root/.restic-pass key list']);
      play(['rm note_from_mei.txt', 'sudo umount /mnt/offsite', 'sudo cryptsetup close offsite']);
      expect(done('spare-key')).toBe(true);
    });

    it('chapter 2 — false leads: init, key passwd, removing the current key, the password written down', () => {
      const { play, flag, done } = part(['lost-disk']);
      play(['sudo cryptdisks_start offsite', 'sudo mount /mnt/offsite']);
      let all = play(['sudo restic -r /mnt/offsite/restic -p /root/.restic-pass init']);
      expect(all).toContain('Fatal: create repository at /mnt/offsite/restic failed: config file already exists');
      contains(all, 'crée un NOUVEAU dépôt');
      all = play(['sudo restic -r /mnt/offsite/restic -p /root/.restic-pass key passwd', RECOVERY, RECOVERY]);
      expect(all).toMatch(/saved new key as [0-9a-f]{64}/);
      contains(all, 'plus aucune clé n\'ouvre le dépôt');
      expect(flag('nightly-broken')).toBe(true);
      all = play(['sudo restic -r /mnt/offsite/restic -p /root/.restic-pass snapshots']);
      expect(all).toContain('Fatal: wrong password or no key found');
      // Put the job's key back, from its own file.
      play(['sudo restic -r /mnt/offsite/restic key add --new-password-file /root/.restic-pass', RECOVERY]);
      all = play(['sudo restic -r /mnt/offsite/restic -p /root/.restic-pass key list']);
      expect(all.match(/^[* ][0-9a-f]{8} {2}root/gm)).toHaveLength(2);
      const current = /^\*([0-9a-f]{8})/m.exec(all)![1];
      all = play([`sudo restic -r /mnt/offsite/restic -p /root/.restic-pass key remove ${current}`]);
      expect(all).toContain('Fatal: refusing to remove key currently used to access repository');
      all = play([`echo "${RECOVERY}" > restic-recovery.txt`]);
      contains(all, 'dans un fichier sur cagette');
      play(['sudo restic -r /mnt/offsite/restic -p /root/.restic-pass check', 'rm note_from_mei.txt', 'sudo umount /mnt/offsite', 'sudo cryptdisks_stop offsite']);
      expect(done('spare-key')).toBe(false);
      play(['rm restic-recovery.txt']);
      expect(done('spare-key')).toBe(true);
    });

    // ——— Chapter 3: "The Restore Drill" ———

    const RESTIC = 'sudo restic -r /mnt/offsite/restic';
    it('chapter 3 — solution: open with the envelope, check --read-data, restore beside, sha256sum -c, the missing dump, close', () => {
      const { play, edit, flag, done } = part(['lost-disk', 'spare-key']);
      let all = play(['cat drill.txt', 'sudo cat /var/log/nightly-backup.log']);
      contains(all, 'il ne dit pas ce qui a été sauvegardé');
      all = play([`ssh ${machineName(t, 'spare')}`, 'yes', 'lsblk -f']);
      expect(all).toMatch(/sdb1 crypto_LUKS/);
      all = play(['sudo cryptsetup open /dev/sdb1 offsite', DISK, 'sudo mkdir /mnt/offsite', 'sudo mount /dev/mapper/offsite /mnt/offsite']);
      contains(all, 'la seule phrase de passe de l\'enveloppe');
      all = play([`${RESTIC} snapshots`, RECOVERY]);
      expect(all).toMatch(/^8 snapshots$/m);
      expect(flag('snapshots')).toBe(true);
      all = play([`${RESTIC} check`, RECOVERY]);
      contains(all, 'pas le contenu des paquets');
      all = play([`${RESTIC} check --read-data`, RECOVERY]);
      expect(all).toContain('read all data');
      all = play([`${RESTIC} restore latest --target /srv/restore`, RECOVERY]);
      expect(all).toMatch(/restoring snapshot [0-9a-f]{8} of \[\/srv\/\w+\]/);
      all = play(['cd /srv/restore/srv/pantry', 'sha256sum -c SHA256SUMS']);
      expect(all).toContain(`${t('name-families-csv')}: OK`);
      contains(all, 'la restauration est exacte');
      all = play([`${RESTIC} find pantry.sql`, RECOVERY]);
      contains(all, 'Aucun pantry.sql dans aucun instantané');
      play(['cd', 'sudo umount /mnt/offsite', 'sudo cryptsetup close offsite', 'exit']);
      expect(done('restore-drill')).toBe(false);
      all = edit('sudo nano /usr/local/sbin/nightly-backup', (x) => x.replace(/^restic backup (\S+)$/m, 'restic backup $1 /var/backups/pantry.sql'));
      contains(all, 'Vous avez terminé L\'Épicerie solidaire');
      expect(done('restore-drill')).toBe(true);
    });

    it('chapter 3 — false leads: crate\'s secret on spare, the job\'s password, a restore over /, a damaged file', () => {
      const { play, edit, flag, done } = part(['lost-disk', 'spare-key']);
      edit('sudo nano /usr/local/sbin/nightly-backup', (x) => x.replace(/^restic backup (\S+)$/m, 'restic backup $1 /var/backups'));
      expect(flag('fixed')).toBe(true);
      play([`ssh ${machineName(t, 'spare')}`, 'yes', 'echo Vq3tN8sLw2ZpR6kD-x4Hm > pass.txt']);
      expect(flag('copied-secret')).toBe(true);
      play(['sudo cryptsetup open /dev/sdb1 offsite', DISK, 'sudo mkdir /mnt/offsite', 'sudo mount /dev/mapper/offsite /mnt/offsite']);
      let all = play([`${RESTIC} -p pass.txt snapshots`]);
      expect(all).toMatch(/^8 snapshots$/m);
      expect(flag('nightly-key')).toBe(true);
      all = play([`${RESTIC} check --read-data`, RECOVERY, `${RESTIC} restore latest --target /`, RECOVERY]);
      contains(all, 'écraserait les données du jour');
      play(['cd /srv/pantry']);
      all = play(['echo damaged | sudo tee stock.csv', 'sha256sum -c SHA256SUMS']);
      expect(all).toContain('stock.csv: FAILED');
      expect(all).toContain('sha256sum: WARNING: 1 computed checksum did NOT match');
      expect(flag('mismatch')).toBe(true);
      play([`${RESTIC} restore latest --target /srv/restore`, RECOVERY, 'cd /srv/restore/srv/pantry', 'sha256sum -c SHA256SUMS', 'cd', 'sudo umount /mnt/offsite', 'sudo cryptsetup close offsite']);
      // The job's password is still on spare.
      expect(done('restore-drill')).toBe(false);
      play(['rm pass.txt']);
      expect(done('restore-drill')).toBe(true);
    });
  });
