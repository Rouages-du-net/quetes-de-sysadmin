// La Maison des associations : les clés, le rebond, le tunnel, les
// transferts. Rejoué avec la console (tout part du poste), dans chaque langue.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/moteur/console';
import { HISTOIRES } from '../src/moteur/chapitres';
import { LANGUES, LANGUE_DE_REFERENCE } from '../src/textes';

const EFFACEUR = HISTOIRES.find((h) => h.id === 'effaceur')!.chapitres.map((c) => c.id);
const CONFIG = '/etc/ssh/sshd_config';

for (const langue of LANGUES)
  describe(`La Maison des associations — ${langue}`, () => {
    const fr = langue === LANGUE_DE_REFERENCE;
    const contient = (tout: string, texte: string) => fr && expect(tout).toContain(texte);
    const partie = (termines: string[] = []) => {
      const c = new Console({ langue, termines: [...EFFACEUR, ...termines] });
      const jouer = (lignes: string[]) => lignes.map((l) => c.executer(l) ?? '').join('\n');
      const modifier = (fichier: string, changer: (texte: string) => string, mdp = 'lilas-2027') => {
        c.executer(`sudo nano ${fichier}`);
        if (c.shell.attente) c.executer(mdp);
        c.enregistrer(changer(c.edition!.texte));
        return c.quitterEdition();
      };
      return { c, jouer, modifier };
    };

    it('chapitre 1 — solution : ssh-keygen, ssh-copy-id, puis plus de mots de passe', () => {
      const { c, jouer, modifier } = partie();
      let tout = jouer(['ssh maison', 'yes']);
      expect(c.invite()).toBe("vous@maison.example's password:");
      tout += jouer(['lilas-2027']);
      contient(tout, 'Bienvenue dans l');
      expect(c.invite()).toBe('vous@maison:~$');
      tout += jouer(['exit', 'ssh-keygen', '', '', '', 'ssh-copy-id maison', 'lilas-2027']);
      expect(tout).toContain('Your public key has been saved in /home/vous/.ssh/id_ed25519.pub');
      expect(tout).toContain('Number of key(s) added: 1');
      tout += jouer(['ssh maison']);
      expect(c.invite()).toBe('vous@maison:~$');
      contient(tout, 'Entré·e par ta clé, sans mot de passe');
      tout += modifier(CONFIG, (t) => t.replace('#PasswordAuthentication yes', 'PasswordAuthentication no'));
      tout += jouer(['sudo sshd -t', 'sudo systemctl reload ssh']);
      contient(tout, "sshd n'accepte plus que les clés");
      expect(c.termines).not.toContain('cles');
      tout += jouer(['exit', 'ssh maison']);
      contient(tout, 'https://man.openbsd.org/ssh-keygen');
      expect(c.termines).toContain('cles');
    });

    it('chapitre 1 — autre solution : la clé publique recopiée à la main, avec une phrase de passe', () => {
      const { c, jouer, modifier } = partie();
      jouer(['ssh-keygen -t ed25519 -C vous@poste', '', 'une longue phrase', 'une longue phrase']);
      const publique = c.poste.lire('~/.ssh/id_ed25519.pub')!;
      jouer(['ssh maison', 'yes', 'lilas-2027', 'mkdir .ssh']);
      c.executer('nano .ssh/authorized_keys');
      c.enregistrer(publique + '\n');
      c.quitterEdition();
      jouer(['chmod 600 .ssh/authorized_keys', 'exit', 'ssh maison']);
      expect(c.invite()).toBe("Enter passphrase for key '/home/vous/.ssh/id_ed25519':");
      jouer(['une longue phrase']);
      expect(c.invite()).toBe('vous@maison:~$');
      modifier('/etc/ssh/sshd_config.d/00-cles.conf', () => 'PasswordAuthentication no\n');
      jouer(['sudo systemctl restart ssh', 'exit', 'ssh maison', 'une longue phrase']);
      expect(c.termines).toContain('cles');
    });

    it('chapitre 1 — fausses pistes : ssh-copy-id sans clé, fermer la porte avant de poser la clé', () => {
      const { c, jouer, modifier } = partie();
      // Sans clé à soi, ssh-copy-id prend la plus récente de ~/.ssh : celle du royaume.
      let tout = jouer(['ssh-copy-id maison', 'yes', 'lilas-2027', 'ssh maison']);
      expect(tout).toContain('Source of key(s) to be installed: "/home/vous/.ssh/id_royaume.pub"');
      expect(c.invite()).toBe("vous@maison.example's password:");
      tout = jouer(['lilas-2027']);
      contient(tout, "jeu t'a donnée pour une autre machine");
      tout = modifier(CONFIG, (t) => t.replace('#PasswordAuthentication yes', 'PasswordAuthentication no'));
      tout += jouer(['sudo systemctl reload ssh']);
      contient(tout, 'aucune clé n');
      tout = jouer(['exit', 'ssh maison']);
      expect(tout).toContain('vous@maison.example: Permission denied (publickey).');
      expect(c.invite()).toBe('vous@poste:~$');
      // Le menu : la console de secours de l'hébergeur.
      c.connecter('maison');
      modifier(CONFIG, (t) => t.replace('PasswordAuthentication no', 'PasswordAuthentication yes'));
      jouer(['sudo systemctl reload ssh', 'exit', 'ssh-keygen -N "" -f ~/.ssh/id_ed25519', 'ssh-copy-id maison', 'lilas-2027']);
      expect(c.termines).not.toContain('cles');
    });

    // Le poste a déjà sa clé (chapitre 1), sans phrase de passe.
    const avecCle = (termines: string[]) => {
      const p = partie(termines);
      p.jouer(['ssh-keygen -N "" -f ~/.ssh/id_ed25519']);
      return p;
    };
    const CONFIG_WIKI = '\nHost wiki\n    HostName wiki\n    User vous\n    ProxyJump maison\n';
    const ecrirePoste = (c: Console, fichier: string, ajouter: string) => {
      c.executer(`nano ${fichier}`);
      c.enregistrer(c.edition!.texte + ajouter);
      return c.quitterEdition();
    };

    it('chapitre 2 — solution : ssh -J, puis ProxyJump dans ~/.ssh/config', () => {
      const { c, jouer } = avecCle(['cles']);
      let tout = jouer(['ssh -J maison wiki', 'yes', 'yes']);
      contient(tout, 'Le wiki');
      expect(c.invite()).toBe('vous@wiki:~$');
      contient(tout, 'Te voilà sur le wiki');
      tout += jouer(['hostname', 'cat note_gaspard.txt', 'exit']);
      expect(c.invite()).toBe('vous@poste:~$');
      // Le chapitre regarde le poste : le raccourci écrit suffit (déjà venu·e au wiki).
      tout = ecrirePoste(c, '~/.ssh/config', CONFIG_WIKI);
      contient(tout, 'https://man.openbsd.org/ssh_config#ProxyJump');
      expect(c.termines).toContain('rebond');
      tout = jouer(['ssh -G wiki']);
      expect(tout).toContain('proxyjump maison');
      tout = jouer(['ssh wiki']);
      expect(c.invite()).toBe('vous@wiki:~$');
      // Un rebond n'affiche pas la bannière de la passerelle.
      expect(tout).not.toContain('Linux maison');
      tout = jouer(['exit']);
      expect(c.invite()).toBe('vous@poste:~$');
    });

    it('chapitre 2 — fausses pistes : ssh wiki depuis le poste, depuis maison, la clé privée recopiée', () => {
      const { c, jouer } = avecCle(['cles']);
      let tout = jouer(['ssh wiki']);
      expect(tout).toContain('ssh: Could not resolve hostname wiki: Name or service not known');
      tout = jouer(['ssh maison', 'yes', 'ssh wiki', 'yes']);
      expect(tout).toContain('vous@wiki: Permission denied (publickey).');
      expect(c.invite()).toBe('vous@maison:~$');
      tout = jouer(['exit', 'scp ~/.ssh/id_ed25519 maison:.ssh/']);
      contient(tout, 'il y a une clé privée dans ~/.ssh sur maison');
      jouer(['ssh maison']);
      // Avec la clé privée recopiée, le second ssh passe… mais le chapitre ne se termine pas.
      jouer(['chmod 600 .ssh/id_ed25519', 'ssh wiki']);
      expect(c.invite()).toBe('vous@wiki:~$');
      jouer(['exit', 'exit']);
      ecrirePoste(c, '~/.ssh/config', CONFIG_WIKI);
      jouer(['ssh wiki', 'yes']);
      expect(c.invite()).toBe('vous@wiki:~$');
      expect(c.termines).not.toContain('rebond');
      jouer(['exit', 'ssh maison', 'rm .ssh/id_ed25519', 'exit', 'ssh wiki']);
      expect(c.termines).toContain('rebond');
    });

    // Clé et raccourci déjà en place (chapitres 1 et 2), hôtes déjà connus.
    const equipe = (termines: string[]) => {
      const p = avecCle(termines);
      ecrirePoste(p.c, '~/.ssh/config', CONFIG_WIKI);
      p.jouer(['ssh wiki', 'yes', 'yes', 'exit']);
      return p;
    };
    const pidTunnel = (c: Console) => /(\d+)\s+\S+\s+\S+\s+ssh /.exec(c.executer('ps') ?? '')![1];

    it('chapitre 3 — solution : ssh -f -N -L, curl, puis kill', () => {
      const { c, jouer } = equipe(['cles', 'rebond']);
      let tout = jouer(['ssh wiki', 'curl localhost:8080', 'ss -tln', 'exit']);
      expect(tout).toContain('-bash: curl: command not found');
      expect(tout).toContain('127.0.0.1:8080');
      tout = jouer(['ssh -f -N -L 8080:localhost:8080 wiki', 'curl localhost:8080/admin']);
      contient(tout, 'promo-casino : en attente');
      tout = jouer(['curl localhost:8080/admin/valider/samir', 'curl http://127.0.0.1:8080/admin/valider/lea']);
      contient(tout, 'Inscription de lea validée.');
      contient(tout, 'Reste à refermer le tunnel');
      expect(c.termines).not.toContain('tunnel');
      tout = jouer([`kill ${pidTunnel(c)}`]);
      contient(tout, 'https://man.openbsd.org/ssh#L');
      expect(c.termines).toContain('tunnel');
      tout = jouer(['curl localhost:8080/admin']);
      expect(tout).toContain('curl: (7) Failed to connect to localhost port 8080');
    });

    it('chapitre 3 — autre solution : -J sans raccourci, et la publicité refusée après coup', () => {
      const { c, jouer } = avecCle(['cles', 'rebond']);
      jouer(['ssh -f -N -J maison -L 8080:localhost:8080 wiki', 'yes', 'yes']);
      let tout = jouer(['curl localhost:8080/admin/valider/promo-casino']);
      contient(tout, 'Oups');
      jouer(['curl localhost:8080/admin/valider/samir', 'curl localhost:8080/admin/valider/lea', `kill ${pidTunnel(c)}`]);
      expect(c.termines).not.toContain('tunnel');
      jouer(['ssh -fN -L 8080:localhost:8080 -J maison wiki', 'curl localhost:8080/admin/refuser/promo-casino']);
      jouer([`kill ${pidTunnel(c)}`]);
      expect(c.termines).toContain('tunnel');
    });

    it('chapitre 3 — fausses pistes : localhost vu de maison, le wiki par son adresse', () => {
      const { c, jouer } = equipe(['cles', 'rebond']);
      let tout = jouer(['ssh -f -N -L 8080:localhost:8080 maison', 'curl localhost:8080/admin']);
      expect(tout).toContain('channel 2: open failed: connect failed: Connection refused');
      expect(tout).toContain('curl: (52) Empty reply from server');
      jouer([`kill ${pidTunnel(c)}`, 'ssh -f -N -L 8080:wiki:8080 maison']);
      tout = jouer(['curl localhost:8080/admin']);
      expect(tout).toContain('curl: (52) Empty reply from server');
      // Sans -f, ssh rappelle qu'il garde la main.
      jouer([`kill ${pidTunnel(c)}`]);
      tout = jouer(['ssh -N -L 8080:localhost:8080 wiki']);
      contient(tout, '-f');
      expect(c.termines).not.toContain('tunnel');
    });

    const RAPPORT = 'scp wiki:/srv/wiki/exports/rapport-2027.pdf .';
    const SAUVER = 'rsync -av /srv/partage/ archives:/srv/sauvegardes/partage/';

    it('chapitre 4 — solution : scp vers le poste, rsync de maison vers archives', () => {
      const { c, jouer } = equipe(['cles', 'rebond', 'tunnel']);
      let tout = jouer([RAPPORT, 'ls']);
      expect(tout).toContain('rapport-2027.pdf');
      contient(tout, 'Le rapport d');
      jouer(['ssh maison']);
      tout = jouer([SAUVER.replace('-av', '-avn'), 'yes']);
      expect(tout).toContain('(DRY RUN)');
      tout = jouer([SAUVER]);
      expect(tout).toContain('comptes-rendus/ca-2027-09.txt');
      expect(tout).not.toContain('comptes-rendus/ag-2026.txt');
      contient(tout, 'https://download.samba.org/pub/rsync/rsync.1');
      expect(c.termines).toContain('transferts');
    });

    it('chapitre 4 — fausse piste : la barre oblique oubliée, réparée avec --delete', () => {
      const { c, jouer } = equipe(['cles', 'rebond', 'tunnel']);
      let tout = jouer(['ssh maison', 'rsync -av /srv/partage archives:/srv/sauvegardes/partage', 'yes']);
      expect(tout).toContain('partage/planning-salles.txt');
      contient(tout, 'barre oblique finale');
      tout = jouer([SAUVER, 'exit', RAPPORT]);
      expect(c.termines).not.toContain('transferts');
      tout = jouer(['ssh maison', SAUVER.replace('-av', '-av --delete')]);
      expect(tout).toContain('deleting partage/comptes-rendus/');
      expect(c.termines).toContain('transferts');
    });
  });
