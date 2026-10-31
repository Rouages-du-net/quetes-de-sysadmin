// Le réseau simulé : du poste, on se connecte en ssh aux machines des
// histoires ; finir l'Effaceur donne les autres clés. Messages d'OpenSSH
// fidèles (en anglais, comme le vrai ssh). Rejoué dans chaque langue.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { HISTOIRES } from '../src/engine/chapters';
import { cleHote, empreinte, machineDeHistoire } from '../src/engine/machines';
import { LANGUES, traducteur } from '../src/texts';
import { dansLaLangue } from './names';

// Les trois chapitres qui donnent les clés (le quatrième, ajouté ensuite, ne compte pas).
const EFFACEUR = ['eveil', 'bourg', 'racine'];

for (const langue of LANGUES)
  describe(`Langue : ${langue}`, () => {
    // Les lignes s'écrivent avec les noms français (voir noms.ts).
    const L = (ligne: string) => dansLaLangue(traducteur(langue), ligne);
    const jouer = (c: Console, lignes: string[]) => lignes.map((l) => c.executer(L(l)) ?? '').join('\n');

    it('première connexion : empreinte, yes, bannière, chapitre, exit', () => {
      const c = new Console({ langue });
      expect(c.invite()).toBe(L('vous@poste:~$'));
      const question = jouer(c, ['ssh royaume']);
      expect(question).toContain(L("The authenticity of host 'royaume.internal (192.0.2.10)' can't be established."));
      expect(question).toMatch(/ED25519 key fingerprint is SHA256:[A-Za-z0-9+/]{43}\./);
      expect(c.invite()).toBe('Are you sure you want to continue connecting (yes/no/[fingerprint])?');
      expect(jouer(c, ['peut-être'])).toBe('');
      expect(c.invite()).toBe("Please type 'yes', 'no' or the fingerprint:");
      const connexion = jouer(c, ['yes']);
      expect(connexion).toContain(L("Warning: Permanently added 'royaume.internal' (ED25519) to the list of known hosts."));
      expect(connexion).toContain(L('Linux royaume'));
      expect(c.invite()).toBe(L('vous@royaume:~$'));
      expect(c.distant?.shell.chapitre.id).toBe('eveil');
      expect(jouer(c, ['exit'])).toBe(L('logout\nConnection to royaume.internal closed.'));
      expect(c.invite()).toBe(L('vous@poste:~$'));
      // Deuxième fois : la machine est connue, pas de question ; le chapitre reprend, avec où relire ses consignes.
      const reprise = jouer(c, ['ssh royaume']);
      expect(reprise).not.toContain('authenticity');
      expect(reprise).toContain(L('cat bienvenue.txt'));
      expect(c.invite()).toBe(L('vous@royaume:~$'));
    });

    it('no : la vérification de la clé d’hôte échoue', () => {
      const c = new Console({ langue });
      expect(jouer(c, ['ssh royaume', 'no'])).toContain('Host key verification failed.');
      expect(c.invite()).toBe(L('vous@poste:~$'));
    });

    it('fausses pistes : nom inconnu, mauvais port, mauvais utilisateur, poste lui-même', () => {
      const c = new Console({ langue });
      expect(jouer(c, ['ssh nulle-part'])).toBe('ssh: Could not resolve hostname nulle-part: Name or service not known');
      expect(jouer(c, ['ssh -p 2222 royaume'])).toBe(L('ssh: connect to host royaume.internal port 2222: Connection refused'));
      expect(jouer(c, ['ssh poste'])).toBe(L('ssh: connect to host poste port 22: Connection refused'));
      expect(jouer(c, ['ssh', ''])).toContain('usage: ssh');
      expect(jouer(c, ['ssh root@royaume', 'yes'])).toContain(L('root@royaume.internal: Permission denied (publickey).'));
    });

    it('sans la clé : Permission denied, puis la clé gagnée en finissant l’Effaceur', () => {
      const c = new Console({ langue });
      expect(c.ouverte('datacenter')).toBe(false);
      expect(jouer(c, ['ssh datacenter', 'yes'])).toContain(L('vous@datacenter.internal: Permission denied (publickey).'));
      const fin = new Console({ langue, termines: EFFACEUR.slice(0, 2) });
      fin.connecter('royaume');
      expect(fin.distant?.shell.chapitre.id).toBe('racine');
      const derniere = jouer(fin, ['cat arrivee.txt', 'chmod o-w souvenirs', 'sudo cp ~/effaceur.conf.corrige /etc/effaceur.conf', 'tournesol']);
      expect(fin.termines).toEqual(EFFACEUR);
      expect(derniere).toContain('~/.ssh/id_datacenter');
      expect(jouer(fin, ['exit', 'ls -a ~/.ssh'])).toContain(L('id_bibliotheque'));
      jouer(fin, ['ssh datacenter', 'yes']);
      expect(fin.invite()).toBe(L('vous@datacenter:~$'));
      expect(fin.distant?.histoire.id).toBe(L('datacenter'));
    });

    it('une clé privée trop ouverte est ignorée, comme avec le vrai ssh', () => {
      const c = new Console({ langue });
      const sortie = jouer(c, ['chmod 644 ~/.ssh/id_royaume', 'ssh royaume', 'yes']);
      expect(sortie).toContain('WARNING: UNPROTECTED PRIVATE KEY FILE!');
      expect(sortie).toContain(L("Permissions 0644 for '/home/vous/.ssh/id_royaume' are too open."));
      expect(sortie).toContain(L('vous@royaume.internal: Permission denied (publickey).'));
      jouer(c, ['chmod 600 ~/.ssh/id_royaume', 'ssh royaume']);
      expect(c.invite()).toBe(L('vous@royaume:~$'));
    });

    it('-i : une clé copiée ailleurs marche aussi', () => {
      const c = new Console({ langue, hotesConnus: '' });
      jouer(c, ['ssh -i ~/.ssh/id_royaume vous@192.0.2.10', 'yes']);
      expect(c.invite()).toBe(L('vous@royaume:~$'));
    });

    it('hôtes connus gardés d’une partie à l’autre', () => {
      const c = new Console({ langue });
      jouer(c, ['ssh royaume', 'yes', 'exit']);
      const suite = new Console({ langue, hotesConnus: c.hotesConnus() });
      expect(jouer(suite, ['ssh royaume'])).not.toContain('authenticity');
    });

    it('la machine garde son état d’une connexion à l’autre', () => {
      const c = new Console({ langue });
      jouer(c, ['ssh royaume', 'yes', 'cd Colline/EcoleDesSignaux/SalleDExercice', 'mv crabe Seau', 'exit']);
      const retour = jouer(c, ['ssh royaume']);
      expect(retour).toContain('— ');
      // Comme une nouvelle connexion : on repart de sa maison, le monde n'a pas bougé.
      expect(c.invite()).toBe(L('vous@royaume:~$'));
      expect(jouer(c, ['ls Colline/EcoleDesSignaux/SalleDExercice/Seau'])).toBe(L('crabe'));
    });

    it('reboot coupe la session ssh ; la machine a redémarré quand on revient', () => {
      const termines = HISTOIRES.find((h) => h.id === 'datacenter')!
        .chapitres.slice(0, 2)
        .map((c) => c.id);
      const c = new Console({ langue, termines: [...EFFACEUR, ...termines] });
      jouer(c, ['ssh datacenter', 'yes']);
      expect(c.distant?.shell.chapitre.id).toBe('redemarrage');
      const coupure = jouer(c, ['sudo reboot', 'bienvenue-2026']);
      expect(coupure).toContain(L('Connection to datacenter.internal closed by remote host.'));
      expect(c.invite()).toBe(L('vous@poste:~$'));
      jouer(c, ['ssh datacenter']);
      expect(jouer(c, ['journalctl -b -u catalogue -n 1'])).toContain('Failed to start catalogue.service');
    });

    it('la machine réinstallée après l’incendie : nouvelle clé d’hôte, ssh refuse, ssh-keygen -R', () => {
      const termines = HISTOIRES.find((h) => h.id === 'datacenter')!
        .chapitres.slice(0, 3)
        .map((c) => c.id);
      const c = new Console({ langue, termines: [...EFFACEUR, ...termines] });
      // La clé de l'ancien serveur, connue depuis les chapitres précédents.
      const ancienne = `datacenter.internal ${cleHote(machineDeHistoire('datacenter')!)}`;
      c.poste.placer('test', '~/.ssh/known_hosts', { type: 'fichier', contenu: ancienne, lignes: true });
      const refus = jouer(c, ['ssh datacenter']);
      expect(refus).toContain('WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!');
      expect(refus).toContain(L("ssh-keygen -f '/home/vous/.ssh/known_hosts' -R 'datacenter.internal'"));
      expect(refus).toContain('Host key verification failed.');
      expect(c.invite()).toBe(L('vous@poste:~$'));
      // Le nom court n'est pas celui écrit dans known_hosts.
      expect(jouer(c, ['ssh-keygen -R datacenter'])).toContain(L('Host datacenter not found'));
      expect(jouer(c, ['ssh-keygen -F datacenter.internal'])).toContain(L('# Host datacenter.internal found: line 1'));
      const retire = jouer(c, ['ssh-keygen -R datacenter.internal']);
      expect(retire).toContain(L('/home/vous/.ssh/known_hosts updated.'));
      expect(c.poste.lire('~/.ssh/known_hosts.old')).toBe(ancienne);
      const question = jouer(c, ['ssh datacenter']);
      expect(question).toContain(`ED25519 key fingerprint is ${empreinte(machineDeHistoire('datacenter')!, '-apres-incendie')}.`);
      jouer(c, ['yes']);
      expect(c.distant?.shell.chapitre.id).toBe('incendie');
      // Se reconnecter ne pose plus de question : la nouvelle clé est connue.
      jouer(c, ['exit']);
      expect(jouer(c, ['ssh datacenter'])).not.toContain('WARNING');
      expect(c.invite()).toBe(L('vous@datacenter:~$'));
      expect(jouer(c, ['exit', 'ssh-keygen -l -f ~/.ssh/known_hosts'])).toContain(
        `${empreinte(machineDeHistoire('datacenter')!, '-apres-incendie')} datacenter.internal (ED25519)`,
      );
    });

    it('Tab complète les machines de ~/.ssh/config', () => {
      const c = new Console({ langue });
      // Les trois premières lettres du nom dans la langue (roy, kin) : Tab complète le reste.
      const debut = (id: string) => L(`ssh ${id}`).slice(0, 7);
      expect(c.completer(debut('royaume'))).toBe(L('ssh royaume '));
      expect(c.completer(debut('bibliotheque'))).toBe(L('ssh bibliotheque '));
    });

    it.runIf(langue === 'fr')('exit sur le poste explique où l’on est', () => {
      expect(jouer(new Console({ langue }), ['exit'])).toContain(L('Tu es sur ton propre poste'));
    });
  });
