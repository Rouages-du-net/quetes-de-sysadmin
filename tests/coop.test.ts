// La Coopérative : le départ d'un bénévole, les droits partagés, sudo.
// Rejoué avec la console, dans chaque langue.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';

// L'Effaceur, puis les chapitres à finir pour recevoir la clé de l'histoire.
const ERASER = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('coop')])];
const MDP = 'radish-2027';

for (const language of LANGUAGES)
  describe(`La Coopérative — ${language}`, () => {
    const fr = language === 'fr';
    // Le compte du joueur dans la langue (vous@poste, you@poste), comme les noms des lieux.
    const L = (line: string) => inLanguage(translator(language), line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...ERASER, ...finished] });
      // Une ligne (écrite avec les noms français), avec le mot de passe de sudo s'il est demandé.
      const one = (l: string) => {
        let output = c.execute(L(l)) ?? '';
        if (c.shell.waiting) output += '\n' + (c.execute(machinesInLanguage(c.t, MDP)) ?? '');
        return output;
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        one(command);
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      play(['ssh coop', 'yes']);
      return { c, jouer: play, editer: edit };
    };

    it('chapitre 1 — solution : expirer, retirer la clé de deploy, sudo, session, puis la sauvegarde', () => {
      const { c, jouer: play, editer: edit } = part();
      let all = play(['who', 'ps -u marc', 'sudo crontab -l -u marc', 'sudo cat /home/deploy/.ssh/authorized_keys']);
      expect(all).toContain('marc     pts/1');
      expect(all).toContain(L('30 2 * * * /home/marc/bin/till-backup.sh'));
      expect(all).toContain('marc@portable');
      all = play(['sudo usermod -L marc']);
      contains(all, 'usermod -L n');
      all = play(['sudo usermod -e 1 marc', 'sudo chage -l marc', 'sudo gpasswd -d marc sudo']);
      expect(all).toContain('1970-01-02');
      contains(all, 'Retrait de l');
      edit('sudo nano /home/deploy/.ssh/authorized_keys', (t) =>
        t
          .split('\n')
          .filter((l) => !l.includes('marc@portable'))
          .join('\n'),
      );
      all = play(['sudo pkill -u marc', 'who']);
      expect(all).not.toContain('marc     pts/1');
      contains(all, 'Marc ne peut plus entrer');
      expect(c.finished).not.toContain('departure');
      play(['sudo cp /home/marc/bin/till-backup.sh /usr/local/bin/']);
      all = edit('sudo crontab -e', (t) => t + L('30 2 * * * /usr/local/bin/till-backup.sh\n'));
      contains(all, 'https://man7.org/linux/man-pages/man8/usermod.8.html');
      expect(c.finished).toContain('departure');
    });

    it('chapitre 1 — autre solution : /etc/cron.d, puis userdel -r', () => {
      const { c, jouer: play, editer: edit } = part();
      play(['sudo mkdir -p /opt/coop', 'sudo cp /home/marc/bin/till-backup.sh /opt/coop/']);
      edit('sudo nano /etc/cron.d/sauvegarde-till', () => L('30 2 * * * root /opt/coop/till-backup.sh\n'));
      edit('sudo nano /home/deploy/.ssh/authorized_keys', (t) =>
        t
          .split('\n')
          .filter((l) => !l.includes('marc@portable'))
          .join('\n'),
      );
      let all = play(['sudo userdel -r marc']);
      contains(all, 'actuellement utilisé par le processus 2741');
      all = play(['sudo kill 2741 2745 2790', 'sudo userdel -r marc', 'id marc']);
      expect(c.finished).toContain('departure');
    });

    it('chapitre 1 — fausses pistes : vider deploy, la tâche dans sa propre crontab, userdel -r trop tôt', () => {
      const { c, jouer: play, editer: edit } = part();
      let all = edit('sudo nano /home/deploy/.ssh/authorized_keys', () => '');
      contains(all, 'La CI et Lina ne pourront plus');
      play(['sudo pkill -u marc']);
      all = play(['sudo userdel -r marc']);
      contains(all, 'Le dossier de Marc a disparu');
      play(['sudo cp /srv/backups/2027-10-18/home/marc/bin/till-backup.sh /home/you/']);
      all = edit('crontab -e', (t) => t + L('30 2 * * * /home/you/till-backup.sh\n'));
      contains(all, 'TA crontab');
      expect(c.finished).not.toContain('departure');
      play(['sudo cp /home/you/till-backup.sh /usr/local/bin/']);
      edit('sudo crontab -e', (t) => t + L('30 2 * * * /usr/local/bin/till-backup.sh\n'));
      // deploy est toujours vide : la CI et Lina sont bloquées.
      expect(c.finished).not.toContain('departure');
    });

    const DEPARTURE = ['departure'];
    const RULE = '%till ALL=(root) /usr/bin/systemctl restart till\n';
    const shareDirectory = (play: (l: string[]) => string) =>
      play(['sudo chgrp -R till /srv/till/statements', 'sudo chmod -R g+w /srv/till/statements', 'sudo chmod g+s /srv/till/statements']);

    it('chapitre 2 — solution : setgid, umask dans ~/.profile, visudo (avec une erreur corrigée)', () => {
      const { c, jouer: play, editer: edit } = part(DEPARTURE);
      let all = play(['ls -l /srv/till/statements', 'groups lina karim']);
      expect(all).toContain('-rw-r--r-- lina     lina');
      all = shareDirectory(play) + play(['ls -ld /srv/till/statements']);
      expect(all).toContain('drwxrwsr-x root     till');
      for (const who of ['lina', 'karim']) edit(`sudo nano /home/${who}/.profile`, (t) => t.replace('#umask 022', 'umask 002'));
      all = play(['which systemctl', 'sudo visudo -f /etc/sudoers.d/till']);
      expect(all).toContain('/usr/bin/systemctl');
      c.save('%till ALL=(root) systemctl restart till\n');
      all = c.quitEdition();
      contains(all, 'nom de chemin totalement défini attendu');
      expect(c.finished).not.toContain('shared-rights');
      play(['e']);
      c.save(RULE);
      all = c.quitEdition() + play(['sudo -l -U lina']);
      expect(all).toContain('(root) /usr/bin/systemctl restart till');
      contains(all, 'https://www.sudo.ws/docs/man/sudoers.man/');
      expect(c.finished).toContain('shared-rights');
    });

    it('chapitre 2 — autre solution : chmod 2775, /etc/profile.d, un alias de commande', () => {
      const { c, jouer: play, editer: edit } = part(DEPARTURE);
      play(['sudo chgrp -R till /srv/till/statements', 'sudo chmod 2775 /srv/till/statements']);
      play(['sudo chmod g+w /srv/till/statements/2027-10-17.txt /srv/till/statements/2027-10-18.txt']);
      edit('sudo nano /etc/profile.d/umask-equipe.sh', () => 'umask 002\n');
      edit(
        'sudo visudo -f /etc/sudoers.d/till',
        () => 'Cmnd_Alias RELANCER_CAISSE = /usr/bin/systemctl restart till\n%till ALL=(root) RELANCER_CAISSE\n',
      );
      expect(c.finished).toContain('shared-rights');
    });

    it('chapitre 2 — fausses pistes : un nom avec un point, trop large, systemctl entier, nano qui casse sudo', () => {
      const { c, jouer: play, editer: edit } = part(DEPARTURE);
      shareDirectory(play);
      for (const who of ['lina', 'karim']) edit(`sudo nano /home/${who}/.profile`, (t) => t + '\numask 002\n');
      let all = edit('sudo visudo -f /etc/sudoers.d/till.conf', () => RULE);
      contains(all, 'que sudo ne lit pas');
      all = edit('sudo visudo -f /etc/sudoers.d/till', () => '%till ALL=(ALL:ALL) ALL\n');
      contains(all, 'sudo bash');
      all = edit('sudo visudo -f /etc/sudoers.d/till', () => '%till ALL=(root) /usr/bin/systemctl\n');
      contains(all, 'arrêter ssh');
      expect(c.finished).not.toContain('shared-rights');
      // nano au lieu de visudo : une faute, et sudo refuse tout.
      all = edit('sudo nano /etc/sudoers.d/till', () => '%till ALL=(root) systemctl restart till\n');
      contains(all, 'sudo est cassé');
      all = play(['sudo ls']);
      if (fr) expect(all).toContain("sudo: aucune source sudoers valide n'a été trouvée");
      expect(c.finished).not.toContain('shared-rights');
    });

    const SITE = '/etc/nginx/sites-available/coop';
    const BEFORE_SECRET = ['departure', 'shared-rights'];
    const newKey = (t: string) => t.replace(/PAIEMENT_CLE=.*/, 'PAIEMENT_CLE=pk_live_coop_9d27be05c4a1');

    it('chapitre 3 — solution : le journal, location ~ /\\., deny, la nouvelle clé', () => {
      const { c, jouer: play, editer: edit } = part(BEFORE_SECRET);
      let all = play(['curl http://coop.example/.env', "sudo grep '\\.env' /var/log/nginx/access.log"]);
      expect(all).toContain('PAIEMENT_CLE=pk_live_coop_4f9a2c71e8b3');
      expect(all).toContain('203.0.113.77 - - [19/Oct/2027:03:12:40 +0200] "GET /.env HTTP/1.1" 200');
      edit(`sudo nano ${SITE}`, (t) =>
        t.replace('    location /till/', '    deny 203.0.113.77;\n\n    location ~ /\\. {\n        deny all;\n    }\n\n    location /till/'),
      );
      all = play(['sudo nginx -t', 'sudo systemctl reload nginx', 'curl -I http://coop.example/.git/config']);
      expect(all).toContain('HTTP/1.1 403 Forbidden');
      contains(all, 'Les fichiers cachés ne sortent plus');
      all = edit('sudo nano /srv/till/app/.env', newKey);
      contains(all, "l'appli ne lit son .env qu'au démarrage");
      expect(c.finished).not.toContain('secret');
      all = play(['sudo systemctl restart till', 'curl http://127.0.0.1:3000/health']);
      expect(all).toContain('"paiement":"ok"');
      contains(all, 'https://nginx.org/en/docs/http/ngx_http_core_module.html#location');
      expect(c.finished).toContain('secret');
    });

    it('chapitre 3 — autre solution : des droits que www-data ne peut pas lire', () => {
      const { c, jouer: play, editer: edit } = part(BEFORE_SECRET);
      play(['sudo chmod 600 /srv/till/app/.env', 'sudo chmod -R o-rwx /srv/till/app/.git']);
      edit(`sudo nano ${SITE}`, (t) => t.replace('    index index.html;', '    index index.html;\n    deny 203.0.113.77;'));
      edit('sudo nano /srv/till/app/.env', newKey);
      play(['sudo systemctl reload nginx', 'sudo systemctl restart till']);
      expect(c.finished).toContain('secret');
    });

    it('chapitre 3 — fausses pistes : seulement /.env, deny all pour tout le site', () => {
      const { c, jouer: play, editer: edit } = part(BEFORE_SECRET);
      edit(`sudo nano ${SITE}`, (t) =>
        t.replace('    location /till/', '    location = /.env {\n        return 404;\n    }\n\n    location /till/'),
      );
      let all = play(['sudo systemctl reload nginx']);
      contains(all, '/.git/config, si');
      edit(`sudo nano ${SITE}`, (t) => t.replace('    index index.html;', '    index index.html;\n    deny all;'));
      all = play(['sudo systemctl reload nginx']);
      contains(all, 'ne répond plus normalement');
      expect(c.finished).not.toContain('secret');
    });

    const BEFORE_PROXY = ['departure', 'shared-rights', 'secret'];
    const withHeader = (header: string) => (t: string) =>
      t.replace('proxy_pass http://127.0.0.1:3000/;', `proxy_pass http://127.0.0.1:3000/;\n        proxy_set_header ${header};`);
    const trust = (value: string) => (t: string) => t.replace(/TRUST_PROXY=.*/, `TRUST_PROXY=${value}`);

    it('chapitre 4 — solution : X-Forwarded-For dans nginx, TRUST_PROXY=loopback', () => {
      const { c, jouer: play, editer: edit } = part(BEFORE_PROXY);
      let all = play(['sudo tail -3 /var/log/till/app.log', "sudo grep 'POST /till' /var/log/nginx/access.log"]);
      expect(all).toContain('locked 127.0.0.1 for 15 minutes');
      expect(all).toContain('198.51.100.66');
      all = play(['sudo systemctl restart till']);
      contains(all, 'Lina avec');
      edit(`sudo nano ${SITE}`, withHeader('X-Forwarded-For $proxy_add_x_forwarded_for'));
      edit('sudo nano /srv/till/app/.env', trust('loopback'));
      all = play(['sudo nginx -t', 'sudo systemctl reload nginx', 'sudo systemctl restart till', 'sudo tail -2 /var/log/till/app.log']);
      expect(all).toContain('login ok for lina from 192.0.2.44');
      contains(all, 'https://expressjs.com/en/guide/behind-proxies.html');
      expect(c.finished).toContain('proxy');
    });

    it('chapitre 4 — autre solution : $remote_addr, et la seule adresse de nginx', () => {
      const { c, jouer: play, editer: edit } = part(BEFORE_PROXY);
      edit(`sudo nano ${SITE}`, withHeader('X-Forwarded-For $remote_addr'));
      edit('sudo nano /srv/till/app/.env', trust('127.0.0.1'));
      play(['sudo systemctl reload nginx', 'sudo systemctl restart till']);
      expect(c.finished).toContain('proxy');
    });

    it('chapitre 4 — fausses pistes : TRUST_PROXY=true, ou l’en-tête du client transmis tel quel', () => {
      const { c, jouer: play, editer: edit } = part(BEFORE_PROXY);
      edit(`sudo nano ${SITE}`, withHeader('X-Forwarded-For $proxy_add_x_forwarded_for'));
      edit('sudo nano /srv/till/app/.env', trust('true'));
      let all = play(['sudo systemctl reload nginx', 'sudo systemctl restart till', 'sudo tail -2 /var/log/till/app.log']);
      expect(all).toContain('login failed for admin from 10.');
      contains(all, 'le robot (198.51.100.66) n');
      expect(c.finished).not.toContain('proxy');
      // loopback, mais nginx ne fait que transmettre ce que le client a écrit.
      edit(`sudo nano ${SITE}`, (t) => t.replace('$proxy_add_x_forwarded_for', '$http_x_forwarded_for'));
      edit('sudo nano /srv/till/app/.env', trust('loopback'));
      all = play(['sudo systemctl reload nginx', 'sudo systemctl restart till', 'sudo tail -2 /var/log/till/app.log']);
      expect(all).toContain('login failed for admin from 10.');
      expect(c.finished).not.toContain('proxy');
    });

    const BEFORE_UPDATE = ['departure', 'shared-rights', 'secret', 'proxy'];

    it('chapitre 5 — solution : apt update, upgrade dans tmux, la coupure, attach, reboot, enable', () => {
      const { c, jouer: play } = part(BEFORE_UPDATE);
      let all = play(['uname -r', 'sudo apt upgrade']);
      expect(all).toContain('6.12.38+deb13-amd64');
      expect(all).toContain('Upgrading: 0, Installing: 0');
      all = play(['sudo apt update', 'apt list --upgradable']);
      expect(all).toContain("5 packages can be upgraded. Run 'apt list --upgradable' to see them.");
      expect(all).toContain('linux-image-amd64/trixie-security 6.12.48-1 amd64 [upgradable from: 6.12.38-1]');
      play(['tmux new -s maj']);
      expect(c.prompt()).toBe(L('[maj] you@coop:~$'));
      all = play(['sudo apt upgrade', 'y']);
      expect(all).toContain('client_loop: send disconnect: Broken pipe');
      expect(c.prompt()).toBe(L('you@desk:~$'));
      all = play(['ssh coop', 'tmux ls', 'tmux attach -t maj']);
      contains(all, 'la mise à jour tournait dans tmux');
      expect(all).toContain('maj: 1 windows');
      expect(all).toContain('Setting up linux-image-amd64 (6.12.48-1) ...');
      all = play(['cat /var/run/reboot-required.pkgs', 'tmux detach', 'sudo reboot']);
      expect(all).toContain('linux-image-6.12.48+deb13-amd64');
      expect(all).toContain('[detached (from session maj)]');
      contains(all, 'la caisse ne répond plus');
      all = play(['ssh coop', 'uname -r', 'systemctl --failed', 'sudo systemctl enable --now till']);
      expect(all).toContain(machinesInLanguage(translator(language), 'Linux coop 6.12.48+deb13-amd64'));
      contains(all, 'https://man.openbsd.org/tmux');
      expect(c.finished).toContain('updates');
    });

    it('chapitre 5 — autre solution : sans tmux, dpkg --configure -a, et la caisse activée avant de redémarrer', () => {
      const { c, jouer: play } = part(BEFORE_UPDATE);
      let all = play(['sudo apt update', 'sudo apt upgrade -y']);
      expect(all).toContain('client_loop: send disconnect: Broken pipe');
      all = play(['ssh coop', 'sudo apt upgrade -y', 'sudo apt install curl']);
      contains(all, 'dpkg --configure -a');
      expect(all).toContain("Error: dpkg was interrupted, you must manually run 'dpkg --configure -a' to correct the problem.");
      all = play(['sudo dpkg --configure -a', 'sudo apt upgrade']);
      expect(all).toContain('Setting up libc6 (2.41-12+deb13u1) ...');
      expect(all).toContain('Upgrading: 0, Installing: 0');
      play(['sudo systemctl enable till', 'sudo systemctl reboot', 'ssh coop']);
      expect(c.finished).toContain('updates');
    });

    it('chapitre 5 — fausses pistes : pas de redémarrage, tmux imbriqué, une session inconnue', () => {
      const { c, jouer: play } = part(BEFORE_UPDATE);
      let all = play(['tmux attach', 'tmux new -s maj', 'tmux new -s autre', 'tmux attach -t inconnue']);
      expect(all).toContain('no server running on /tmp/tmux-1000/default');
      expect(all).toContain('sessions should be nested with care, unset $TMUX to force');
      all = play(['exit']);
      expect(all).toContain('[exited]');
      expect(c.prompt()).toBe(L('you@coop:~$'));
      play(['tmux new -s maj', 'sudo apt update', 'sudo apt upgrade -y', 'ssh coop', 'sudo systemctl enable till']);
      all = play(['uname -r']);
      expect(all).toContain('6.12.38+deb13-amd64');
      expect(c.finished).not.toContain('updates');
    });

    // Chapitre 6 : les mises à jour automatiques.
    const BEFORE_AUTO = ['departure', 'shared-rights', 'secret', 'proxy', 'updates'];
    const SETTINGS = (t: string) =>
      t
        .replace('//Unattended-Upgrade::Mail "";', 'Unattended-Upgrade::Mail "root";')
        .replace('//Unattended-Upgrade::Automatic-Reboot "false";', 'Unattended-Upgrade::Automatic-Reboot "true";')
        .replace('//Unattended-Upgrade::Automatic-Reboot-Time "02:00";', 'Unattended-Upgrade::Automatic-Reboot-Time "02:00";');

    it('chapitre 6 — solution : 20auto-upgrades, rapport, redémarrage la nuit, essai, puis le service', () => {
      const { c, jouer: play, editer: edit } = part(BEFORE_AUTO);
      expect(c.remote?.shell.chapter.id).toBe('auto-updates');
      let all = play([
        'ls /var/log/unattended-upgrades',
        'systemctl list-timers',
        'apt-config dump APT::Periodic',
        'sudo systemctl start apt-daily-upgrade',
      ]);
      expect(all).toContain("'/var/log/unattended-upgrades'");
      expect(all).toContain('apt-daily-upgrade.timer');
      expect(all).toContain('APT::Periodic::Unattended-Upgrade "0";');
      contains(all, "n'a rien fait");
      edit('sudo nano /etc/apt/apt.conf.d/20auto-upgrades', (t) => t.replace(/"0"/g, '"1"'));
      edit('sudo nano /etc/apt/apt.conf.d/50unattended-upgrades', SETTINGS);
      all = play(['sudo unattended-upgrade --dry-run --debug']);
      expect(all).toContain('Packages that will be upgraded: libssl3t64 linux-image-6.12.57+deb13-amd64 linux-image-amd64 openssl tzdata');
      expect(all).toContain("Checking: nodejs ([<Origin component:'main' archive:'nodistro' origin:'Node Source'");
      expect(c.finished).not.toContain('auto-updates');
      all = play(['sudo systemctl start apt-daily-upgrade', 'cat /var/log/unattended-upgrades/unattended-upgrades.log']);
      expect(all).toContain('Found /var/run/reboot-required, rebooting');
      contains(all, 'https://wiki.debian.org/UnattendedUpgrades');
      expect(c.finished).toContain('auto-updates');
    });

    it('chapitre 6 — une autre solution : un fichier à soi, nodejs sur liste noire', () => {
      const { c, jouer: play, editer: edit } = part(BEFORE_AUTO);
      edit(
        'sudo nano /etc/apt/apt.conf.d/52cooperative',
        () =>
          'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\nUnattended-Upgrade::Origins-Pattern { "origin=*"; };\nUnattended-Upgrade::Package-Blacklist { "nodejs"; };\nUnattended-Upgrade::Mail "lina";\nUnattended-Upgrade::Automatic-Reboot "true";\nUnattended-Upgrade::Automatic-Reboot-Time "21:30";\n',
      );
      play(['sudo systemctl start apt-daily-upgrade']);
      expect(c.finished).toContain('auto-updates');
    });

    it('chapitre 6 — fausses pistes : point-virgule oublié, origin=*, redémarrage immédiat', () => {
      const { c, jouer: play, editer: edit } = part(BEFORE_AUTO);
      let all = edit(
        'sudo nano /etc/apt/apt.conf.d/20auto-upgrades',
        () => 'APT::Periodic::Update-Package-Lists "1"\nAPT::Periodic::Unattended-Upgrade "1";\n',
      );
      all += play(['apt-config dump']);
      expect(all).toContain('E: Syntax error /etc/apt/apt.conf.d/20auto-upgrades:1: Extra junk after value');
      contains(all, 'oublié en fin de ligne');
      edit(
        'sudo nano /etc/apt/apt.conf.d/20auto-upgrades',
        () => 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n',
      );
      edit('sudo nano /etc/apt/apt.conf.d/50unattended-upgrades', (t) =>
        t
          .replace('Unattended-Upgrade::Origins-Pattern {', 'Unattended-Upgrade::Origins-Pattern {\n        "origin=*";')
          .replace('//Unattended-Upgrade::Automatic-Reboot "false";', 'Unattended-Upgrade::Automatic-Reboot "true";'),
      );
      all = play(['sudo unattended-upgrade -v']);
      expect(all).toContain('nodejs');
      // Redémarrage immédiat : la connexion tombe.
      expect(all).toContain('closed by remote host');
      expect(c.remote).toBeNull();
      all += play(['ssh coop']);
      contains(all, 'en plein après-midi');
      contains(all, 'nodejs vient de passer en version 22');
      expect(all).not.toContain('Bravo');
      expect(play(['systemctl status till'])).toContain('failed');
      expect(c.finished).not.toContain('auto-updates');
    });
  });
