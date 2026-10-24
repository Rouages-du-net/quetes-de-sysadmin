// Les Lettres du quartier, « Fermer la porte » : durcir SSH. Rejoué avec la
// console (la fin demande de se reconnecter), dans chaque langue.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/moteur/console';
import { HISTOIRES } from '../src/moteur/chapitres';
import { prerequis } from '../src/moteur/deverrouillage';
import { LANGUES, LANGUE_DE_REFERENCE, traducteur } from '../src/textes';
import { dansLaLangue, machinesDansLaLangue } from './noms';

// L'Effaceur, puis les chapitres à finir pour recevoir la clé de l'histoire.
const EFFACEUR = [...new Set([...HISTOIRES.find((h) => h.id === 'effaceur')!.chapitres.map((c) => c.id), ...prerequis('lettres')])];
const CONFIG = '/etc/ssh/sshd_config';

for (const langue of LANGUES)
  describe(`Langue : ${langue}`, () => {
    const fr = langue === LANGUE_DE_REFERENCE;
    // Le compte du joueur dans la langue (vous@poste, you@poste), comme les noms des lieux.
    const L = (ligne: string) => dansLaLangue(traducteur(langue), ligne);
    const contient = (tout: string, texte: string) => fr && expect(tout).toContain(texte);
    const partie = () => {
      const c = new Console({ langue, termines: EFFACEUR });
      const jouer = (lignes: string[]) => lignes.map((l) => c.executer(machinesDansLaLangue(c.t, l)) ?? '').join('\n');
      // nano : remplacer du texte dans un fichier, puis ^O et ^X.
      const modifier = (fichier: string, changer: (texte: string) => string) => {
        c.executer(`sudo nano ${fichier}`);
        if (c.shell.attente) c.executer('fourmis-2026');
        c.enregistrer(changer(c.edition!.texte));
        return c.quitterEdition();
      };
      return { c, jouer, modifier };
    };

    it('solution : faute de frappe, piège de l’Include, reconnexion', () => {
      const { c, jouer, modifier } = partie();
      let tout = jouer(['ssh lettres', 'yes', 'journalctl -u ssh', 'sshd -t']);
      contient(tout, 'Failed password for root from 203.0.113.66');
      contient(tout, 'sshd: no hostkeys available -- exiting.');
      tout += modifier(CONFIG, (t) => t.replace('PermitRootLogin yes', 'PermitRootLogin non').replace('#PasswordAuthentication yes', 'PasswordAuthentication no'));
      tout += jouer(['sudo sshd -t', 'sudo systemctl reload ssh']);
      contient(tout, 'Il y a une erreur dans la configuration de SSH');
      contient(tout, `${CONFIG} line 17: unsupported option "non".`);
      contient(tout, 'Job for ssh.service failed');
      tout += modifier(CONFIG, (t) => t.replace('PermitRootLogin non', 'PermitRootLogin no'));
      tout += jouer(['sudo systemctl reload ssh', 'sudo sshd -T']);
      contient(tout, 'Étrange');
      expect(tout).toContain('passwordauthentication yes');
      tout += modifier('/etc/ssh/sshd_config.d/50-cloud-init.conf', () => 'PasswordAuthentication no\n');
      tout += jouer(['sudo systemctl reload ssh', 'journalctl -u ssh -n 3', 'exit', 'ssh root@lettres']);
      expect(tout).toContain('[preauth]');
      expect(tout).toContain(machinesDansLaLangue(traducteur(langue), 'root@lettres.internal: Permission denied (publickey).'));
      expect(c.termines).not.toContain('fermer-la-porte');
      tout += jouer(['ssh lettres']);
      contient(tout, 'https://man.openbsd.org/sshd_config');
      expect(c.termines).toContain('fermer-la-porte');
    });

    it('une autre solution : un fichier 00-… dans sshd_config.d, lu en premier', () => {
      const { c, jouer, modifier } = partie();
      jouer(['ssh lettres', 'yes']);
      c.executer('sudo nano /etc/ssh/sshd_config.d/00-durcissement.conf');
      c.executer('fourmis-2026');
      c.enregistrer('PermitRootLogin no\nPasswordAuthentication no\n');
      c.quitterEdition();
      jouer(['sudo systemctl restart ssh', 'exit', 'ssh lettres']);
      expect(c.termines).toContain('fermer-la-porte');
    });

    it('s’enfermer dehors, puis la console de secours (le menu)', () => {
      const { c, jouer, modifier } = partie();
      jouer(['ssh lettres', 'yes']);
      const alerte = modifier('/etc/ssh/sshd_config.d/00-durcissement.conf', () => 'PermitRootLogin no\nPasswordAuthentication no\nAllowUsers kofi\n');
      const recharge = jouer(['sudo systemctl reload ssh']);
      contient(alerte + recharge, 'une nouvelle connexion de ton compte serait refusée');
      const dehors = jouer(['exit', 'ssh lettres']);
      expect(dehors).toContain(L('vous@lettres.internal: Permission denied (publickey).'));
      contient(dehors, 'tu t’es enfermé·e dehors'.replace('’', "'"));
      expect(c.invite()).toBe(L('vous@poste:~$'));
      // Le menu : comme la console de secours de l'hébergeur.
      c.connecter('lettres');
      modifier('/etc/ssh/sshd_config.d/00-durcissement.conf', (t) => t.replace('AllowUsers kofi', L('AllowUsers vous')));
      jouer(['sudo systemctl reload ssh', 'exit', 'ssh lettres']);
      expect(c.termines).toContain('fermer-la-porte');
    });

    it('fausse piste : modifier le fichier sans recharger ne change rien', () => {
      const { c, jouer, modifier } = partie();
      jouer(['ssh lettres', 'yes']);
      modifier('/etc/ssh/sshd_config.d/50-cloud-init.conf', () => 'PermitRootLogin no\nPasswordAuthentication no\n');
      jouer(['exit', 'ssh lettres']);
      expect(c.termines).not.toContain('fermer-la-porte');
    });
  });

