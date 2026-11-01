// Les Lettres du quartier, « Fermer la porte » : durcir SSH. Rejoué avec la
// console (la fin demande de se reconnecter), dans chaque langue.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';

// L'Effaceur, puis les chapitres à finir pour recevoir la clé de l'histoire.
const ERASER = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('letters')])];
const CONFIG = '/etc/ssh/sshd_config';

for (const language of LANGUAGES)
  describe(`Langue : ${language}`, () => {
    const fr = language === 'fr';
    // Le compte du joueur dans la langue (vous@poste, you@poste), comme les noms des lieux.
    const L = (line: string) => inLanguage(translator(language), line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const part = () => {
      const c = new Console({ language, finished: ERASER });
      const play = (lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');
      // nano : remplacer du texte dans un fichier, puis ^O et ^X.
      const modify = (file: string, change: (text: string) => string) => {
        c.execute(`sudo nano ${file}`);
        if (c.shell.waiting) c.execute(machinesInLanguage(c.t, 'fourmis-2026'));
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      return { c, jouer: play, modifier: modify };
    };

    it('solution : faute de frappe, piège de l’Include, reconnexion', () => {
      const { c, jouer: play, modifier: modify } = part();
      let all = play(['ssh lettres', 'yes', 'journalctl -u ssh', 'sshd -t']);
      contains(all, 'Failed password for root from 203.0.113.66');
      contains(all, 'sshd: no hostkeys available -- exiting.');
      all += modify(CONFIG, (t) => t.replace('PermitRootLogin yes', 'PermitRootLogin non').replace('#PasswordAuthentication yes', 'PasswordAuthentication no'));
      all += play(['sudo sshd -t', 'sudo systemctl reload ssh']);
      contains(all, 'Il y a une erreur dans la configuration de SSH');
      contains(all, `${CONFIG} line 17: unsupported option "non".`);
      contains(all, 'Job for ssh.service failed');
      all += modify(CONFIG, (t) => t.replace('PermitRootLogin non', 'PermitRootLogin no'));
      all += play(['sudo systemctl reload ssh', 'sudo sshd -T']);
      contains(all, 'Étrange');
      expect(all).toContain('passwordauthentication yes');
      all += modify('/etc/ssh/sshd_config.d/50-cloud-init.conf', () => 'PasswordAuthentication no\n');
      all += play(['sudo systemctl reload ssh', 'journalctl -u ssh -n 3', 'exit', 'ssh root@lettres']);
      expect(all).toContain('[preauth]');
      expect(all).toContain(machinesInLanguage(translator(language), 'root@lettres.internal: Permission denied (publickey).'));
      expect(c.finished).not.toContain('shut-the-door');
      all += play(['ssh lettres']);
      contains(all, 'https://man.openbsd.org/sshd_config');
      expect(c.finished).toContain('shut-the-door');
    });

    it('une autre solution : un fichier 00-… dans sshd_config.d, lu en premier', () => {
      const { c, jouer: play, modifier: modify } = part();
      play(['ssh lettres', 'yes']);
      c.execute('sudo nano /etc/ssh/sshd_config.d/00-hardening.conf');
      c.execute(machinesInLanguage(c.t, 'fourmis-2026'));
      c.save('PermitRootLogin no\nPasswordAuthentication no\n');
      c.quitEdition();
      play(['sudo systemctl restart ssh', 'exit', 'ssh lettres']);
      expect(c.finished).toContain('shut-the-door');
    });

    it('s’enfermer dehors, puis la console de secours (le menu)', () => {
      const { c, jouer: play, modifier: modify } = part();
      play(['ssh lettres', 'yes']);
      const alert = modify('/etc/ssh/sshd_config.d/00-hardening.conf', () => 'PermitRootLogin no\nPasswordAuthentication no\nAllowUsers kofi\n');
      const reload = play(['sudo systemctl reload ssh']);
      contains(alert + reload, 'une nouvelle connexion de ton compte serait refusée');
      const outside = play(['exit', 'ssh lettres']);
      expect(outside).toContain(L('vous@lettres.internal: Permission denied (publickey).'));
      contains(outside, 'tu t’es enfermé·e dehors'.replace('’', "'"));
      expect(c.prompt()).toBe(L('vous@poste:~$'));
      // Le menu : comme la console de secours de l'hébergeur.
      c.connect('lettres');
      modify('/etc/ssh/sshd_config.d/00-hardening.conf', (t) => t.replace('AllowUsers kofi', L('AllowUsers vous')));
      play(['sudo systemctl reload ssh', 'exit', 'ssh lettres']);
      expect(c.finished).toContain('shut-the-door');
    });

    it('fausse piste : modifier le fichier sans recharger ne change rien', () => {
      const { c, jouer: play, modifier: modify } = part();
      play(['ssh lettres', 'yes']);
      modify('/etc/ssh/sshd_config.d/50-cloud-init.conf', () => 'PermitRootLogin no\nPasswordAuthentication no\n');
      play(['exit', 'ssh lettres']);
      expect(c.finished).not.toContain('shut-the-door');
    });
  });

// Les Lettres du quartier, « Le pare-feu » : ufw.
for (const language of LANGUAGES)
  describe(`Le pare-feu — ${language}`, () => {
    const fr = language === 'fr';
    // Le compte du joueur dans la langue (vous@poste, you@poste), comme les noms des lieux.
    const L = (line: string) => inLanguage(translator(language), line);
    const part = () => {
      const c = new Console({ language, finished: [...ERASER, 'shut-the-door'] });
      const play = (lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');
      play(['ssh lettres', 'yes']);
      expect(c.remote?.shell.chapter.id).toBe('firewall');
      return { c, jouer: play };
    };

    it('solution : ss, ufw, le piège de l’activation, la reconnexion', () => {
      const { c, jouer: play } = part();
      let all = play(['cat scan_yasmine.txt', 'ss -tln', 'ufw status', 'sudo ufw allow "Nginx Full"', 'fourmis-2026', 'sudo ufw enable', 'o']);
      expect(all).toContain('0.0.0.0:3306');
      if (fr) expect(all).toContain('ERREUR : Vous devez être root pour exécuter ce script');
      if (fr) expect(all).toContain('bloque SSH');
      all = play(['sudo ufw limit OpenSSH', 'sudo ufw status verbose', 'exit', 'ssh lettres']);
      expect(all).toContain('LIMIT IN');
      if (fr) expect(all).toContain('https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html');
      expect(c.finished).toContain('firewall');
    });

    it('une autre solution : reject par défaut, SSH depuis le poste seulement', () => {
      const { c, jouer: play } = part();
      play([
        'sudo ufw default reject incoming', 'fourmis-2026', 'sudo ufw allow from 192.0.2.2 to any port 22 proto tcp',
        'sudo ufw allow 80/tcp', 'sudo ufw allow https', 'sudo ufw enable', 'y', 'exit', 'ssh lettres',
      ]);
      expect(c.finished).toContain('firewall');
    });

    it('s’enfermer dehors : timeout, puis la console de secours', () => {
      const { c, jouer: play } = part();
      play(['sudo ufw allow http', 'fourmis-2026', 'sudo ufw allow https', 'sudo ufw enable', 'o']);
      const outside = play(['exit', 'ssh lettres']);
      expect(outside).toContain(machinesInLanguage(translator(language), 'ssh: connect to host lettres.internal port 22: Connection timed out'));
      expect(c.prompt()).toBe(L('vous@poste:~$'));
      c.connect('lettres');
      play(['sudo ufw allow OpenSSH', 'exit', 'ssh lettres']);
      expect(c.finished).toContain('firewall');
    });

    it('fausses pistes : laisser la base ouverte, couper le site, ne pas activer', () => {
      const { c, jouer: play } = part();
      const all = play(['sudo ufw allow OpenSSH', 'fourmis-2026', 'sudo ufw default allow', 'sudo ufw enable', 'o', 'sudo ufw default deny', 'exit', 'ssh lettres']);
      if (fr) expect(all).toContain('la base de données (3306) est toujours');
      if (fr) expect(all).toContain('le site des Lettres ne répond plus');
      expect(c.finished).not.toContain('firewall');
      play(['sudo ufw disable', 'sudo ufw allow "Nginx Full"', 'exit', 'ssh lettres']);
      expect(c.finished).not.toContain('firewall');
    });
  });

// Les Lettres du quartier, « La sentinelle » : fail2ban.
for (const language of LANGUAGES)
  describe(`La sentinelle — ${language}`, () => {
    const fr = language === 'fr';
    const part = () => {
      const c = new Console({ language, finished: [...ERASER, 'shut-the-door', 'firewall'] });
      const play = (lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');
      const write = (file: string, text: string) => {
        c.execute(`sudo nano ${file}`);
        if (c.shell.waiting) c.execute(machinesInLanguage(c.t, 'fourmis-2026'));
        c.save(text);
        return c.quitEdition();
      };
      play(['ssh lettres', 'yes']);
      expect(c.remote?.shell.chapter.id).toBe('sentinel');
      return { c, jouer: play, ecrire: write };
    };
    const GOOD = '[DEFAULT]\nbantime = 1h\nignoreip = 127.0.0.1/8 ::1 192.0.2.2 198.51.100.40\n';

    it('solution : lire le journal, débannir Rania, jail.local, recharger, vérifier', () => {
      const { c, jouer: play, ecrire: write } = part();
      let all = play(['cat /var/log/fail2ban.log', 'sudo fail2ban-client status sshd', 'fourmis-2026', 'sudo fail2ban-client set sshd unbanip 198.51.100.40']);
      expect(all).toContain('Ban 198.51.100.40');
      // Le second robot, relâché à 09:35, attaque encore : il n'est pas (encore) banni.
      expect(all).toContain('`- Banned IP list:\t203.0.113.66 198.51.100.40\n');
      all += write('/etc/fail2ban/jail.local', GOOD);
      all += play(['sudo fail2ban-client -t', 'sudo systemctl reload fail2ban', 'sudo fail2ban-client get sshd bantime']);
      expect(all).toContain('OK: configuration test is successful');
      expect(all).toContain('3600');
      expect(c.finished).not.toContain('sentinel');
      all += play(['sudo fail2ban-client status sshd']);
      if (fr) expect(all).toContain('https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html');
      expect(c.finished).toContain('sentinel');
    });

    it('une autre solution : jail.d/*.local, bantime -1, ignoreip en CIDR', () => {
      const { c, jouer: play, ecrire: write } = part();
      write('/etc/fail2ban/jail.d/lettres.local', '[sshd]\nbantime = -1\nignoreip = 192.0.2.0/24 198.51.100.40\n');
      play(['sudo fail2ban-client reload', 'sudo fail2ban-client set sshd unbanip 198.51.100.40', 'sudo fail2ban-client status sshd']);
      expect(c.finished).toContain('sentinel');
    });

    it('se bannir soi-même : Connection refused, puis la console de secours', () => {
      const { c, jouer: play, ecrire: write } = part();
      const alert = write('/etc/fail2ban/jail.local', '[DEFAULT]\nmaxretry = 3\n') + play(['sudo systemctl reload fail2ban']);
      if (fr) expect(alert).toContain("l'adresse de ton propre");
      const outside = play(['exit', 'ssh lettres']);
      expect(outside).toContain(machinesInLanguage(translator(language), 'ssh: connect to host lettres.internal port 22: Connection refused'));
      c.connect('lettres');
      write('/etc/fail2ban/jail.local', GOOD);
      play([
        'sudo fail2ban-client set sshd unbanip 192.0.2.2', 'sudo fail2ban-client reload',
        'sudo fail2ban-client set sshd unbanip 198.51.100.40', 'sudo fail2ban-client status sshd',
      ]);
      expect(c.finished).toContain('sentinel');
    });

    it('fausses pistes : syntaxe, ne pas recharger, oublier Rania, modifier jail.conf', () => {
      const { c, jouer: play, ecrire: write } = part();
      let all = write('/etc/fail2ban/jail.local', '[DEFAULT]\nbantime 1h\n') + play(['sudo fail2ban-client -t', 'sudo systemctl reload fail2ban']);
      expect(all).toContain("Source contains parsing errors: '/etc/fail2ban/jail.local'");
      expect(all).toContain('Job for fail2ban.service failed');
      write('/etc/fail2ban/jail.local', GOOD);
      play(['sudo fail2ban-client status sshd']);
      expect(c.finished).not.toContain('sentinel');
      play(['sudo fail2ban-client reload', 'sudo fail2ban-client status sshd']);
      expect(c.finished).not.toContain('sentinel');
      all = write('/etc/fail2ban/jail.conf', '[DEFAULT]\nbantime = 1h\n');
      if (fr) expect(all).toContain('YOU SHOULD NOT MODIFY THIS');
    });
  });

// Les Lettres du quartier, « Le port » : déplacer SSH sur 2222 sans s'enfermer dehors.
const LETTERS = ['shut-the-door', 'firewall', 'sentinel', 'sharing', 'works-for-me', 'concert'];

for (const language of LANGUAGES)
  describe(`Le port — ${language}`, () => {
    const fr = language === 'fr';
    const part = () => {
      const c = new Console({ language, finished: [...ERASER, ...LETTERS] });
      const play = (lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');
      const write = (file: string, change: (text: string) => string, sudo = true) => {
        c.execute(`${sudo ? 'sudo ' : ''}nano ${file}`);
        if (c.shell.waiting) c.execute(machinesInLanguage(c.t, 'fourmis-2026'));
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      play(['ssh lettres', 'yes']);
      expect(c.remote?.shell.chapter.id).toBe('port');
      return { c, jouer: play, ecrire: write };
    };
    const M = (x: string) => machinesInLanguage(translator(language), x);
    const workstationPort = (t: string) =>
      t.replace(M('Host lettres\n    HostName lettres.internal'), M('Host lettres\n    HostName lettres.internal\n    Port 2222'));

    it('solution : les deux ports, tester, fermer le 22, la prison sshd', () => {
      const { c, jouer: play, ecrire: write } = part();
      let all = play(['journalctl -u ssh -n 4', 'sudo ufw status', 'fourmis-2026', 'sudo nft list ruleset']);
      expect(all).toContain('Invalid user');
      expect(all).toContain('meta l4proto tcp tcp dport 22 counter packets 0 bytes 0 accept');
      expect(all).toContain('tcp dport { 22 } ip saddr @addr-set-sshd reject');
      all += write('/etc/ssh/sshd_config', (t) => t.replace('#Port 22', 'Port 22\nPort 2222'));
      all += play(['sudo sshd -t', 'sudo ufw allow 2222/tcp', 'sudo systemctl reload ssh', 'sudo ss -tlnp']);
      expect(all).toContain('0.0.0.0:2222');
      if (fr) expect(all).toContain('les deux ports');
      all += play(['exit']);
      all += write('~/.ssh/config', workstationPort, false);
      all += play(['ssh lettres']);
      expect(all).toContain(machinesInLanguage(translator(language), "The authenticity of host '[lettres.internal]:2222 ([203.0.113.10]:2222)' can't be established."));
      expect(all).toContain('This host key is known by the following other names/addresses:');
      all += play(['yes', 'ss -tn']);
      expect(all).toContain(M("Warning: Permanently added '[lettres.internal]:2222' (ED25519) to the list of known hosts."));
      expect(all).toContain('203.0.113.10:2222');
      all += write('/etc/ssh/sshd_config', (t) => t.replace('Port 22\n', ''));
      all += play(['sudo systemctl reload ssh', 'sudo ufw delete allow OpenSSH']);
      if (fr) expect(all).toContain('bannit toujours sur le port');
      expect(c.finished).not.toContain('port');
      all += write('/etc/fail2ban/jail.local', (t) => `${t}\n\n[sshd]\nport = 2222\n`);
      all += play(['sudo systemctl reload fail2ban']);
      if (fr) expect(all).toContain('https://man.openbsd.org/sshd_config#Port');
      expect(c.finished).toContain('port');
      expect(play(['sudo nft list ruleset'])).toContain('tcp dport { 2222 } ip saddr @addr-set-sshd');
      // Le 22 est bien fermé, vu du poste.
      expect(play(['exit', 'ssh -p 22 lettres'])).toContain('port 22: Connection refused');
    });

    it('fausses pistes : fermer le 22 trop tôt, port = 2222 dans [DEFAULT]', () => {
      const { c, jouer: play, ecrire: write } = part();
      let all = write('/etc/ssh/sshd_config', (t) => t.replace('#Port 22', 'Port 2222'));
      all += play(['sudo systemctl reload ssh', 'fourmis-2026']);
      if (fr) expect(all).toContain('ATTENTION');
      all = play(['exit', 'ssh lettres', 'ssh -p 2222 lettres']);
      expect(all).toContain(machinesInLanguage(translator(language), 'ssh: connect to host lettres.internal port 22: Connection refused'));
      if (fr) expect(all).toContain('écoute maintenant sur 2222');
      expect(all).toContain('port 2222: Connection timed out');
      // La console de secours : ouvrir 2222 dans ufw.
      c.connect('lettres');
      play(['sudo ufw allow 2222/tcp', 'fourmis-2026', 'sudo ufw delete allow OpenSSH']);
      all = write('/etc/fail2ban/jail.local', (t) => t.replace('[DEFAULT]', '[DEFAULT]\nport = 2222'));
      all += play(['sudo systemctl reload fail2ban']);
      if (fr) expect(all).toContain('quel que soit le fichier');
      play(['exit']);
      write('~/.ssh/config', workstationPort, false);
      play(['ssh lettres', 'yes']);
      expect(c.finished).not.toContain('port');
      write('/etc/fail2ban/jail.local', (t) => t.replace('port = 2222', '') + '\n[sshd]\nport = ssh,2222\n');
      play(['sudo fail2ban-client reload', 'fourmis-2026']);
      expect(c.finished).toContain('port');
    });

    it('nft ne fait que regarder sous ufw', () => {
      const { jouer: play } = part();
      const all = play(['nft list ruleset', 'sudo nft list tables', 'fourmis-2026', 'sudo nft add rule ip filter INPUT tcp dport 2222 accept']);
      expect(all).toContain('Operation not permitted');
      expect(all).toContain('table ip filter\ntable inet f2b-table');
      if (fr) expect(all).toContain('ufw et fail2ban qui écrivent');
    });
  });

// Les Lettres du quartier, « La récidive » : les prisons recidive et nginx-limit-req.
for (const language of LANGUAGES)
  describe(`La récidive — ${language}`, () => {
    const fr = language === 'fr';
    const part = () => {
      const c = new Console({ language, finished: [...ERASER, ...LETTERS, 'port'] });
      const play = (lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');
      const write = (file: string, change: (text: string) => string) => {
        c.execute(`sudo nano ${file}`);
        if (c.shell.waiting) c.execute(machinesInLanguage(c.t, 'fourmis-2026'));
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      // Le chapitre commence avec SSH sur le port 2222 (« Le port »).
      const input = play(['ssh lettres', 'ssh -p 2222 lettres', 'yes']);
      expect(input).toContain('port 22: Connection refused');
      expect(c.remote?.shell.chapter.id).toBe('repeat-offenders');
      return { c, jouer: play, ecrire: write };
    };
    const JAILS = '\n[recidive]\nenabled = true\n\n[nginx-limit-req]\nenabled = true\n';

    it('solution : lire les journaux, activer recidive et nginx-limit-req dans jail.local', () => {
      const { c, jouer: play, ecrire: write } = part();
      let all = play([
        'grep -c "Ban 203.0.113.66" /var/log/fail2ban.log',
        'grep -c "limiting requests" /var/log/nginx/error.log',
        'grep "^\\[" /etc/fail2ban/jail.conf',
      ]);
      expect(all).toContain('[recidive]');
      all += write('/etc/fail2ban/jail.local', (t) => t + '\n' + JAILS);
      all += play(['sudo fail2ban-client -t', 'sudo systemctl reload fail2ban', 'sudo fail2ban-client status']);
      expect(all).toContain('Jail list:\tnginx-limit-req, recidive, sshd');
      if (fr) expect(all).toContain('pour une semaine');
      expect(c.finished).not.toContain('repeat-offenders');
      all += play(['sudo fail2ban-client status recidive', 'sudo fail2ban-client status nginx-limit-req', 'sudo nft list table inet f2b-table']);
      expect(all).toContain('Banned IP list:\t203.0.113.66 198.51.100.23');
      expect(all).toContain('Banned IP list:\t198.51.100.24 198.51.100.25 198.51.100.26');
      expect(all).toContain('File list:\t/var/log/nginx/error.log');
      expect(all).toContain('meta l4proto { tcp } ip saddr @addr-set-recidive reject');
      expect(all).toContain('tcp dport { 80, 443 } ip saddr @addr-set-nginx-limit-req reject');
      expect(c.finished).toContain('repeat-offenders');
    });

    it('une autre solution : jail.d/*.local, et recidive bannie pour toujours', () => {
      const { c, jouer: play, ecrire: write } = part();
      write(
        '/etc/fail2ban/jail.d/prisons.local',
        () => '[recidive]\nenabled = true\nbantime = -1\n\n[nginx-limit-req]\nenabled = true\nmaxretry = 8\n',
      );
      play(['sudo fail2ban-client reload', 'sudo fail2ban-client status nginx-limit-req']);
      expect(c.finished).toContain('repeat-offenders');
    });

    it('fausses pistes : tout activer dans [DEFAULT], une recidive trop courte, oublier Rania', () => {
      const { c, jouer: play, ecrire: write } = part();
      let all = write('/etc/fail2ban/jail.local', (t) => t.replace('[DEFAULT]', '[DEFAULT]\nenabled = true'));
      all += play(['sudo fail2ban-client -t', 'sudo systemctl reload fail2ban']);
      expect(all).toContain('Have not found any log file for apache-auth jail');
      expect(all).toContain('Job for fail2ban.service failed');
      if (fr) expect(all).toContain('TOUTES les prisons');
      write('/etc/fail2ban/jail.local', (t) => t.replace('enabled = true\n', '') + '\n[recidive]\nenabled = true\nbantime = 1h\n');
      all = play(['sudo systemctl reload fail2ban']);
      if (fr) expect(all).toContain('pas plus longtemps');
      // Rania sortie d'ignoreip : la prison nginx la bannit.
      write(
        '/etc/fail2ban/jail.local',
        (t) =>
          t.replace('bantime = 1h\n', 'bantime = 1w\n').replace('ignoreip = 198.51.100.40 ', 'ignoreip = ') + '\n[nginx-limit-req]\nenabled = true\n',
      );
      all = play(['sudo systemctl reload fail2ban', 'sudo fail2ban-client status nginx-limit-req']);
      expect(all).toContain('198.51.100.40');
      expect(c.finished).not.toContain('repeat-offenders');
      write('/etc/fail2ban/jail.local', (t) => t.replace('ignoreip = ', 'ignoreip = 198.51.100.40 '));
      play(['sudo fail2ban-client unban 198.51.100.40', 'sudo systemctl reload fail2ban', 'sudo fail2ban-client status']);
      expect(c.finished).toContain('repeat-offenders');
    });
  });
