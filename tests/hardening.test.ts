// The Neighbourhood Letters, "Closing the door": hardening SSH. Replayed with
// the console (the end requires reconnecting), in every language.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';

// The Eraser, then the chapters to finish to receive the story's key.
const ERASER = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('letters')])];
const CONFIG = '/etc/ssh/sshd_config';

for (const language of LANGUAGES)
  describe(`Language: ${language}`, () => {
    const fr = language === 'fr';
    // The player's account in the language (vous@poste, you@poste), like the places' names.
    const L = (line: string) => inLanguage(translator(language), line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const part = () => {
      const c = new Console({ language, finished: ERASER });
      const play = (lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');
      // nano: replace text in a file, then ^O and ^X.
      const modify = (file: string, change: (text: string) => string) => {
        c.execute(`sudo nano ${file}`);
        if (c.shell.waiting) c.execute(machinesInLanguage(c.t, 'ants-2026'));
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      return { c, play, modify };
    };

    it('solution: typo, the Include trap, reconnecting', () => {
      const { c, play, modify } = part();
      let all = play(['ssh letters', 'yes', 'journalctl -u ssh', 'sshd -t']);
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
      all += play(['sudo systemctl reload ssh', 'journalctl -u ssh -n 3', 'exit', 'ssh root@letters']);
      expect(all).toContain('[preauth]');
      expect(all).toContain(machinesInLanguage(translator(language), 'root@letters.internal: Permission denied (publickey).'));
      expect(c.finished).not.toContain('shut-the-door');
      all += play(['ssh letters']);
      contains(all, 'https://man.openbsd.org/sshd_config');
      expect(c.finished).toContain('shut-the-door');
    });

    it('another solution: a 00-… file in sshd_config.d, read first', () => {
      const { c, play, modify } = part();
      play(['ssh letters', 'yes']);
      c.execute('sudo nano /etc/ssh/sshd_config.d/00-hardening.conf');
      c.execute(machinesInLanguage(c.t, 'ants-2026'));
      c.save('PermitRootLogin no\nPasswordAuthentication no\n');
      c.quitEdition();
      play(['sudo systemctl restart ssh', 'exit', 'ssh letters']);
      expect(c.finished).toContain('shut-the-door');
    });

    it('locking yourself out, then the rescue console (the menu)', () => {
      const { c, play, modify } = part();
      play(['ssh letters', 'yes']);
      const alert = modify('/etc/ssh/sshd_config.d/00-hardening.conf', () => 'PermitRootLogin no\nPasswordAuthentication no\nAllowUsers kofi\n');
      const reload = play(['sudo systemctl reload ssh']);
      contains(alert + reload, 'une nouvelle connexion de ton compte serait refusée');
      const outside = play(['exit', 'ssh letters']);
      expect(outside).toContain(L('you@letters.internal: Permission denied (publickey).'));
      contains(outside, 'tu t’es enfermé·e dehors'.replace('’', "'"));
      expect(c.prompt()).toBe(L('you@desk:~$'));
      // The menu: like the hosting provider's rescue console.
      c.connect('letters');
      modify('/etc/ssh/sshd_config.d/00-hardening.conf', (t) => t.replace('AllowUsers kofi', L('AllowUsers you')));
      play(['sudo systemctl reload ssh', 'exit', 'ssh letters']);
      expect(c.finished).toContain('shut-the-door');
    });

    it('false lead: editing the file without reloading changes nothing', () => {
      const { c, play, modify } = part();
      play(['ssh letters', 'yes']);
      modify('/etc/ssh/sshd_config.d/50-cloud-init.conf', () => 'PermitRootLogin no\nPasswordAuthentication no\n');
      play(['exit', 'ssh letters']);
      expect(c.finished).not.toContain('shut-the-door');
    });
  });

// The Neighbourhood Letters, "The firewall": ufw.
for (const language of LANGUAGES)
  describe(`The firewall — ${language}`, () => {
    const fr = language === 'fr';
    // The player's account in the language (vous@poste, you@poste), like the places' names.
    const L = (line: string) => inLanguage(translator(language), line);
    const part = () => {
      const c = new Console({ language, finished: [...ERASER, 'shut-the-door'] });
      const play = (lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');
      play(['ssh letters', 'yes']);
      expect(c.remote?.shell.chapter.id).toBe('firewall');
      return { c, play };
    };

    it('solution: ss, ufw, the enabling trap, reconnecting', () => {
      const { c, play } = part();
      let all = play(['cat scan_yasmine.txt', 'ss -tln', 'ufw status', 'sudo ufw allow "Nginx Full"', 'ants-2026', 'sudo ufw enable', 'o']);
      expect(all).toContain('0.0.0.0:3306');
      if (fr) expect(all).toContain('ERREUR : Vous devez être root pour exécuter ce script');
      if (fr) expect(all).toContain('bloque SSH');
      all = play(['sudo ufw limit OpenSSH', 'sudo ufw status verbose', 'exit', 'ssh letters']);
      expect(all).toContain('LIMIT IN');
      if (fr) expect(all).toContain('https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html');
      expect(c.finished).toContain('firewall');
    });

    it('another solution: reject by default, SSH from the workstation only', () => {
      const { c, play } = part();
      play([
        'sudo ufw default reject incoming', 'ants-2026', 'sudo ufw allow from 192.0.2.2 to any port 22 proto tcp',
        'sudo ufw allow 80/tcp', 'sudo ufw allow https', 'sudo ufw enable', 'y', 'exit', 'ssh letters',
      ]);
      expect(c.finished).toContain('firewall');
    });

    it('locking yourself out: timeout, then the rescue console', () => {
      const { c, play } = part();
      play(['sudo ufw allow http', 'ants-2026', 'sudo ufw allow https', 'sudo ufw enable', 'o']);
      const outside = play(['exit', 'ssh letters']);
      expect(outside).toContain(machinesInLanguage(translator(language), 'ssh: connect to host letters.internal port 22: Connection timed out'));
      expect(c.prompt()).toBe(L('you@desk:~$'));
      c.connect('letters');
      play(['sudo ufw allow OpenSSH', 'exit', 'ssh letters']);
      expect(c.finished).toContain('firewall');
    });

    it('false leads: leaving the database open, cutting the site, not enabling', () => {
      const { c, play } = part();
      const all = play(['sudo ufw allow OpenSSH', 'ants-2026', 'sudo ufw default allow', 'sudo ufw enable', 'o', 'sudo ufw default deny', 'exit', 'ssh letters']);
      if (fr) expect(all).toContain('la base de données (3306) est toujours');
      if (fr) expect(all).toContain('le site des Lettres ne répond plus');
      expect(c.finished).not.toContain('firewall');
      play(['sudo ufw disable', 'sudo ufw allow "Nginx Full"', 'exit', 'ssh letters']);
      expect(c.finished).not.toContain('firewall');
    });
  });

// The Neighbourhood Letters, "The sentinel": fail2ban.
for (const language of LANGUAGES)
  describe(`The sentinel — ${language}`, () => {
    const fr = language === 'fr';
    const part = () => {
      const c = new Console({ language, finished: [...ERASER, 'shut-the-door', 'firewall'] });
      const play = (lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');
      const write = (file: string, text: string) => {
        c.execute(`sudo nano ${file}`);
        if (c.shell.waiting) c.execute(machinesInLanguage(c.t, 'ants-2026'));
        c.save(text);
        return c.quitEdition();
      };
      play(['ssh letters', 'yes']);
      expect(c.remote?.shell.chapter.id).toBe('sentinel');
      return { c, play, write };
    };
    const GOOD = '[DEFAULT]\nbantime = 1h\nignoreip = 127.0.0.1/8 ::1 192.0.2.2 198.51.100.40\n';

    it('solution: read the log, unban Rania, jail.local, reload, check', () => {
      const { c, play, write } = part();
      let all = play(['cat /var/log/fail2ban.log', 'sudo fail2ban-client status sshd', 'ants-2026', 'sudo fail2ban-client set sshd unbanip 198.51.100.40']);
      expect(all).toContain('Ban 198.51.100.40');
      // The second robot, released at 09:35, still attacks: it is not banned (yet).
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

    it('another solution: jail.d/*.local, bantime -1, ignoreip in CIDR', () => {
      const { c, play, write } = part();
      write('/etc/fail2ban/jail.d/letters.local', '[sshd]\nbantime = -1\nignoreip = 192.0.2.0/24 198.51.100.40\n');
      play(['sudo fail2ban-client reload', 'sudo fail2ban-client set sshd unbanip 198.51.100.40', 'sudo fail2ban-client status sshd']);
      expect(c.finished).toContain('sentinel');
    });

    it('banning yourself: Connection refused, then the rescue console', () => {
      const { c, play, write } = part();
      const alert = write('/etc/fail2ban/jail.local', '[DEFAULT]\nmaxretry = 3\n') + play(['sudo systemctl reload fail2ban']);
      if (fr) expect(alert).toContain("l'adresse de ton propre");
      const outside = play(['exit', 'ssh letters']);
      expect(outside).toContain(machinesInLanguage(translator(language), 'ssh: connect to host letters.internal port 22: Connection refused'));
      c.connect('letters');
      write('/etc/fail2ban/jail.local', GOOD);
      play([
        'sudo fail2ban-client set sshd unbanip 192.0.2.2', 'sudo fail2ban-client reload',
        'sudo fail2ban-client set sshd unbanip 198.51.100.40', 'sudo fail2ban-client status sshd',
      ]);
      expect(c.finished).toContain('sentinel');
    });

    it('false leads: syntax, not reloading, forgetting Rania, editing jail.conf', () => {
      const { c, play, write } = part();
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

// The Neighbourhood Letters, "The port": moving SSH to 2222 without locking yourself out.
const LETTERS = ['shut-the-door', 'firewall', 'sentinel', 'sharing', 'works-for-me', 'concert'];

for (const language of LANGUAGES)
  describe(`The port — ${language}`, () => {
    const fr = language === 'fr';
    const part = () => {
      const c = new Console({ language, finished: [...ERASER, ...LETTERS] });
      const play = (lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');
      const write = (file: string, change: (text: string) => string, sudo = true) => {
        c.execute(`${sudo ? 'sudo ' : ''}nano ${file}`);
        if (c.shell.waiting) c.execute(machinesInLanguage(c.t, 'ants-2026'));
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      play(['ssh letters', 'yes']);
      expect(c.remote?.shell.chapter.id).toBe('port');
      return { c, play, write };
    };
    const M = (x: string) => machinesInLanguage(translator(language), x);
    const workstationPort = (t: string) =>
      t.replace(M('Host letters\n    HostName letters.internal'), M('Host letters\n    HostName letters.internal\n    Port 2222'));

    it('solution: both ports, test, close 22, the sshd jail', () => {
      const { c, play, write } = part();
      let all = play(['journalctl -u ssh -n 4', 'sudo ufw status', 'ants-2026', 'sudo nft list ruleset']);
      expect(all).toContain('Invalid user');
      expect(all).toContain('meta l4proto tcp tcp dport 22 counter packets 0 bytes 0 accept');
      expect(all).toContain('tcp dport { 22 } ip saddr @addr-set-sshd reject');
      all += write('/etc/ssh/sshd_config', (t) => t.replace('#Port 22', 'Port 22\nPort 2222'));
      all += play(['sudo sshd -t', 'sudo ufw allow 2222/tcp', 'sudo systemctl reload ssh', 'sudo ss -tlnp']);
      expect(all).toContain('0.0.0.0:2222');
      if (fr) expect(all).toContain('les deux ports');
      all += play(['exit']);
      all += write('~/.ssh/config', workstationPort, false);
      all += play(['ssh letters']);
      expect(all).toContain(machinesInLanguage(translator(language), "The authenticity of host '[letters.internal]:2222 ([203.0.113.10]:2222)' can't be established."));
      expect(all).toContain('This host key is known by the following other names/addresses:');
      all += play(['yes', 'ss -tn']);
      expect(all).toContain(M("Warning: Permanently added '[letters.internal]:2222' (ED25519) to the list of known hosts."));
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
      // Port 22 is indeed closed, seen from the workstation.
      expect(play(['exit', 'ssh -p 22 letters'])).toContain('port 22: Connection refused');
    });

    it('false leads: closing 22 too early, port = 2222 in [DEFAULT]', () => {
      const { c, play, write } = part();
      let all = write('/etc/ssh/sshd_config', (t) => t.replace('#Port 22', 'Port 2222'));
      all += play(['sudo systemctl reload ssh', 'ants-2026']);
      if (fr) expect(all).toContain('ATTENTION');
      all = play(['exit', 'ssh letters', 'ssh -p 2222 letters']);
      expect(all).toContain(machinesInLanguage(translator(language), 'ssh: connect to host letters.internal port 22: Connection refused'));
      if (fr) expect(all).toContain('écoute maintenant sur 2222');
      expect(all).toContain('port 2222: Connection timed out');
      // The rescue console: open 2222 in ufw.
      c.connect('letters');
      play(['sudo ufw allow 2222/tcp', 'ants-2026', 'sudo ufw delete allow OpenSSH']);
      all = write('/etc/fail2ban/jail.local', (t) => t.replace('[DEFAULT]', '[DEFAULT]\nport = 2222'));
      all += play(['sudo systemctl reload fail2ban']);
      if (fr) expect(all).toContain('quel que soit le fichier');
      play(['exit']);
      write('~/.ssh/config', workstationPort, false);
      play(['ssh letters', 'yes']);
      expect(c.finished).not.toContain('port');
      write('/etc/fail2ban/jail.local', (t) => t.replace('port = 2222', '') + '\n[sshd]\nport = ssh,2222\n');
      play(['sudo fail2ban-client reload', 'ants-2026']);
      expect(c.finished).toContain('port');
    });

    it('nft only looks under ufw', () => {
      const { play } = part();
      const all = play(['nft list ruleset', 'sudo nft list tables', 'ants-2026', 'sudo nft add rule ip filter INPUT tcp dport 2222 accept']);
      expect(all).toContain('Operation not permitted');
      expect(all).toContain('table ip filter\ntable inet f2b-table');
      if (fr) expect(all).toContain('ufw et fail2ban qui écrivent');
    });
  });

// The Neighbourhood Letters, "Repeat offenders": the recidive and nginx-limit-req jails.
for (const language of LANGUAGES)
  describe(`Repeat offenders — ${language}`, () => {
    const fr = language === 'fr';
    const part = () => {
      const c = new Console({ language, finished: [...ERASER, ...LETTERS, 'port'] });
      const play = (lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');
      const write = (file: string, change: (text: string) => string) => {
        c.execute(`sudo nano ${file}`);
        if (c.shell.waiting) c.execute(machinesInLanguage(c.t, 'ants-2026'));
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      // The chapter starts with SSH on port 2222 ("The port").
      const input = play(['ssh letters', 'ssh -p 2222 letters', 'yes']);
      expect(input).toContain('port 22: Connection refused');
      expect(c.remote?.shell.chapter.id).toBe('repeat-offenders');
      return { c, play, write };
    };
    const JAILS = '\n[recidive]\nenabled = true\n\n[nginx-limit-req]\nenabled = true\n';

    it('solution: read the logs, enable recidive and nginx-limit-req in jail.local', () => {
      const { c, play, write } = part();
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

    it('another solution: jail.d/*.local, and recidive banned forever', () => {
      const { c, play, write } = part();
      write(
        '/etc/fail2ban/jail.d/prisons.local',
        () => '[recidive]\nenabled = true\nbantime = -1\n\n[nginx-limit-req]\nenabled = true\nmaxretry = 8\n',
      );
      play(['sudo fail2ban-client reload', 'sudo fail2ban-client status nginx-limit-req']);
      expect(c.finished).toContain('repeat-offenders');
    });

    it('false leads: enabling everything in [DEFAULT], a recidive too short, forgetting Rania', () => {
      const { c, play, write } = part();
      let all = write('/etc/fail2ban/jail.local', (t) => t.replace('[DEFAULT]', '[DEFAULT]\nenabled = true'));
      all += play(['sudo fail2ban-client -t', 'sudo systemctl reload fail2ban']);
      expect(all).toContain('Have not found any log file for apache-auth jail');
      expect(all).toContain('Job for fail2ban.service failed');
      if (fr) expect(all).toContain('TOUTES les prisons');
      write('/etc/fail2ban/jail.local', (t) => t.replace('enabled = true\n', '') + '\n[recidive]\nenabled = true\nbantime = 1h\n');
      all = play(['sudo systemctl reload fail2ban']);
      if (fr) expect(all).toContain('pas plus longtemps');
      // Rania taken out of ignoreip: the nginx jail bans her.
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