// Les Lettres du quartier, « Le pare-feu » : ufw.
for (const langue of LANGUES)
  describe(`Le pare-feu — ${langue}`, () => {
    const fr = langue === LANGUE_DE_REFERENCE;
    // Le compte du joueur dans la langue (vous@poste, you@poste), comme les noms des lieux.
    const L = (ligne: string) => dansLaLangue(traducteur(langue), ligne);
    const partie = () => {
      const c = new Console({ langue, termines: [...EFFACEUR, 'fermer-la-porte'] });
      const jouer = (lignes: string[]) => lignes.map((l) => c.executer(machinesDansLaLangue(c.t, l)) ?? '').join('\n');
      jouer(['ssh lettres', 'yes']);
      expect(c.distant?.shell.chapitre.id).toBe('pare-feu');
      return { c, jouer };
    };

    it('solution : ss, ufw, le piège de l’activation, la reconnexion', () => {
      const { c, jouer } = partie();
      let tout = jouer(['cat scan_yasmine.txt', 'ss -tln', 'ufw status', 'sudo ufw allow "Nginx Full"', 'fourmis-2026', 'sudo ufw enable', 'o']);
      expect(tout).toContain('0.0.0.0:3306');
      if (fr) expect(tout).toContain('ERREUR : Vous devez être root pour exécuter ce script');
      if (fr) expect(tout).toContain('bloque SSH');
      tout = jouer(['sudo ufw limit OpenSSH', 'sudo ufw status verbose', 'exit', 'ssh lettres']);
      expect(tout).toContain('LIMIT IN');
      if (fr) expect(tout).toContain('https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html');
      expect(c.termines).toContain('pare-feu');
    });

    it('une autre solution : reject par défaut, SSH depuis le poste seulement', () => {
      const { c, jouer } = partie();
      jouer([
        'sudo ufw default reject incoming', 'fourmis-2026', 'sudo ufw allow from 192.0.2.2 to any port 22 proto tcp',
        'sudo ufw allow 80/tcp', 'sudo ufw allow https', 'sudo ufw enable', 'y', 'exit', 'ssh lettres',
      ]);
      expect(c.termines).toContain('pare-feu');
    });

    it('s’enfermer dehors : timeout, puis la console de secours', () => {
      const { c, jouer } = partie();
      jouer(['sudo ufw allow http', 'fourmis-2026', 'sudo ufw allow https', 'sudo ufw enable', 'o']);
      const dehors = jouer(['exit', 'ssh lettres']);
      expect(dehors).toContain(machinesDansLaLangue(traducteur(langue), 'ssh: connect to host lettres.internal port 22: Connection timed out'));
      expect(c.invite()).toBe(L('vous@poste:~$'));
      c.connecter('lettres');
      jouer(['sudo ufw allow OpenSSH', 'exit', 'ssh lettres']);
      expect(c.termines).toContain('pare-feu');
    });

    it('fausses pistes : laisser la base ouverte, couper le site, ne pas activer', () => {
      const { c, jouer } = partie();
      const tout = jouer(['sudo ufw allow OpenSSH', 'fourmis-2026', 'sudo ufw default allow', 'sudo ufw enable', 'o', 'sudo ufw default deny', 'exit', 'ssh lettres']);
      if (fr) expect(tout).toContain('la base de données (3306) est toujours');
      if (fr) expect(tout).toContain('le site des Lettres ne répond plus');
      expect(c.termines).not.toContain('pare-feu');
      jouer(['sudo ufw disable', 'sudo ufw allow "Nginx Full"', 'exit', 'ssh lettres']);
      expect(c.termines).not.toContain('pare-feu');
    });
  });

