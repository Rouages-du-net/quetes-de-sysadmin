// Le Labo : les disques du serveur du club photo (SMART, RAID logiciel,
// remplacement d'un disque). Chaque chapitre est rejoué jusqu'au bout, avec
// une autre solution et des fausses pistes, dans chaque langue ; les textes
// attendus sont vérifiés en français. Aussi : les sorties de smartctl,
// mdadm, sfdisk, lsblk et /proc/mdstat, et leurs messages d'erreur.

import { describe, expect, it } from 'vitest';
import { machineName } from '../src/engine/machines';
import { Shell } from '../src/engine/shell';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { SERIES } from '../src/engine/chapters/lab';
import { stockage } from '../src/engine/storage';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const MDP = 'argentique-2027';

for (const language of LANGUAGES)
  describe(`Le Labo — ${language}`, () => {
    const fr = language === 'fr';
    const L = (line: string) => inLanguage(translator(language), line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    // Une partie : chaque ligne (écrite avec les noms français), avec le mot de passe de sudo s'il est demandé.
    function part(id: string) {
      const s = new Shell(chapter(id), language);
      const one = (l: string) => {
        let output = s.execute(L(l)) ?? '';
        if (s.waiting) output += '\n' + (s.execute(machinesInLanguage(s.t, MDP)) ?? '');
        const errors = s.recoverErrors();
        return [output, ...errors].filter(Boolean).join('\n');
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      return { s, jouer: play, st: () => stockage(s)! };
    }

    it('chapitre 1 — solution : courriers, mdstat, SMART des deux disques, sdb sorti de md0 et md1, ticket', () => {
      const { s, jouer: play, st } = part('fatigue');
      let all = play(['cat message_d_odile.txt', 'mail', 'cat /var/mail/vous', 'cat /proc/mdstat']);
      expect(all).toContain(`SMART error (CurrentPendingSector) detected on host: ${machineName(translator(language), 'labo')}`);
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
      all = play(['lsblk -d -o NAME,SERIAL', `echo "Merci de remplacer le disque S/N ${SERIES.sdb}" > ~/ticket.txt`]);
      expect(all).toMatch(new RegExp(`sdb\\s+${SERIES.sdb}`));
      contains(all, 'Tu as terminé le chapitre 1 du Labo');
      expect(Object.values(st().arrays).every((g) => g.members.length === 1)).toBe(true);
      expect(s.finished).toBe(true);
    });

    it('chapitre 1 — fausses pistes : retirer sans --fail, sortir le disque sain, un ticket au mauvais numéro', () => {
      const { s, jouer: play, st } = part('fatigue');
      // Un membre actif ne se retire pas.
      let all = play(['sudo mdadm /dev/md0 --remove /dev/sdb2']);
      expect(all).toContain('mdadm: hot remove failed for /dev/sdb2: Device or resource busy');
      contains(all, 'on ne retire pas un membre actif');
      // Le disque sain sorti par erreur : la grappe ne tient plus que sur sdb.
      all = play(['sudo mdadm /dev/md0 --fail /dev/sda2', 'cat /proc/mdstat']);
      expect(all).toContain('md0 : active raid1 sdb2[1] sda2[0](F)');
      contains(all, 'le disque SAIN');
      // md refuse alors de sortir le dernier membre à jour.
      all = play(['sudo mdadm /dev/md0 --fail /dev/sdb2']);
      expect(all).toContain('mdadm: set device faulty failed for /dev/sdb2:  Device or resource busy');
      // On répare : retirer, puis remettre (--re-add), et il se remet à jour.
      all = play(['sudo mdadm /dev/md0 --re-add /dev/sda2']);
      expect(all).toContain('mdadm: Cannot open /dev/sda2: Device or resource busy');
      play(['sudo mdadm /dev/md0 --remove /dev/sda2', 'sudo mdadm /dev/md0 --re-add /dev/sda2', 'cat /proc/mdstat']);
      expect(st().arrays.md0.members.find((m) => m.part === 'sda2')?.state).toBe('actif');
      // Puis le bon disque, dans les deux grappes.
      play(['sudo mdadm /dev/md0 --fail /dev/sdb2 --remove /dev/sdb2', 'sudo mdadm /dev/md1 --fail /dev/sdb3 --remove /dev/sdb3']);
      // Un ticket avec le numéro de sda : refusé (on débrancherait le disque sain).
      all = play([`echo "Disque à remplacer : ${SERIES.sda}" > ~/ticket.txt`]);
      contains(all, 'le numéro de série de sda');
      expect(s.finished).toBe(false);
      play([`echo "Disque à remplacer : ${SERIES.sdb}" > ~/ticket.txt`]);
      expect(s.finished).toBe(true);
    });

    it('chapitre 2 — solution : la table de sda recopiée, les deux partitions ajoutées, la reconstruction, GRUB', () => {
      const { s, jouer: play, st } = part('disque-neuf');
      let all = play(['cat message_d_odile.txt', 'lsblk', 'cat /proc/mdstat']);
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
      // La reconstruction prend quelques commandes.
      for (let i = 0; i < 6 && !st().arrays.md1.members.every((m) => m.state === 'actif'); i++) play(['cat /proc/mdstat']);
      all = play(['cat /proc/mdstat']);
      expect(all).toContain('md1 : active raid1 sdb3[1] sda3[0]\n      1919824896 blocks super 1.2 [2/2] [UU]');
      all = play(['sudo grub-install /dev/sdb']);
      expect(all).toContain('Installation finished. No error reported.');
      contains(all, 'Tu as terminé le chapitre 2 du Labo');
      expect(s.finished).toBe(true);
    });

    it('chapitre 2 — autre solution : GRUB d’abord, une seule commande mdadm par grappe, la table gardée dans un fichier', () => {
      const { s, jouer: play } = part('disque-neuf');
      play(['sudo sfdisk -d /dev/sda > table.txt', 'cat table.txt | sudo sfdisk /dev/sdb', 'sudo grub-install /dev/sdb', 'sudo mdadm /dev/md1 -a /dev/sdb3', 'sudo mdadm /dev/md0 -a /dev/sdb2']);
      for (let i = 0; i < 8 && !s.finished; i++) play(['sudo mdadm --detail /dev/md1']);
      expect(s.finished).toBe(true);
    });

    it('chapitre 2 — fausses pistes : ajouter trop tôt, le sens inversé, le disque entier, GRUB sur une partition', () => {
      const { s, jouer: play, st } = part('disque-neuf');
      let all = play(['sudo mdadm --manage /dev/md0 --add /dev/sdb2']);
      expect(all).toContain('mdadm: Cannot find /dev/sdb2: No such file or directory');
      contains(all, 'sdb est encore vierge');
      // Le sens inversé : sfdisk refuse d'écrire sur sda, en service.
      all = play(['sudo sfdisk -d /dev/sdb | sudo sfdisk /dev/sda']);
      expect(all).toContain('sfdisk: /dev/sdb: does not contain a recognized partition table');
      expect(all).toContain('This disk is currently in use - repartitioning is probably a bad idea.');
      contains(all, 'le disque nommé en dernier qui est écrasé');
      expect(st().disks.sda.partitions).toHaveLength(3);
      // GRUB sur un disque vierge (pas de partition BIOS boot), puis sur une partition.
      all = play(['sudo grub-install /dev/sdb']);
      expect(all).toContain('this GPT partition label contains no BIOS Boot Partition');
      // Le disque entier dans une grappe : il écrase sa table.
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

    it('les messages des outils : sans root, sans argument, inconnu, option inconnue', () => {
      const { s, jouer: play } = part('fatigue');
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
        'lsblk -o NAME,COULEUR',
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
      expect(all).toContain('ARRAY /dev/md/0 metadata=1.2 name=labo:0 UUID=5d1e0a3c:7b2f4e91:a6c83f0d:9b1e2c47');
      expect(all).toContain('lsblk: unknown column: COULEUR');
      expect(all).toContain('Testing has begun.');
      expect(all).toMatch(/# 1  Short offline\s+Completed: read failure\s+90%/);
      // sfdisk et grub-install : au chapitre 2.
      const two = part('disque-neuf');
      const outputs = two.jouer(['sudo sfdisk -l /dev/sda', 'sudo sfdisk --force /dev/sdb', 'sudo sfdisk /dev/sdb', 'sudo sfdisk -d /dev/sda | sudo sfdisk /dev/sda', 'sudo grub-install /dev/sdz']);
      expect(outputs).toMatch(/\/dev\/sda3\s+67112960 3907029134 3839916175\s+1\.8T Linux RAID/);
      expect(outputs).toContain("sfdisk: unrecognized option '--force'");
      contains(outputs, 'le mode interactif');
      expect(outputs).toContain('This disk is currently in use');
      expect(outputs).toContain('grub-install: error: cannot find a GRUB drive for /dev/sdz.  Check your device.map.');
      // Le manuel : chaque commande a sa page et son --help.
      for (const c of ['smartctl', 'mdadm']) {
        expect(s.execute(`man ${c}`)).toContain(`${c.toUpperCase()}(8)`);
        expect(s.execute(`${c} --help`)).toBeTruthy();
      }
      for (const c of ['sfdisk', 'grub-install']) expect(two.s.execute(`man ${c}`)).toContain(`${c.toUpperCase()}(8)`);
      expect(play(['man -k RAID'])).toContain('mdadm (8)');
    });

    it('chapitre 3 — solution : une grappe des disques neufs, pvcreate, vgextend, lvextend puis resize2fs, mdadm.conf, initramfs', () => {
      const { s, jouer: play, st } = part('agrandir');
      let all = play(['cat message_d_odile.txt', 'df -h /srv', 'sudo vgs', 'lsblk']);
      expect(all).toMatch(/\/dev\/mapper\/labo-photos.* 97% \/srv/);
      expect(all).toMatch(/labo +1 +1 +0 wz--n- <1\.79t +0\n/);
      expect(all).toMatch(/^sdc +8:32 +0 3\.6T +0 disk$/m);
      contains(all, 'un volume logique LVM');
      all = play(['sudo mdadm --create /dev/md2 --level=1 --raid-devices=2 /dev/sdc /dev/sdd']);
      expect(all).toContain('may not be suitable as a boot device');
      all = play(['y', 'cat /proc/mdstat']);
      expect(all).toContain('mdadm: array /dev/md2 started.');
      expect(all).toMatch(/md2 : active raid1 sdd\[1\] sdc\[0\]\n +\d+ blocks super 1\.2 \[2\/2\] \[UU\]\n +\[=*>\.*\] +resync = /);
      all = play(['sudo pvcreate /dev/md2', 'sudo vgextend labo /dev/md2', 'sudo lvextend -l +100%FREE /dev/labo/photos', 'df -h /srv']);
      expect(all).toContain('Physical volume "/dev/md2" successfully created.');
      expect(all).toContain('Volume group "labo" successfully extended');
      expect(all).toMatch(/Size of logical volume labo\/photos changed from <1\.79 TiB \(\d+ extents\) to <5\.43 TiB/);
      expect(all).toMatch(/ 97% \/srv/);
      contains(all, 'df ne voit rien');
      all = play(['sudo resize2fs /dev/mapper/labo-photos', 'df -h /srv']);
      expect(all).toContain('on-line resizing required');
      expect(all).toMatch(/ 32% \/srv/);
      expect(s.finished).toBe(false);
      all = play(['sudo mdadm --detail --brief /dev/md2 | sudo tee -a /etc/mdadm/mdadm.conf']);
      expect(all).toMatch(/^ARRAY \/dev\/md2 metadata=1\.2 name=labo:2 UUID=[0-9a-f:]{35}$/m);
      expect(s.finished).toBe(false);
      all = play(['sudo update-initramfs -u']);
      expect(all).toContain('update-initramfs: Generating /boot/initrd.img-6.12.48+deb13-amd64');
      contains(all, 'Tu as terminé le chapitre 3 du Labo');
      expect(Object.keys(st().lvm!.pvs).sort()).toEqual(['md1', 'md2']);
      expect(s.finished).toBe(true);
    });

    it('chapitre 3 — autre solution : --run, vgextend sans pvcreate, lvextend -r -L, mdadm.conf écrit avec nano', () => {
      const { s, jouer: play } = part('agrandir');
      let all = play(['sudo mdadm -C /dev/md2 -l1 -n2 --run /dev/sdc /dev/sdd', 'sudo vgextend labo /dev/md2', 'sudo lvextend -r -L +2T /dev/labo/photos']);
      expect(all).toContain('Physical volume "/dev/md2" successfully created.');
      expect(all).toContain('File system ext4 found on labo/photos mounted at /srv.');
      expect(all).toContain('Extended file system ext4 on labo/photos.');
      all = play(['sudo mdadm --detail --brief /dev/md2']);
      const line = /ARRAY .*/.exec(all)![0];
      s.execute('sudo nano /etc/mdadm/mdadm.conf');
      s.saveEdition(s.edition!.text + '\n' + line + '\n');
      s.quitEdition();
      play(['sudo update-initramfs -u']);
      expect(s.finished).toBe(true);
    });

    it('chapitre 3 — fausse piste : un disque seul dans le groupe, réparé par une grappe dégradée et pvmove', () => {
      const { s, jouer: play, st } = part('agrandir');
      // sdc donné tel quel à LVM, et le volume agrandi dessus : plus de redondance.
      let all = play(['sudo vgextend labo /dev/sdc', 'sudo lvextend -r -L +500G /dev/labo/photos']);
      expect(all).toContain('Volume group "labo" successfully extended');
      contains(all, 'tel quel, sans');
      // Il ne peut ni entrer dans une grappe, ni quitter le groupe tant qu'il porte des données.
      all = play(['sudo mdadm --create /dev/md2 --level=1 --raid-devices=2 /dev/sdc /dev/sdd', 'sudo vgreduce labo /dev/sdc', 'sudo pvmove /dev/sdc']);
      expect(all).toContain('mdadm: cannot open /dev/sdc: Device or resource busy');
      expect(all).toContain('Physical volume "/dev/sdc" still in use');
      expect(all).toMatch(/Insufficient free space: \d+ extents needed, but only 0 available/);
      // Une grappe dégradée sur sdd, les données déménagées, sdc libéré puis ajouté à la grappe.
      all = play([
        'sudo mdadm --create /dev/md2 --level=1 --raid-devices=2 --run /dev/sdd missing',
        'sudo vgextend labo /dev/md2',
        'sudo pvmove /dev/sdc /dev/md2',
        'sudo vgreduce labo /dev/sdc',
        'sudo pvremove /dev/sdc',
        'sudo mdadm /dev/md2 --add /dev/sdc',
        'cat /proc/mdstat',
      ]);
      expect(all).toContain('/dev/sdc: Moved: 100.00%');
      expect(all).toContain('Removed "/dev/sdc" from volume group "labo"');
      expect(all).toContain('Labels on physical volume "/dev/sdc" successfully wiped.');
      expect(all).toContain('mdadm: added /dev/sdc');
      expect(all).toMatch(/md2 : active raid1 sdc\[\d\] sdd\[0\]/);
      // 500 Go ne suffisent pas pour le concours : le reste de la place.
      expect(s.finished).toBe(false);
      play(['sudo lvextend -r -l +100%FREE /dev/labo/photos', 'sudo mdadm --detail --brief /dev/md2 | sudo tee -a /etc/mdadm/mdadm.conf', 'sudo update-initramfs -u']);
      expect(Object.keys(st().lvm!.pvs).sort()).toEqual(['md1', 'md2']);
      expect(s.finished).toBe(true);
    });

    it('chapitre 3 — fausses pistes : lvextend sans le système de fichiers, les doublons de --scan, l’initramfs refait trop tôt', () => {
      const { s, jouer: play } = part('agrandir');
      play(['sudo mdadm --create /dev/md2 --level=1 --raid-devices=2 --run /dev/sdc /dev/sdd', 'sudo vgextend labo /dev/md2', 'sudo lvextend -l +100%FREE /dev/labo/photos']);
      let all = play(['sudo lvextend -l +100%FREE /dev/labo/photos', 'sudo update-initramfs -u', 'sudo resize2fs /dev/labo/photos', 'sudo resize2fs /dev/labo/photos']);
      expect(all).toMatch(/New size \(\d+ extents\) matches existing size/);
      expect(all).toMatch(/The filesystem is already \d+ \(4k\) blocks long\.  Nothing to do!/);
      all = play(['sudo mdadm --detail --scan | sudo tee -a /etc/mdadm/mdadm.conf']);
      contains(all, 'décrit maintenant une grappe deux fois');
      expect(s.finished).toBe(false);
      // Une ligne par grappe, puis l'initramfs à refaire (celui d'avant ne connaît pas md2).
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

    // Chapitre 4 : on corrige /etc/fstab avec nano (en root, sur la console de l'hébergeur).
    const THEO_LINE = '/dev/sdc1  /srv/scans  ext4  defaults  0  2';
    const fix = (s: Shell, fresh: string | null) => {
      s.execute('nano /etc/fstab');
      const text = s.edition!.text;
      const output = s.saveEdition(fresh === null ? text.replace(THEO_LINE + '\n', '').replace(THEO_LINE, '') : text.replace(THEO_LINE, fresh));
      return output + '\n' + s.quitEdition();
    };
    const BY_UUID = 'UUID=c27a9e41-5b3d-4f8a-a1e6-9d0b2c4f7e13  /srv/scans  ext4  defaults,nofail  0  2';

    it('chapitre 4 — solution : le journal, lsblk -f, fstab par UUID avec nofail, findmnt --verify, daemon-reload, mount -a, systemctl default', () => {
      const { s, jouer: play } = part('secours');
      expect(s.who).toBe('root');
      let all = play(['cat message_d_odile.txt', 'journalctl -xb -p err', 'lsblk -f', 'findmnt --verify', 'mount -a']);
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

    it('chapitre 4 — autre solution : LABEL=, puis reboot (systemd relit fstab au démarrage)', () => {
      const { s, jouer: play } = part('secours');
      fix(s, 'LABEL=SCANS /srv/scans ext4 nofail 0 2');
      play(['blkid -L SCANS', 'reboot']);
      expect(s.state.secours).toBe(false);
      expect(s.finished).toBe(true);
    });

    it('chapitre 4 — fausses pistes : reprendre trop tôt, /dev/sde1, sans nofail, sans daemon-reload, la ligne effacée', () => {
      const { s, jouer: play } = part('secours');
      // Reprendre le démarrage sans rien corriger : retour en mode secours.
      let all = play(['exit']);
      expect(all).toContain('You are in emergency mode.');
      contains(all, 'corriger fstab');
      expect(s.state.secours).toBe(true);
      // La ligne effacée : le serveur démarrerait, mais sans les scans.
      all = fix(s, null);
      contains(all, 'ne seraient plus jamais montés');
      s.execute('nano /etc/fstab');
      s.saveEdition(s.edition!.text + '\n' + THEO_LINE + '\n');
      s.quitEdition();
      // /dev/sde1 : juste aujourd'hui, fragile demain.
      all = fix(s, '/dev/sde1  /srv/scans  ext4  defaults  0  2');
      contains(all, 'prochain disque ajouté');
      // Le bon UUID, sans nofail.
      s.execute('nano /etc/fstab');
      s.saveEdition(s.edition!.text.replace('/dev/sde1  /srv/scans  ext4  defaults  0  2', 'UUID=c27a9e41-5b3d-4f8a-a1e6-9d0b2c4f7e13  /srv/scans  ext4  defaults  0  2'));
      all = s.quitEdition();
      contains(all, 'nofail');
      // Avec nofail, mais systemd n'a pas relu fstab : systemctl default rechute.
      s.execute('nano /etc/fstab');
      s.saveEdition(s.edition!.text.replace('ext4  defaults  0  2', 'ext4  defaults,nofail  0  2'));
      s.quitEdition();
      all = play(['systemctl default']);
      expect(all).toContain('You are in emergency mode.');
      contains(all, 'ancienne version');
      // Une ligne illisible est signalée par mount -a.
      all = play(['systemctl daemon-reload', 'mount -a', 'systemctl default']);
      expect(s.finished).toBe(true);
    });

    it('chapitre 4 — les messages : blkid, findmnt, mount (une ligne illisible, une source inconnue)', () => {
      const { s, jouer: play } = part('secours');
      s.execute('nano /etc/fstab');
      s.saveEdition(s.edition!.text + '\n/dev/sdz9 /mnt\n');
      contains(s.quitEdition(), 'une ligne illisible');
      const all = play(['mount -a', 'findmnt --verify', 'blkid /dev/sdz9', 'blkid -U c27a9e41-5b3d-4f8a-a1e6-9d0b2c4f7e13', 'mount /srv/scans', 'mount /nulle-part']);
      expect(all).toMatch(/mount: \/etc\/fstab: parse error at line \d+ -- ignored/);
      expect(all).toMatch(/1 parse error, 1 error, 0 warnings/);
      expect(all).toContain('/dev/sde1');
      expect(all).toContain("mount: /nulle-part: can't find in /etc/fstab.");
      for (const c of ['blkid', 'findmnt', 'fstab']) expect(s.execute(`man ${c}`)).toMatch(new RegExp(`${c.toUpperCase()}\\([58]\\)`));
    });

    it('l’histoire s’ouvre après « Le disque plein », et se joue depuis le poste', () => {
      const before = prerequisites('labo');
      expect(before).toContain('disque-plein');
      const c = new Console({ language, finished: before });
      expect(c.isOpen('labo')).toBe(true);
      const all = [c.execute(machinesInLanguage(translator(language), 'ssh labo')), c.execute('yes')].join('\n');
      expect(all).toContain(machinesInLanguage(translator(language), 'labo.internal'));
      expect(c.remote?.shell.chapter.id).toBe('fatigue');
      expect(new Console({ language, finished: before.filter((x) => x !== 'disque-plein') }).isOpen('labo')).toBe(false);
    });
  });
