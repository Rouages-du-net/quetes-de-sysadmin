// La Maison des associations : les clés, le rebond, le tunnel, les
// transferts. Rejoué avec la console (tout part du poste), dans chaque langue.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/moteur/console';
import { HISTOIRES } from '../src/moteur/chapitres';
import { LANGUES, LANGUE_DE_REFERENCE, traducteur } from '../src/textes';
import { dansLaLangue, machinesDansLaLangue } from './noms';

const EFFACEUR = HISTOIRES.find((h) => h.id === 'effaceur')!.chapitres.map((c) => c.id);
const CONFIG = '/etc/ssh/sshd_config';

for (const langue of LANGUES)
  describe(`La Maison des associations — ${langue}`, () => {
    const fr = langue === LANGUE_DE_REFERENCE;
    // Une ligne écrite avec les noms français, dans la langue de la partie.
    const L = (ligne: string) => dansLaLangue(traducteur(langue), ligne);
    const contient = (tout: string, texte: string) => fr && expect(tout).toContain(texte);
    const partie = (termines: string[] = []) => {
      const c = new Console({ langue, termines: [...EFFACEUR, ...termines] });
      const jouer = (lignes: string[]) => lignes.map((l) => c.executer(machinesDansLaLangue(c.t, l)) ?? '').join('\n');
      const modifier = (fichier: string, changer: (texte: string) => string, mdp = 'lilas-2027') => {
        c.executer(`sudo nano ${fichier}`);
        if (c.shell.attente) c.executer(machinesDansLaLangue(c.t, mdp));
        c.enregistrer(changer(c.edition!.texte));
        return c.quitterEdition();
      };
      return { c, jouer, modifier };
    };

    it('chapitre 1 — solution : ssh-keygen, ssh-copy-id, puis plus de mots de passe', () => {
      const { c, jouer, modifier } = partie();
      let tout = jouer(['ssh maison', 'yes']);
      expect(c.invite()).toBe(L("vous@maison.internal's password:"));
      tout += jouer(['lilas-2027']);
      contient(tout, 'Bienvenue dans l');
      expect(c.invite()).toBe(L('vous@maison:~$'));
      tout += jouer(['exit', 'ssh-keygen', '', '', '', 'ssh-copy-id maison', 'lilas-2027']);
      expect(tout).toContain(L('Your public key has been saved in /home/vous/.ssh/id_ed25519.pub'));
      expect(tout).toContain('Number of key(s) added: 1');
      tout += jouer(['ssh maison']);
      expect(c.invite()).toBe(L('vous@maison:~$'));
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
      jouer([L('ssh-keygen -t ed25519 -C vous@poste'), '', 'une longue phrase', 'une longue phrase']);
      const publique = c.poste.lire('~/.ssh/id_ed25519.pub')!;
      jouer(['ssh maison', 'yes', 'lilas-2027', 'mkdir .ssh']);
      c.executer('nano .ssh/authorized_keys');
      c.enregistrer(publique + '\n');
      c.quitterEdition();
      jouer(['chmod 600 .ssh/authorized_keys', 'exit', 'ssh maison']);
      expect(c.invite()).toBe(L("Enter passphrase for key '/home/vous/.ssh/id_ed25519':"));
      jouer(['une longue phrase']);
      expect(c.invite()).toBe(L('vous@maison:~$'));
      modifier('/etc/ssh/sshd_config.d/00-cles.conf', () => 'PasswordAuthentication no\n');
      jouer(['sudo systemctl restart ssh', 'exit', 'ssh maison', 'une longue phrase']);
      expect(c.termines).toContain('cles');
    });

    it('chapitre 1 — fausses pistes : ssh-copy-id sans clé, fermer la porte avant de poser la clé', () => {
      const { c, jouer, modifier } = partie();
      // Sans clé à soi, ssh-copy-id prend la plus récente de ~/.ssh : celle du royaume.
      let tout = jouer(['ssh-copy-id maison', 'yes', 'lilas-2027', 'ssh maison']);
      expect(tout).toContain(L('Source of key(s) to be installed: "/home/vous/.ssh/id_royaume.pub"'));
      expect(c.invite()).toBe(L("vous@maison.internal's password:"));
      tout = jouer(['lilas-2027']);
      contient(tout, "jeu t'a donnée pour une autre machine");
      tout = modifier(CONFIG, (t) => t.replace('#PasswordAuthentication yes', 'PasswordAuthentication no'));
      tout += jouer(['sudo systemctl reload ssh']);
      contient(tout, 'aucune clé n');
      tout = jouer(['exit', 'ssh maison']);
      expect(tout).toContain(L('vous@maison.internal: Permission denied (publickey).'));
      expect(c.invite()).toBe(L('vous@poste:~$'));
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
    const CONFIG_WIKI = L('\nHost wiki\n    HostName wiki\n    User vous\n    ProxyJump maison\n');
    const ecrirePoste = (c: Console, fichier: string, ajouter: string) => {
      c.executer(`nano ${fichier}`);
      c.enregistrer(c.edition!.texte + ajouter);
      return c.quitterEdition();
    };

    it('chapitre 2 — solution : ssh -J, puis ProxyJump dans ~/.ssh/config', () => {
      const { c, jouer } = avecCle(['cles']);
      let tout = jouer(['ssh -J maison wiki', 'yes', 'yes']);
      contient(tout, 'Le wiki');
      expect(c.invite()).toBe(L('vous@wiki:~$'));
      contient(tout, 'Te voilà sur le wiki');
      tout += jouer(['hostname', 'cat note_gaspard.txt', 'exit']);
      expect(c.invite()).toBe(L('vous@poste:~$'));
      // Le chapitre regarde le poste : le raccourci écrit suffit (déjà venu·e au wiki).
      tout = ecrirePoste(c, '~/.ssh/config', CONFIG_WIKI);
      contient(tout, 'https://man.openbsd.org/ssh_config#ProxyJump');
      expect(c.termines).toContain('rebond');
      tout = jouer(['ssh -G wiki']);
      expect(tout).toContain(machinesDansLaLangue(traducteur(langue), 'proxyjump maison'));
      tout = jouer(['ssh wiki']);
      expect(c.invite()).toBe(L('vous@wiki:~$'));
      // Un rebond n'affiche pas la bannière de la passerelle.
      expect(tout).not.toContain('Linux maison');
      tout = jouer(['exit']);
      expect(c.invite()).toBe(L('vous@poste:~$'));
    });

    it('chapitre 2 — fausses pistes : ssh wiki depuis le poste, depuis maison, la clé privée recopiée', () => {
      const { c, jouer } = avecCle(['cles']);
      let tout = jouer(['ssh wiki']);
      expect(tout).toContain('ssh: Could not resolve hostname wiki: Name or service not known');
      tout = jouer(['ssh maison', 'yes', 'ssh wiki', 'yes']);
      expect(tout).toContain(L('vous@wiki: Permission denied (publickey).'));
      expect(c.invite()).toBe(L('vous@maison:~$'));
      tout = jouer(['exit', 'scp ~/.ssh/id_ed25519 maison:.ssh/']);
      contient(tout, 'il y a une clé privée dans ~/.ssh sur maison');
      jouer(['ssh maison']);
      // Avec la clé privée recopiée, le second ssh passe… mais le chapitre ne se termine pas.
      jouer(['chmod 600 .ssh/id_ed25519', 'ssh wiki']);
      expect(c.invite()).toBe(L('vous@wiki:~$'));
      jouer(['exit', 'exit']);
      ecrirePoste(c, '~/.ssh/config', CONFIG_WIKI);
      jouer(['ssh wiki', 'yes']);
      expect(c.invite()).toBe(L('vous@wiki:~$'));
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

    const RAPPORT = L('scp wiki:/srv/wiki/exports/rapport-2027.pdf .');
    const SAUVER = L('rsync -av /srv/partage/ archives:/srv/sauvegardes/partage/');

    it('chapitre 4 — solution : scp vers le poste, rsync de maison vers archives', () => {
      const { c, jouer } = equipe(['cles', 'rebond', 'tunnel']);
      let tout = jouer([RAPPORT, 'ls']);
      expect(tout).toContain(L('rapport-2027.pdf'));
      contient(tout, 'Le rapport d');
      jouer(['ssh maison']);
      tout = jouer([SAUVER.replace('-av', '-avn'), 'yes']);
      expect(tout).toContain('(DRY RUN)');
      tout = jouer([SAUVER]);
      expect(tout).toContain(L('comptes-rendus/ca-2027-09.txt'));
      expect(tout).not.toContain(L('comptes-rendus/ag-2026.txt'));
      contient(tout, 'https://download.samba.org/pub/rsync/rsync.1');
      expect(c.termines).toContain('transferts');
    });

    it('chapitre 4 — fausse piste : la barre oblique oubliée, réparée avec --delete', () => {
      const { c, jouer } = equipe(['cles', 'rebond', 'tunnel']);
      let tout = jouer(['ssh maison', L('rsync -av /srv/partage archives:/srv/sauvegardes/partage'), 'yes']);
      expect(tout).toContain(L('partage/planning-salles.txt'));
      contient(tout, 'barre oblique finale');
      tout = jouer([SAUVER, 'exit', RAPPORT]);
      expect(c.termines).not.toContain('transferts');
      tout = jouer(['ssh maison', SAUVER.replace('-av', '-av --delete')]);
      expect(tout).toContain(L('deleting partage/comptes-rendus/'));
      expect(c.termines).toContain('transferts');
    });

    const LFTP = 'lftp -u maisonasso ftp.hosting.example';
    const MDP_FTP = 'Kp7-hebergement-2028';

    it('chapitre 5 — solution : sftp depuis le wiki, puis lftp en FTPS, mirror -R --delete', () => {
      const { c, jouer } = equipe(['cles', 'rebond', 'tunnel', 'transferts']);
      let tout = jouer(['ssh maison', L('cat courriel_hebergeur.txt'), 'exit']);
      if (fr) expect(tout).toContain('Serveur : ftp.hosting.example');
      tout = jouer(['sftp wiki', 'pwd', 'cd /srv/wiki', 'ls', 'get -r site', 'lls', 'bye', 'ls site']);
      expect(tout).toContain('Connected to wiki.');
      expect(tout).toContain(L('Remote working directory: /home/vous'));
      expect(tout).toContain('Fetching /srv/wiki/site/ to site');
      expect(tout).toContain('adhesion.html');
      tout = jouer([
        LFTP,
        MDP_FTP,
        'ls',
        'mirror -R --delete --dry-run site public_html',
        'mirror -R --delete site public_html',
        'ls public_html',
        'bye',
      ]);
      expect(tout).toContain('tarifs-2025.html');
      expect(tout).toContain('rm /public_html/tarifs-2025.html');
      expect(tout).toContain('Removed: 1 file, 0 directories, 0 symlinks');
      contient(tout, 'https://lftp.yar.ru/lftp-man.html');
      expect(c.termines).toContain('hebergeur');
    });

    it('chapitre 5 — fausses pistes : en clair, le nom de Gaspard, sans vérification, à l’envers, sans cible, sans --delete', () => {
      const { c, jouer } = equipe(['cles', 'rebond', 'tunnel', 'transferts']);
      jouer(['ssh maison', 'exit']);
      let tout = jouer(['lftp -u maisonasso -e "set ftp:ssl-allow no; ls" ftp.community.example', MDP_FTP]);
      expect(tout).toContain('ls: Login failed: 421 Sorry, cleartext sessions and weak ciphers are not accepted on this server.');
      contient(tout, 'plus de FTP en clair');
      tout = jouer(['set ftp:ssl-allow yes', 'ls']);
      expect(tout).toContain(
        "ls: Fatal error: Certificate verification: certificate common name doesn't match requested host name ‘ftp.community.example’",
      );
      contient(tout, 'le nom que son\ncertificat porte'.replace('\n', ' '));
      tout = jouer(['set ssl:verify-certificate no', 'ls public_html', 'mirror public_html site']);
      expect(tout).toContain('tarifs-2025.html');
      contient(tout, 'la vérification du certificat est coupée');
      contient(tout, 'mirror sans -R');
      tout = jouer(['bye', 'rm site/tarifs-2025.html', 'sftp wiki', 'get -r /srv/wiki/site', 'bye', LFTP, MDP_FTP, 'mirror -R site']);
      contient(tout, 'pas dans public_html');
      tout = jouer(['rm -r site', 'mirror -R site public_html']);
      contient(tout, '--delete');
      expect(c.termines).not.toContain('hebergeur');
      jouer(['mirror -R --delete site public_html', 'bye']);
      expect(c.termines).toContain('hebergeur');
    });
  });