// Les Lettres du quartier, « La sentinelle » : fail2ban.
for (const langue of LANGUES)
  describe(`La sentinelle — ${langue}`, () => {
    const fr = langue === LANGUE_DE_REFERENCE;
    const partie = () => {
      const c = new Console({ langue, termines: [...EFFACEUR, 'fermer-la-porte', 'pare-feu'] });
      const jouer = (lignes: string[]) => lignes.map((l) => c.executer(machinesDansLaLangue(c.t, l)) ?? '').join('\n');
      const ecrire = (fichier: string, texte: string) => {
        c.executer(`sudo nano ${fichier}`);
        if (c.shell.attente) c.executer('fourmis-2026');
        c.enregistrer(texte);
        return c.quitterEdition();
      };
      jouer(['ssh lettres', 'yes']);
      expect(c.distant?.shell.chapitre.id).toBe('sentinelle');
      return { c, jouer, ecrire };
    };
    const BON = '[DEFAULT]\nbantime = 1h\nignoreip = 127.0.0.1/8 ::1 192.0.2.2 198.51.100.40\n';

    it('solution : lire le journal, débannir Rania, jail.local, recharger, vérifier', () => {
      const { c, jouer, ecrire } = partie();
      let tout = jouer(['cat /var/log/fail2ban.log', 'sudo fail2ban-client status sshd', 'fourmis-2026', 'sudo fail2ban-client set sshd unbanip 198.51.100.40']);
      expect(tout).toContain('Ban 198.51.100.40');
      expect(tout).toContain('`- Banned IP list:\t203.0.113.66 198.51.100.40 198.51.100.23');
      tout += ecrire('/etc/fail2ban/jail.local', BON);
      tout += jouer(['sudo fail2ban-client -t', 'sudo systemctl reload fail2ban', 'sudo fail2ban-client get sshd bantime']);
      expect(tout).toContain('OK: configuration test is successful');
      expect(tout).toContain('3600');
      expect(c.termines).not.toContain('sentinelle');
      tout += jouer(['sudo fail2ban-client status sshd']);
      if (fr) expect(tout).toContain('https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html');
      expect(c.termines).toContain('sentinelle');
    });

    it('une autre solution : jail.d/*.local, bantime -1, ignoreip en CIDR', () => {
      const { c, jouer, ecrire } = partie();
      ecrire('/etc/fail2ban/jail.d/lettres.local', '[sshd]\nbantime = -1\nignoreip = 192.0.2.0/24 198.51.100.40\n');
      jouer(['sudo fail2ban-client reload', 'sudo fail2ban-client set sshd unbanip 198.51.100.40', 'sudo fail2ban-client status sshd']);
      expect(c.termines).toContain('sentinelle');
    });

    it('se bannir soi-même : Connection refused, puis la console de secours', () => {
      const { c, jouer, ecrire } = partie();
      const alerte = ecrire('/etc/fail2ban/jail.local', '[DEFAULT]\nmaxretry = 3\n') + jouer(['sudo systemctl reload fail2ban']);
      if (fr) expect(alerte).toContain("l'adresse de ton propre");
      const dehors = jouer(['exit', 'ssh lettres']);
      expect(dehors).toContain(machinesDansLaLangue(traducteur(langue), 'ssh: connect to host lettres.internal port 22: Connection refused'));
      c.connecter('lettres');
      ecrire('/etc/fail2ban/jail.local', BON);
      jouer([
        'sudo fail2ban-client set sshd unbanip 192.0.2.2', 'sudo fail2ban-client reload',
        'sudo fail2ban-client set sshd unbanip 198.51.100.40', 'sudo fail2ban-client status sshd',
      ]);
      expect(c.termines).toContain('sentinelle');
    });

    it('fausses pistes : syntaxe, ne pas recharger, oublier Rania, modifier jail.conf', () => {
      const { c, jouer, ecrire } = partie();
      let tout = ecrire('/etc/fail2ban/jail.local', '[DEFAULT]\nbantime 1h\n') + jouer(['sudo fail2ban-client -t', 'sudo systemctl reload fail2ban']);
      expect(tout).toContain("Source contains parsing errors: '/etc/fail2ban/jail.local'");
      expect(tout).toContain('Job for fail2ban.service failed');
      ecrire('/etc/fail2ban/jail.local', BON);
      jouer(['sudo fail2ban-client status sshd']);
      expect(c.termines).not.toContain('sentinelle');
      jouer(['sudo fail2ban-client reload', 'sudo fail2ban-client status sshd']);
      expect(c.termines).not.toContain('sentinelle');
      tout = ecrire('/etc/fail2ban/jail.conf', '[DEFAULT]\nbantime = 1h\n');
      if (fr) expect(tout).toContain('YOU SHOULD NOT MODIFY THIS');
    });
  });

