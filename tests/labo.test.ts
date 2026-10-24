// Le Labo : les disques du serveur du club photo (SMART, RAID logiciel,
// remplacement d'un disque). Chaque chapitre est rejoué jusqu'au bout, avec
// une autre solution et des fausses pistes, dans chaque langue ; les textes
// attendus sont vérifiés en français. Aussi : les sorties de smartctl,
// mdadm, sfdisk, lsblk et /proc/mdstat, et leurs messages d'erreur.

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/moteur/shell';
import { Console } from '../src/moteur/console';
import { HISTOIRES } from '../src/moteur/chapitres';
import { prerequis } from '../src/moteur/deverrouillage';
import { LANGUES, LANGUE_DE_REFERENCE, traducteur } from '../src/textes';
import { dansLaLangue } from './noms';
import { SERIES } from '../src/moteur/chapitres/labo';
import { stockage } from '../src/moteur/stockage';

const chapitre = (id: string) => HISTOIRES.flatMap((h) => h.chapitres).find((c) => c.id === id)!;
const MDP = 'argentique-2027';

for (const langue of LANGUES)
  describe(`Le Labo — ${langue}`, () => {
    const fr = langue === LANGUE_DE_REFERENCE;
    const L = (ligne: string) => dansLaLangue(traducteur(langue), ligne);
    const contient = (tout: string, texte: string) => fr && expect(tout).toContain(texte);

    // Une partie : chaque ligne (écrite avec les noms français), avec le mot de passe de sudo s'il est demandé.
    function partie(id: string) {
      const s = new Shell(chapitre(id), langue);
      const une = (l: string) => {
        let sortie = s.executer(L(l)) ?? '';
        if (s.attente) sortie += '\n' + (s.executer(MDP) ?? '');
        const erreurs = s.recupererErreurs();
        return [sortie, ...erreurs].filter(Boolean).join('\n');
      };
      const jouer = (lignes: string[]) => lignes.map(une).join('\n');
      return { s, jouer, st: () => stockage(s)! };
    }

    it('chapitre 1 — solution : courriers, mdstat, SMART des deux disques, sdb sorti de md0 et md1, ticket', () => {
      const { s, jouer, st } = partie('fatigue');
      let tout = jouer(['cat message_d_odile.txt', 'mail', 'cat /var/mail/vous', 'cat /proc/mdstat']);
      expect(tout).toContain('SMART error (CurrentPendingSector) detected on host: labo');
      expect(tout).toContain('md0 : active raid1 sdb2[1] sda2[0]');
      expect(tout).toContain('[2/2] [UU]');
      contient(tout, 'smartd et le noyau parlent du même disque');
      tout = jouer(['sudo smartctl -a /dev/sdb', 'sudo smartctl -a /dev/sda']);
      expect(tout).toContain('SMART overall-health self-assessment test result: PASSED');
      expect(tout).toMatch(/5 Reallocated_Sector_Ct\s+0x0033\s+153\s+153\s+140\s+Pre-fail\s+Always\s+-\s+1208/);
      expect(tout).toContain(`Serial Number:    ${SERIES.sda}`);
      contient(tout, 'plus de mille secteurs réalloués');
      tout = jouer(['sudo mdadm --manage /dev/md0 --fail /dev/sdb2 --remove /dev/sdb2']);
      expect(tout).toContain('mdadm: set /dev/sdb2 faulty in /dev/md0\nmdadm: hot removed /dev/sdb2 from /dev/md0');
      contient(tout, 'fait encore partie de /dev/md1');
      tout = jouer(['sudo mdadm /dev/md1 -f /dev/sdb3', 'sudo mdadm /dev/md1 -r failed', 'cat /proc/mdstat']);
      expect(tout).toContain('mdadm: hot removed /dev/sdb3 from /dev/md1');
      expect(tout).toContain('md1 : active raid1 sda3[0]\n      1919824896 blocks super 1.2 [2/1] [U_]');
      contient(tout, 'ne fait plus partie');
      expect(s.termine).toBe(false);
      tout = jouer(['lsblk -d -o NAME,SERIAL', `echo "Merci de remplacer le disque S/N ${SERIES.sdb}" > ~/ticket.txt`]);
      expect(tout).toMatch(new RegExp(`sdb\\s+${SERIES.sdb}`));
      contient(tout, 'Tu as terminé le chapitre 1 du Labo');
      expect(Object.values(st().grappes).every((g) => g.membres.length === 1)).toBe(true);
      expect(s.termine).toBe(true);
    });

    it('chapitre 1 — fausses pistes : retirer sans --fail, sortir le disque sain, un ticket au mauvais numéro', () => {
      const { s, jouer, st } = partie('fatigue');
      // Un membre actif ne se retire pas.
      let tout = jouer(['sudo mdadm /dev/md0 --remove /dev/sdb2']);
      expect(tout).toContain('mdadm: hot remove failed for /dev/sdb2: Device or resource busy');
      contient(tout, 'on ne retire pas un membre actif');
      // Le disque sain sorti par erreur : la grappe ne tient plus que sur sdb.
      tout = jouer(['sudo mdadm /dev/md0 --fail /dev/sda2', 'cat /proc/mdstat']);
      expect(tout).toContain('md0 : active raid1 sdb2[1] sda2[0](F)');
      contient(tout, 'le disque SAIN');
      // md refuse alors de sortir le dernier membre à jour.
      tout = jouer(['sudo mdadm /dev/md0 --fail /dev/sdb2']);
      expect(tout).toContain('mdadm: set device faulty failed for /dev/sdb2:  Device or resource busy');
      // On répare : retirer, puis remettre (--re-add), et il se remet à jour.
      tout = jouer(['sudo mdadm /dev/md0 --re-add /dev/sda2']);
      expect(tout).toContain('mdadm: Cannot open /dev/sda2: Device or resource busy');
      jouer(['sudo mdadm /dev/md0 --remove /dev/sda2', 'sudo mdadm /dev/md0 --re-add /dev/sda2', 'cat /proc/mdstat']);
      expect(st().grappes.md0.membres.find((m) => m.part === 'sda2')?.etat).toBe('actif');
      // Puis le bon disque, dans les deux grappes.
      jouer(['sudo mdadm /dev/md0 --fail /dev/sdb2 --remove /dev/sdb2', 'sudo mdadm /dev/md1 --fail /dev/sdb3 --remove /dev/sdb3']);
      // Un ticket avec le numéro de sda : refusé (on débrancherait le disque sain).
      tout = jouer([`echo "Disque à remplacer : ${SERIES.sda}" > ~/ticket.txt`]);
      contient(tout, 'le numéro de série de sda');
      expect(s.termine).toBe(false);
      jouer([`echo "Disque à remplacer : ${SERIES.sdb}" > ~/ticket.txt`]);
      expect(s.termine).toBe(true);
    });

    it('chapitre 2 — solution : la table de sda recopiée, les deux partitions ajoutées, la reconstruction, GRUB', () => {
      const { s, jouer, st } = partie('disque-neuf');
      let tout = jouer(['cat message_d_odile.txt', 'lsblk', 'cat /proc/mdstat']);
      expect(tout).toMatch(/^sdb\s+8:16\s+0 1\.8T\s+0 disk$/m);
      expect(tout).toContain('[2/1] [U_]');
      contient(tout, 'Le nouveau sdb');
      tout = jouer(['sudo sfdisk -d /dev/sda | sudo sfdisk /dev/sdb']);
      expect(tout).toContain("/dev/sdb1: Created a new partition 1 of type 'BIOS boot' and of size 1 MiB.");
      expect(tout).toContain('The partition table has been altered.');
      contient(tout, 'sdb est découpé comme sda');
      tout = jouer(['sudo mdadm --manage /dev/md0 --add /dev/sdb2', 'sudo mdadm --manage /dev/md1 --add /dev/sdb3', 'cat /proc/mdstat']);
      expect(tout).toContain('mdadm: added /dev/sdb2');
      expect(tout).toMatch(/recovery = +\d+\.\d% \(\d+\/1919824896\) finish=[\d.]+min speed=180000K\/sec/);
      expect(s.termine).toBe(false);
      // La reconstruction prend quelques commandes.
      for (let i = 0; i < 6 && !st().grappes.md1.membres.every((m) => m.etat === 'actif'); i++) jouer(['cat /proc/mdstat']);
      tout = jouer(['cat /proc/mdstat']);
      expect(tout).toContain('md1 : active raid1 sdb3[1] sda3[0]\n      1919824896 blocks super 1.2 [2/2] [UU]');
      tout = jouer(['sudo grub-install /dev/sdb']);
      expect(tout).toContain('Installation finished. No error reported.');
      contient(tout, 'Tu as terminé le chapitre 2 du Labo');
      expect(s.termine).toBe(true);
    });

    it('chapitre 2 — autre solution : GRUB d’abord, une seule commande mdadm par grappe, la table gardée dans un fichier', () => {
      const { s, jouer } = partie('disque-neuf');
      jouer(['sudo sfdisk -d /dev/sda > table.txt', 'cat table.txt | sudo sfdisk /dev/sdb', 'sudo grub-install /dev/sdb', 'sudo mdadm /dev/md1 -a /dev/sdb3', 'sudo mdadm /dev/md0 -a /dev/sdb2']);
      for (let i = 0; i < 8 && !s.termine; i++) jouer(['sudo mdadm --detail /dev/md1']);
      expect(s.termine).toBe(true);
    });

    it('chapitre 2 — fausses pistes : ajouter trop tôt, le sens inversé, le disque entier, GRUB sur une partition', () => {
      const { s, jouer, st } = partie('disque-neuf');
      let tout = jouer(['sudo mdadm --manage /dev/md0 --add /dev/sdb2']);
      expect(tout).toContain('mdadm: Cannot find /dev/sdb2: No such file or directory');
      contient(tout, 'sdb est encore vierge');
      // Le sens inversé : sfdisk refuse d'écrire sur sda, en service.
      tout = jouer(['sudo sfdisk -d /dev/sdb | sudo sfdisk /dev/sda']);
      expect(tout).toContain('sfdisk: /dev/sdb: does not contain a recognized partition table');
      expect(tout).toContain('This disk is currently in use - repartitioning is probably a bad idea.');
      contient(tout, 'le disque nommé en dernier qui est écrasé');
      expect(st().disques.sda.partitions).toHaveLength(3);
      // GRUB sur un disque vierge (pas de partition BIOS boot), puis sur une partition.
      tout = jouer(['sudo grub-install /dev/sdb']);
      expect(tout).toContain('this GPT partition label contains no BIOS Boot Partition');
      // Le disque entier dans une grappe : il écrase sa table.
      tout = jouer(['sudo mdadm /dev/md0 --add /dev/sdb']);
      expect(tout).toContain('mdadm: added /dev/sdb');
      contient(tout, 'le disque sdb ENTIER');
      jouer(['sudo mdadm /dev/md0 --fail /dev/sdb --remove /dev/sdb', 'sudo sfdisk -d /dev/sda | sudo sfdisk /dev/sdb']);
      tout = jouer(['sudo grub-install /dev/sdb1']);
      expect(tout).toContain("grub-install: error: unable to identify a filesystem in /dev/sdb1; safety check can't be performed.");
      jouer(['sudo mdadm /dev/md0 --add /dev/sdb2', 'sudo mdadm /dev/md1 --add /dev/sdb3', 'sudo grub-install /dev/sdb']);
      for (let i = 0; i < 8 && !s.termine; i++) jouer(['cat /proc/mdstat']);
      expect(s.termine).toBe(true);
    });

    it('les messages des outils : sans root, sans argument, inconnu, option inconnue', () => {
      const { s, jouer } = partie('fatigue');
      expect(s.executer('smartctl -a /dev/sda')).toContain('Smartctl open device: /dev/sda failed: Permission denied');
      expect(s.executer('mdadm --detail /dev/md0')).toContain('mdadm: cannot open /dev/md0: Permission denied');
      expect(s.executer('cat /proc/mdstat')).toContain('Personalities : [raid1]');
      const tout = jouer([
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
      expect(tout).toContain('ERROR: smartctl requires a device name as the final command-line argument.');
      expect(tout).toContain('Smartctl open device: /dev/sdz failed: No such device');
      expect(tout).toContain('=======> UNRECOGNIZED OPTION: frobnicate');
      expect(tout).toContain('Usage: mdadm --help\n  for help');
      expect(tout).toContain('mdadm: cannot open /dev/md9: No such file or directory');
      expect(tout).toContain('mdadm: /dev/sda2 does not appear to be an md device');
      expect(tout).toContain('mdadm: set device faulty failed for /dev/sdc2:  No such device');
      expect(tout).toContain('ARRAY /dev/md/0 metadata=1.2 name=labo:0 UUID=5d1e0a3c:7b2f4e91:a6c83f0d:9b1e2c47');
      expect(tout).toContain('lsblk: unknown column: COULEUR');
      expect(tout).toContain('Testing has begun.');
      expect(tout).toMatch(/# 1  Short offline\s+Completed: read failure\s+90%/);
      // sfdisk et grub-install : au chapitre 2.
      const deux = partie('disque-neuf');
      const sorties = deux.jouer(['sudo sfdisk -l /dev/sda', 'sudo sfdisk --force /dev/sdb', 'sudo sfdisk /dev/sdb', 'sudo sfdisk -d /dev/sda | sudo sfdisk /dev/sda', 'sudo grub-install /dev/sdz']);
      expect(sorties).toMatch(/\/dev\/sda3\s+67112960 3907029134 3839916175\s+1\.8T Linux RAID/);
      expect(sorties).toContain("sfdisk: unrecognized option '--force'");
      contient(sorties, 'le mode interactif');
      expect(sorties).toContain('This disk is currently in use');
      expect(sorties).toContain('grub-install: error: cannot find a GRUB drive for /dev/sdz.  Check your device.map.');
      // Le manuel : chaque commande a sa page et son --help.
      for (const c of ['smartctl', 'mdadm']) {
        expect(s.executer(`man ${c}`)).toContain(`${c.toUpperCase()}(8)`);
        expect(s.executer(`${c} --help`)).toBeTruthy();
      }
      for (const c of ['sfdisk', 'grub-install']) expect(deux.s.executer(`man ${c}`)).toContain(`${c.toUpperCase()}(8)`);
      expect(jouer(['man -k RAID'])).toContain('mdadm (8)');
    });

    it('chapitre 3 — solution : une grappe des disques neufs, pvcreate, vgextend, lvextend puis resize2fs, mdadm.conf, initramfs', () => {
      const { s, jouer, st } = partie('agrandir');
      let tout = jouer(['cat message_d_odile.txt', 'df -h /srv', 'sudo vgs', 'lsblk']);
      expect(tout).toMatch(/\/dev\/mapper\/labo-photos.* 97% \/srv/);
      expect(tout).toMatch(/labo +1 +1 +0 wz--n- <1\.79t +0\n/);
      expect(tout).toMatch(/^sdc +8:32 +0 3\.6T +0 disk$/m);
      contient(tout, 'un volume logique LVM');
      tout = jouer(['sudo mdadm --create /dev/md2 --level=1 --raid-devices=2 /dev/sdc /dev/sdd']);
      expect(tout).toContain('may not be suitable as a boot device');
      tout = jouer(['y', 'cat /proc/mdstat']);
      expect(tout).toContain('mdadm: array /dev/md2 started.');
      expect(tout).toMatch(/md2 : active raid1 sdd\[1\] sdc\[0\]\n +\d+ blocks super 1\.2 \[2\/2\] \[UU\]\n +\[=*>\.*\] +resync = /);
      tout = jouer(['sudo pvcreate /dev/md2', 'sudo vgextend labo /dev/md2', 'sudo lvextend -l +100%FREE /dev/labo/photos', 'df -h /srv']);
      expect(tout).toContain('Physical volume "/dev/md2" successfully created.');
      expect(tout).toContain('Volume group "labo" successfully extended');
      expect(tout).toMatch(/Size of logical volume labo\/photos changed from <1\.79 TiB \(\d+ extents\) to <5\.43 TiB/);
      expect(tout).toMatch(/ 97% \/srv/);
      contient(tout, 'df ne voit rien');
      tout = jouer(['sudo resize2fs /dev/mapper/labo-photos', 'df -h /srv']);
      expect(tout).toContain('on-line resizing required');
      expect(tout).toMatch(/ 32% \/srv/);
      expect(s.termine).toBe(false);
      tout = jouer(['sudo mdadm --detail --brief /dev/md2 | sudo tee -a /etc/mdadm/mdadm.conf']);
      expect(tout).toMatch(/^ARRAY \/dev\/md2 metadata=1\.2 name=labo:2 UUID=[0-9a-f:]{35}$/m);
      expect(s.termine).toBe(false);
      tout = jouer(['sudo update-initramfs -u']);
      expect(tout).toContain('update-initramfs: Generating /boot/initrd.img-6.12.48+deb13-amd64');
      contient(tout, 'Tu as terminé le chapitre 3 du Labo');
      expect(Object.keys(st().lvm!.pvs).sort()).toEqual(['md1', 'md2']);
      expect(s.termine).toBe(true);
    });

    it('chapitre 3 — autre solution : --run, vgextend sans pvcreate, lvextend -r -L, mdadm.conf écrit avec nano', () => {
      const { s, jouer } = partie('agrandir');
      let tout = jouer(['sudo mdadm -C /dev/md2 -l1 -n2 --run /dev/sdc /dev/sdd', 'sudo vgextend labo /dev/md2', 'sudo lvextend -r -L +2T /dev/labo/photos']);
      expect(tout).toContain('Physical volume "/dev/md2" successfully created.');
      expect(tout).toContain('File system ext4 found on labo/photos mounted at /srv.');
      expect(tout).toContain('Extended file system ext4 on labo/photos.');
      tout = jouer(['sudo mdadm --detail --brief /dev/md2']);
      const ligne = /ARRAY .*/.exec(tout)![0];
      s.executer('sudo nano /etc/mdadm/mdadm.conf');
      s.enregistrerEdition(s.edition!.texte + '\n' + ligne + '\n');
      s.quitterEdition();
      jouer(['sudo update-initramfs -u']);
      expect(s.termine).toBe(true);
    });

    it('chapitre 3 — fausse piste : un disque seul dans le groupe, réparé par une grappe dégradée et pvmove', () => {
      const { s, jouer, st } = partie('agrandir');
      // sdc donné tel quel à LVM, et le volume agrandi dessus : plus de redondance.
      let tout = jouer(['sudo vgextend labo /dev/sdc', 'sudo lvextend -r -L +500G /dev/labo/photos']);
      expect(tout).toContain('Volume group "labo" successfully extended');
      contient(tout, 'tel quel, sans');
      // Il ne peut ni entrer dans une grappe, ni quitter le groupe tant qu'il porte des données.
      tout = jouer(['sudo mdadm --create /dev/md2 --level=1 --raid-devices=2 /dev/sdc /dev/sdd', 'sudo vgreduce labo /dev/sdc', 'sudo pvmove /dev/sdc']);
      expect(tout).toContain('mdadm: cannot open /dev/sdc: Device or resource busy');
      expect(tout).toContain('Physical volume "/dev/sdc" still in use');
      expect(tout).toMatch(/Insufficient free space: \d+ extents needed, but only 0 available/);
      // Une grappe dégradée sur sdd, les données déménagées, sdc libéré puis ajouté à la grappe.
      tout = jouer([
        'sudo mdadm --create /dev/md2 --level=1 --raid-devices=2 --run /dev/sdd missing',
        'sudo vgextend labo /dev/md2',
        'sudo pvmove /dev/sdc /dev/md2',
        'sudo vgreduce labo /dev/sdc',
        'sudo pvremove /dev/sdc',
        'sudo mdadm /dev/md2 --add /dev/sdc',
        'cat /proc/mdstat',
      ]);
      expect(tout).toContain('/dev/sdc: Moved: 100.00%');
      expect(tout).toContain('Removed "/dev/sdc" from volume group "labo"');
      expect(tout).toContain('Labels on physical volume "/dev/sdc" successfully wiped.');
      expect(tout).toContain('mdadm: added /dev/sdc');
      expect(tout).toMatch(/md2 : active raid1 sdc\[\d\] sdd\[0\]/);
      // 500 Go ne suffisent pas pour le concours : le reste de la place.
      expect(s.termine).toBe(false);
      jouer(['sudo lvextend -r -l +100%FREE /dev/labo/photos', 'sudo mdadm --detail --brief /dev/md2 | sudo tee -a /etc/mdadm/mdadm.conf', 'sudo update-initramfs -u']);
      expect(Object.keys(st().lvm!.pvs).sort()).toEqual(['md1', 'md2']);
      expect(s.termine).toBe(true);
    });

    it('chapitre 3 — fausses pistes : lvextend sans le système de fichiers, les doublons de --scan, l’initramfs refait trop tôt', () => {
      const { s, jouer } = partie('agrandir');
      jouer(['sudo mdadm --create /dev/md2 --level=1 --raid-devices=2 --run /dev/sdc /dev/sdd', 'sudo vgextend labo /dev/md2', 'sudo lvextend -l +100%FREE /dev/labo/photos']);
      let tout = jouer(['sudo lvextend -l +100%FREE /dev/labo/photos', 'sudo update-initramfs -u', 'sudo resize2fs /dev/labo/photos', 'sudo resize2fs /dev/labo/photos']);
      expect(tout).toMatch(/New size \(\d+ extents\) matches existing size/);
      expect(tout).toMatch(/The filesystem is already \d+ \(4k\) blocks long\.  Nothing to do!/);
      tout = jouer(['sudo mdadm --detail --scan | sudo tee -a /etc/mdadm/mdadm.conf']);
      contient(tout, 'décrit maintenant une grappe deux fois');
      expect(s.termine).toBe(false);
      // Une ligne par grappe, puis l'initramfs à refaire (celui d'avant ne connaît pas md2).
      s.executer('sudo nano /etc/mdadm/mdadm.conf');
      const vues = new Set<string>();
      const garder = (l: string) => {
        if (!l.startsWith('ARRAY')) return true;
        const uuid = /UUID=([0-9a-f:]+)/.exec(l)![1];
        if (vues.has(uuid)) return false;
        vues.add(uuid);
        return true;
      };
      s.enregistrerEdition(s.edition!.texte.split('\n').filter(garder).join('\n'));
      s.quitterEdition();
      expect(s.termine).toBe(false);
      jouer(['sudo update-initramfs -u']);
      expect(s.termine).toBe(true);
    });

    it('l’histoire s’ouvre après « Le disque plein », et se joue depuis le poste', () => {
      const avant = prerequis('labo');
      expect(avant).toContain('disque-plein');
      const c = new Console({ langue, termines: avant });
      expect(c.ouverte('labo')).toBe(true);
      const tout = [c.executer('ssh labo'), c.executer('yes')].join('\n');
      expect(tout).toContain('labo.internal');
      expect(c.distant?.shell.chapitre.id).toBe('fatigue');
      expect(new Console({ langue, termines: avant.filter((x) => x !== 'disque-plein') }).ouverte('labo')).toBe(false);
    });
  });