// Les Lettres du quartier, « Le port » : déplacer SSH sur 2222 sans s'enfermer dehors.
const LETTRES = ['fermer-la-porte', 'pare-feu', 'sentinelle', 'colocation', 'chez-moi', 'concert'];

for (const langue of LANGUES)
  describe(`Le port — ${langue}`, () => {
    const fr = langue === LANGUE_DE_REFERENCE;
    const partie = () => {
      const c = new Console({ langue, termines: [...EFFACEUR, ...LETTRES] });
      const jouer = (lignes: string[]) => lignes.map((l) => c.executer(machinesDansLaLangue(c.t, l)) ?? '').join('\n');
      const ecrire = (fichier: string, changer: (texte: string) => string, sudo = true) => {
        c.executer(`${sudo ? 'sudo ' : ''}nano ${fichier}`);
        if (c.shell.attente) c.executer('fourmis-2026');
        c.enregistrer(changer(c.edition!.texte));
        return c.quitterEdition();
      };
      jouer(['ssh lettres', 'yes']);
      expect(c.distant?.shell.chapitre.id).toBe('port');
      return { c, jouer, ecrire };
    };
    const M = (x: string) => machinesDansLaLangue(traducteur(langue), x);
    const portDuPoste = (t: string) =>
      t.replace(M('Host lettres\n    HostName lettres.internal'), M('Host lettres\n    HostName lettres.internal\n    Port 2222'));

    it('solution : les deux ports, tester, fermer le 22, la prison sshd', () => {
      const { c, jouer, ecrire } = partie();
      let tout = jouer(['journalctl -u ssh -n 4', 'sudo ufw status', 'fourmis-2026', 'sudo nft list ruleset']);
      expect(tout).toContain('Invalid user');
      expect(tout).toContain('meta l4proto tcp tcp dport 22 counter packets 0 bytes 0 accept');
      expect(tout).toContain('tcp dport { 22 } ip saddr @addr-set-sshd reject');
      tout += ecrire('/etc/ssh/sshd_config', (t) => t.replace('#Port 22', 'Port 22\nPort 2222'));
      tout += jouer(['sudo sshd -t', 'sudo ufw allow 2222/tcp', 'sudo systemctl reload ssh', 'sudo ss -tlnp']);
      expect(tout).toContain('0.0.0.0:2222');
      if (fr) expect(tout).toContain('les deux ports');
      tout += jouer(['exit']);
      tout += ecrire('~/.ssh/config', portDuPoste, false);
      tout += jouer(['ssh lettres']);
      expect(tout).toContain(machinesDansLaLangue(traducteur(langue), "The authenticity of host '[lettres.internal]:2222 ([203.0.113.10]:2222)' can't be established."));
      expect(tout).toContain('This host key is known by the following other names/addresses:');
      tout += jouer(['yes', 'ss -tn']);
      expect(tout).toContain(M("Warning: Permanently added '[lettres.internal]:2222' (ED25519) to the list of known hosts."));
      expect(tout).toContain('203.0.113.10:2222');
      tout += ecrire('/etc/ssh/sshd_config', (t) => t.replace('Port 22\n', ''));
      tout += jouer(['sudo systemctl reload ssh', 'sudo ufw delete allow OpenSSH']);
      if (fr) expect(tout).toContain('bannit toujours sur le port');
      expect(c.termines).not.toContain('port');
      tout += ecrire('/etc/fail2ban/jail.local', (t) => `${t}\n\n[sshd]\nport = 2222\n`);
      tout += jouer(['sudo systemctl reload fail2ban']);
      if (fr) expect(tout).toContain('https://man.openbsd.org/sshd_config#Port');
      expect(c.termines).toContain('port');
      expect(jouer(['sudo nft list ruleset'])).toContain('tcp dport { 2222 } ip saddr @addr-set-sshd');
      // Le 22 est bien fermé, vu du poste.
      expect(jouer(['exit', 'ssh -p 22 lettres'])).toContain('port 22: Connection refused');
    });

    it('fausses pistes : fermer le 22 trop tôt, port = 2222 dans [DEFAULT]', () => {
      const { c, jouer, ecrire } = partie();
      let tout = ecrire('/etc/ssh/sshd_config', (t) => t.replace('#Port 22', 'Port 2222'));
      tout += jouer(['sudo systemctl reload ssh', 'fourmis-2026']);
      if (fr) expect(tout).toContain('ATTENTION');
      tout = jouer(['exit', 'ssh lettres', 'ssh -p 2222 lettres']);
      expect(tout).toContain(machinesDansLaLangue(traducteur(langue), 'ssh: connect to host lettres.internal port 22: Connection refused'));
      if (fr) expect(tout).toContain('écoute maintenant sur 2222');
      expect(tout).toContain('port 2222: Connection timed out');
      // La console de secours : ouvrir 2222 dans ufw.
      c.connecter('lettres');
      jouer(['sudo ufw allow 2222/tcp', 'fourmis-2026', 'sudo ufw delete allow OpenSSH']);
      tout = ecrire('/etc/fail2ban/jail.local', (t) => t.replace('[DEFAULT]', '[DEFAULT]\nport = 2222'));
      tout += jouer(['sudo systemctl reload fail2ban']);
      if (fr) expect(tout).toContain('quel que soit le fichier');
      jouer(['exit']);
      ecrire('~/.ssh/config', portDuPoste, false);
      jouer(['ssh lettres', 'yes']);
      expect(c.termines).not.toContain('port');
      ecrire('/etc/fail2ban/jail.local', (t) => t.replace('port = 2222', '') + '\n[sshd]\nport = ssh,2222\n');
      jouer(['sudo fail2ban-client reload', 'fourmis-2026']);
      expect(c.termines).toContain('port');
    });

    it('nft ne fait que regarder sous ufw', () => {
      const { jouer } = partie();
      const tout = jouer(['nft list ruleset', 'sudo nft list tables', 'fourmis-2026', 'sudo nft add rule ip filter INPUT tcp dport 2222 accept']);
      expect(tout).toContain('Operation not permitted');
      expect(tout).toContain('table ip filter\ntable inet f2b-table');
      if (fr) expect(tout).toContain('ufw et fail2ban qui écrivent');
    });
  });

// Les Lettres du quartier, « La récidive » : les prisons recidive et nginx-limit-req.
for (const langue of LANGUES)
  describe(`La récidive — ${langue}`, () => {
    const fr = langue === LANGUE_DE_REFERENCE;
    const partie = () => {
      const c = new Console({ langue, termines: [...EFFACEUR, ...LETTRES, 'port'] });
      const jouer = (lignes: string[]) => lignes.map((l) => c.executer(machinesDansLaLangue(c.t, l)) ?? '').join('\n');
      const ecrire = (fichier: string, changer: (texte: string) => string) => {
        c.executer(`sudo nano ${fichier}`);
        if (c.shell.attente) c.executer('fourmis-2026');
        c.enregistrer(changer(c.edition!.texte));
        return c.quitterEdition();
      };
      // Le chapitre commence avec SSH sur le port 2222 (« Le port »).
      const entree = jouer(['ssh lettres', 'ssh -p 2222 lettres', 'yes']);
      expect(entree).toContain('port 22: Connection refused');
      expect(c.distant?.shell.chapitre.id).toBe('recidive');
      return { c, jouer, ecrire };
    };
    const PRISONS = '\n[recidive]\nenabled = true\n\n[nginx-limit-req]\nenabled = true\n';

    it('solution : lire les journaux, activer recidive et nginx-limit-req dans jail.local', () => {
      const { c, jouer, ecrire } = partie();
      let tout = jouer([
        'grep -c "Ban 203.0.113.66" /var/log/fail2ban.log',
        'grep -c "limiting requests" /var/log/nginx/error.log',
        'grep "^\\[" /etc/fail2ban/jail.conf',
      ]);
      expect(tout).toContain('[recidive]');
      tout += ecrire('/etc/fail2ban/jail.local', (t) => t + '\n' + PRISONS);
      tout += jouer(['sudo fail2ban-client -t', 'sudo systemctl reload fail2ban', 'sudo fail2ban-client status']);
      expect(tout).toContain('Jail list:\tnginx-limit-req, recidive, sshd');
      if (fr) expect(tout).toContain('pour une semaine');
      expect(c.termines).not.toContain('recidive');
      tout += jouer(['sudo fail2ban-client status recidive', 'sudo fail2ban-client status nginx-limit-req', 'sudo nft list table inet f2b-table']);
      expect(tout).toContain('Banned IP list:\t203.0.113.66 198.51.100.23');
      expect(tout).toContain('Banned IP list:\t198.51.100.24 198.51.100.25 198.51.100.26');
      expect(tout).toContain('File list:\t/var/log/nginx/error.log');
      expect(tout).toContain('meta l4proto { tcp } ip saddr @addr-set-recidive reject');
      expect(tout).toContain('tcp dport { 80, 443 } ip saddr @addr-set-nginx-limit-req reject');
      expect(c.termines).toContain('recidive');
    });

    it('une autre solution : jail.d/*.local, et recidive bannie pour toujours', () => {
      const { c, jouer, ecrire } = partie();
      ecrire(
        '/etc/fail2ban/jail.d/prisons.local',
        () => '[recidive]\nenabled = true\nbantime = -1\n\n[nginx-limit-req]\nenabled = true\nmaxretry = 8\n',
      );
      jouer(['sudo fail2ban-client reload', 'sudo fail2ban-client status nginx-limit-req']);
      expect(c.termines).toContain('recidive');
    });

    it('fausses pistes : tout activer dans [DEFAULT], une recidive trop courte, oublier Rania', () => {
      const { c, jouer, ecrire } = partie();
      let tout = ecrire('/etc/fail2ban/jail.local', (t) => t.replace('[DEFAULT]', '[DEFAULT]\nenabled = true'));
      tout += jouer(['sudo fail2ban-client -t', 'sudo systemctl reload fail2ban']);
      expect(tout).toContain('Have not found any log file for apache-auth jail');
      expect(tout).toContain('Job for fail2ban.service failed');
      if (fr) expect(tout).toContain('TOUTES les prisons');
      ecrire('/etc/fail2ban/jail.local', (t) => t.replace('enabled = true\n', '') + '\n[recidive]\nenabled = true\nbantime = 1h\n');
      tout = jouer(['sudo systemctl reload fail2ban']);
      if (fr) expect(tout).toContain('pas plus longtemps');
      // Rania sortie d'ignoreip : la prison nginx la bannit.
      ecrire(
        '/etc/fail2ban/jail.local',
        (t) =>
          t.replace('bantime = 1h\n', 'bantime = 1w\n').replace('ignoreip = 198.51.100.40 ', 'ignoreip = ') + '\n[nginx-limit-req]\nenabled = true\n',
      );
      tout = jouer(['sudo systemctl reload fail2ban', 'sudo fail2ban-client status nginx-limit-req']);
      expect(tout).toContain('198.51.100.40');
      expect(c.termines).not.toContain('recidive');
      ecrire('/etc/fail2ban/jail.local', (t) => t.replace('ignoreip = ', 'ignoreip = 198.51.100.40 '));
      jouer(['sudo fail2ban-client unban 198.51.100.40', 'sudo systemctl reload fail2ban', 'sudo fail2ban-client status']);
      expect(c.termines).toContain('recidive');
    });
  });
