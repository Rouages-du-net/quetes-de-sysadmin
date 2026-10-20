// La Coopérative : le départ d'un bénévole, les droits partagés, sudo.
// Rejoué avec la console, dans chaque langue.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/moteur/console';
import { HISTOIRES } from '../src/moteur/chapitres';
import { LANGUES, LANGUE_DE_REFERENCE, traducteur } from '../src/textes';
import { dansLaLangue } from './noms';

const EFFACEUR = HISTOIRES.find((h) => h.id === 'effaceur')!.chapitres.map((c) => c.id);
const MDP = 'radis-2027';

for (const langue of LANGUES)
  describe(`La Coopérative — ${langue}`, () => {
    const fr = langue === LANGUE_DE_REFERENCE;
    // Le compte du joueur dans la langue (vous@poste, you@poste), comme les noms des lieux.
    const L = (ligne: string) => dansLaLangue(traducteur(langue), ligne);
    const contient = (tout: string, texte: string) => fr && expect(tout).toContain(texte);
    const partie = (termines: string[] = []) => {
      const c = new Console({ langue, termines: [...EFFACEUR, ...termines] });
      // Une ligne, avec le mot de passe de sudo s'il est demandé.
      const une = (l: string) => {
        let sortie = c.executer(l) ?? '';
        if (c.shell.attente) sortie += '\n' + (c.executer(MDP) ?? '');
        return sortie;
      };
      const jouer = (lignes: string[]) => lignes.map(une).join('\n');
      const editer = (commande: string, changer: (texte: string) => string) => {
        une(commande);
        c.enregistrer(changer(c.edition!.texte));
        return c.quitterEdition();
      };
      jouer(['ssh cooperative', 'yes']);
      return { c, jouer, editer };
    };

    it('chapitre 1 — solution : expirer, retirer la clé de deploy, sudo, session, puis la sauvegarde', () => {
      const { c, jouer, editer } = partie();
      let tout = jouer(['who', 'ps -u marc', 'sudo crontab -l -u marc', 'sudo cat /home/deploy/.ssh/authorized_keys']);
      expect(tout).toContain('marc     pts/1');
      expect(tout).toContain('30 2 * * * /home/marc/bin/sauvegarde-caisse.sh');
      expect(tout).toContain('marc@portable');
      tout = jouer(['sudo usermod -L marc']);
      contient(tout, 'usermod -L n');
      tout = jouer(['sudo usermod -e 1 marc', 'sudo chage -l marc', 'sudo gpasswd -d marc sudo']);
      expect(tout).toContain('1970-01-02');
      contient(tout, 'Retrait de l');
      editer('sudo nano /home/deploy/.ssh/authorized_keys', (t) =>
        t
          .split('\n')
          .filter((l) => !l.includes('marc@portable'))
          .join('\n'),
      );
      tout = jouer(['sudo pkill -u marc', 'who']);
      expect(tout).not.toContain('marc     pts/1');
      contient(tout, 'Marc ne peut plus entrer');
      expect(c.termines).not.toContain('depart');
      jouer(['sudo cp /home/marc/bin/sauvegarde-caisse.sh /usr/local/bin/']);
      tout = editer('sudo crontab -e', (t) => t + '30 2 * * * /usr/local/bin/sauvegarde-caisse.sh\n');
      contient(tout, 'https://man7.org/linux/man-pages/man8/usermod.8.html');
      expect(c.termines).toContain('depart');
    });

    it('chapitre 1 — autre solution : /etc/cron.d, puis userdel -r', () => {
      const { c, jouer, editer } = partie();
      jouer(['sudo mkdir -p /opt/coop', 'sudo cp /home/marc/bin/sauvegarde-caisse.sh /opt/coop/']);
      editer('sudo nano /etc/cron.d/sauvegarde-caisse', () => '30 2 * * * root /opt/coop/sauvegarde-caisse.sh\n');
      editer('sudo nano /home/deploy/.ssh/authorized_keys', (t) =>
        t
          .split('\n')
          .filter((l) => !l.includes('marc@portable'))
          .join('\n'),
      );
      let tout = jouer(['sudo userdel -r marc']);
      contient(tout, 'actuellement utilisé par le processus 2741');
      tout = jouer(['sudo kill 2741 2745 2790', 'sudo userdel -r marc', 'id marc']);
      expect(c.termines).toContain('depart');
    });

    it('chapitre 1 — fausses pistes : vider deploy, la tâche dans sa propre crontab, userdel -r trop tôt', () => {
      const { c, jouer, editer } = partie();
      let tout = editer('sudo nano /home/deploy/.ssh/authorized_keys', () => '');
      contient(tout, 'La CI et Lina ne pourront plus');
      jouer(['sudo pkill -u marc']);
      tout = jouer(['sudo userdel -r marc']);
      contient(tout, 'Le dossier de Marc a disparu');
      jouer([L('sudo cp /srv/sauvegardes/2027-10-18/home/marc/bin/sauvegarde-caisse.sh /home/vous/')]);
      tout = editer('crontab -e', (t) => t + L('30 2 * * * /home/vous/sauvegarde-caisse.sh\n'));
      contient(tout, 'TA crontab');
      expect(c.termines).not.toContain('depart');
      jouer([L('sudo cp /home/vous/sauvegarde-caisse.sh /usr/local/bin/')]);
      editer('sudo crontab -e', (t) => t + '30 2 * * * /usr/local/bin/sauvegarde-caisse.sh\n');
      // deploy est toujours vide : la CI et Lina sont bloquées.
      expect(c.termines).not.toContain('depart');
    });

    const DEPART = ['depart'];
    const REGLE = '%caisse ALL=(root) /usr/bin/systemctl restart caisse\n';
    const dossierPartage = (jouer: (l: string[]) => string) =>
      jouer(['sudo chgrp -R caisse /srv/caisse/releves', 'sudo chmod -R g+w /srv/caisse/releves', 'sudo chmod g+s /srv/caisse/releves']);

    it('chapitre 2 — solution : setgid, umask dans ~/.profile, visudo (avec une erreur corrigée)', () => {
      const { c, jouer, editer } = partie(DEPART);
      let tout = jouer(['ls -l /srv/caisse/releves', 'groups lina karim']);
      expect(tout).toContain('-rw-r--r-- lina     lina');
      tout = dossierPartage(jouer) + jouer(['ls -ld /srv/caisse/releves']);
      expect(tout).toContain('drwxrwsr-x root     caisse');
      for (const qui of ['lina', 'karim']) editer(`sudo nano /home/${qui}/.profile`, (t) => t.replace('#umask 022', 'umask 002'));
      tout = jouer(['which systemctl', 'sudo visudo -f /etc/sudoers.d/caisse']);
      expect(tout).toContain('/usr/bin/systemctl');
      c.enregistrer('%caisse ALL=(root) systemctl restart caisse\n');
      tout = c.quitterEdition();
      contient(tout, 'nom de chemin totalement défini attendu');
      expect(c.termines).not.toContain('droits');
      jouer(['e']);
      c.enregistrer(REGLE);
      tout = c.quitterEdition() + jouer(['sudo -l -U lina']);
      expect(tout).toContain('(root) /usr/bin/systemctl restart caisse');
      contient(tout, 'https://www.sudo.ws/docs/man/sudoers.man/');
      expect(c.termines).toContain('droits');
    });

    it('chapitre 2 — autre solution : chmod 2775, /etc/profile.d, un alias de commande', () => {
      const { c, jouer, editer } = partie(DEPART);
      jouer(['sudo chgrp -R caisse /srv/caisse/releves', 'sudo chmod 2775 /srv/caisse/releves']);
      jouer(['sudo chmod g+w /srv/caisse/releves/2027-10-17.txt /srv/caisse/releves/2027-10-18.txt']);
      editer('sudo nano /etc/profile.d/umask-equipe.sh', () => 'umask 002\n');
      editer(
        'sudo visudo -f /etc/sudoers.d/caisse',
        () => 'Cmnd_Alias RELANCER_CAISSE = /usr/bin/systemctl restart caisse\n%caisse ALL=(root) RELANCER_CAISSE\n',
      );
      expect(c.termines).toContain('droits');
    });

    it('chapitre 2 — fausses pistes : un nom avec un point, trop large, systemctl entier, nano qui casse sudo', () => {
      const { c, jouer, editer } = partie(DEPART);
      dossierPartage(jouer);
      for (const qui of ['lina', 'karim']) editer(`sudo nano /home/${qui}/.profile`, (t) => t + '\numask 002\n');
      let tout = editer('sudo visudo -f /etc/sudoers.d/caisse.conf', () => REGLE);
      contient(tout, 'que sudo ne lit pas');
      tout = editer('sudo visudo -f /etc/sudoers.d/caisse', () => '%caisse ALL=(ALL:ALL) ALL\n');
      contient(tout, 'sudo bash');
      tout = editer('sudo visudo -f /etc/sudoers.d/caisse', () => '%caisse ALL=(root) /usr/bin/systemctl\n');
      contient(tout, 'arrêter ssh');
      expect(c.termines).not.toContain('droits');
      // nano au lieu de visudo : une faute, et sudo refuse tout.
      tout = editer('sudo nano /etc/sudoers.d/caisse', () => '%caisse ALL=(root) systemctl restart caisse\n');
      contient(tout, 'sudo est cassé');
      tout = jouer(['sudo ls']);
      if (fr) expect(tout).toContain("sudo: aucune source sudoers valide n'a été trouvée");
      expect(c.termines).not.toContain('droits');
    });

    const SITE = '/etc/nginx/sites-available/cooperative';
    const AVANT_SECRET = ['depart', 'droits'];
    const nouvelleCle = (t: string) => t.replace(/PAIEMENT_CLE=.*/, 'PAIEMENT_CLE=pk_live_coop_9d27be05c4a1');

    it('chapitre 3 — solution : le journal, location ~ /\\., deny, la nouvelle clé', () => {
      const { c, jouer, editer } = partie(AVANT_SECRET);
      let tout = jouer(['curl http://cooperative.example/.env', "sudo grep '\\.env' /var/log/nginx/access.log"]);
      expect(tout).toContain('PAIEMENT_CLE=pk_live_coop_4f9a2c71e8b3');
      expect(tout).toContain('203.0.113.77 - - [19/Oct/2027:03:12:40 +0200] "GET /.env HTTP/1.1" 200');
      editer(`sudo nano ${SITE}`, (t) =>
        t.replace('    location /caisse/', '    deny 203.0.113.77;\n\n    location ~ /\\. {\n        deny all;\n    }\n\n    location /caisse/'),
      );
      tout = jouer(['sudo nginx -t', 'sudo systemctl reload nginx', 'curl -I http://cooperative.example/.git/config']);
      expect(tout).toContain('HTTP/1.1 403 Forbidden');
      contient(tout, 'Les fichiers cachés ne sortent plus');
      tout = editer('sudo nano /srv/caisse/app/.env', nouvelleCle);
      contient(tout, "l'appli ne lit son .env qu'au démarrage");
      expect(c.termines).not.toContain('secret');
      tout = jouer(['sudo systemctl restart caisse', 'curl http://127.0.0.1:3000/health']);
      expect(tout).toContain('"paiement":"ok"');
      contient(tout, 'https://nginx.org/en/docs/http/ngx_http_core_module.html#location');
      expect(c.termines).toContain('secret');
    });

    it('chapitre 3 — autre solution : des droits que www-data ne peut pas lire', () => {
      const { c, jouer, editer } = partie(AVANT_SECRET);
      jouer(['sudo chmod 600 /srv/caisse/app/.env', 'sudo chmod -R o-rwx /srv/caisse/app/.git']);
      editer(`sudo nano ${SITE}`, (t) => t.replace('    index index.html;', '    index index.html;\n    deny 203.0.113.77;'));
      editer('sudo nano /srv/caisse/app/.env', nouvelleCle);
      jouer(['sudo systemctl reload nginx', 'sudo systemctl restart caisse']);
      expect(c.termines).toContain('secret');
    });

    it('chapitre 3 — fausses pistes : seulement /.env, deny all pour tout le site', () => {
      const { c, jouer, editer } = partie(AVANT_SECRET);
      editer(`sudo nano ${SITE}`, (t) =>
        t.replace('    location /caisse/', '    location = /.env {\n        return 404;\n    }\n\n    location /caisse/'),
      );
      let tout = jouer(['sudo systemctl reload nginx']);
      contient(tout, '/.git/config, si');
      editer(`sudo nano ${SITE}`, (t) => t.replace('    index index.html;', '    index index.html;\n    deny all;'));
      tout = jouer(['sudo systemctl reload nginx']);
      contient(tout, 'ne répond plus normalement');
      expect(c.termines).not.toContain('secret');
    });

    const AVANT_PROXY = ['depart', 'droits', 'secret'];
    const avecEntete = (entete: string) => (t: string) =>
      t.replace('proxy_pass http://127.0.0.1:3000/;', `proxy_pass http://127.0.0.1:3000/;\n        proxy_set_header ${entete};`);
    const confiance = (valeur: string) => (t: string) => t.replace(/TRUST_PROXY=.*/, `TRUST_PROXY=${valeur}`);

    it('chapitre 4 — solution : X-Forwarded-For dans nginx, TRUST_PROXY=loopback', () => {
      const { c, jouer, editer } = partie(AVANT_PROXY);
      let tout = jouer(['sudo tail -3 /var/log/caisse/app.log', "sudo grep 'POST /caisse' /var/log/nginx/access.log"]);
      expect(tout).toContain('locked 127.0.0.1 for 15 minutes');
      expect(tout).toContain('198.51.100.66');
      tout = jouer(['sudo systemctl restart caisse']);
      contient(tout, 'Lina avec');
      editer(`sudo nano ${SITE}`, avecEntete('X-Forwarded-For $proxy_add_x_forwarded_for'));
      editer('sudo nano /srv/caisse/app/.env', confiance('loopback'));
      tout = jouer(['sudo nginx -t', 'sudo systemctl reload nginx', 'sudo systemctl restart caisse', 'sudo tail -2 /var/log/caisse/app.log']);
      expect(tout).toContain('login ok for lina from 192.0.2.44');
      contient(tout, 'https://expressjs.com/en/guide/behind-proxies.html');
      expect(c.termines).toContain('proxy');
    });

    it('chapitre 4 — autre solution : $remote_addr, et la seule adresse de nginx', () => {
      const { c, jouer, editer } = partie(AVANT_PROXY);
      editer(`sudo nano ${SITE}`, avecEntete('X-Forwarded-For $remote_addr'));
      editer('sudo nano /srv/caisse/app/.env', confiance('127.0.0.1'));
      jouer(['sudo systemctl reload nginx', 'sudo systemctl restart caisse']);
      expect(c.termines).toContain('proxy');
    });

    it('chapitre 4 — fausses pistes : TRUST_PROXY=true, ou l’en-tête du client transmis tel quel', () => {
      const { c, jouer, editer } = partie(AVANT_PROXY);
      editer(`sudo nano ${SITE}`, avecEntete('X-Forwarded-For $proxy_add_x_forwarded_for'));
      editer('sudo nano /srv/caisse/app/.env', confiance('true'));
      let tout = jouer(['sudo systemctl reload nginx', 'sudo systemctl restart caisse', 'sudo tail -2 /var/log/caisse/app.log']);
      expect(tout).toContain('login failed for admin from 10.');
      contient(tout, 'le robot (198.51.100.66) n');
      expect(c.termines).not.toContain('proxy');
      // loopback, mais nginx ne fait que transmettre ce que le client a écrit.
      editer(`sudo nano ${SITE}`, (t) => t.replace('$proxy_add_x_forwarded_for', '$http_x_forwarded_for'));
      editer('sudo nano /srv/caisse/app/.env', confiance('loopback'));
      tout = jouer(['sudo systemctl reload nginx', 'sudo systemctl restart caisse', 'sudo tail -2 /var/log/caisse/app.log']);
      expect(tout).toContain('login failed for admin from 10.');
      expect(c.termines).not.toContain('proxy');
    });

    const AVANT_MAJ = ['depart', 'droits', 'secret', 'proxy'];

    it('chapitre 5 — solution : apt update, upgrade dans tmux, la coupure, attach, reboot, enable', () => {
      const { c, jouer } = partie(AVANT_MAJ);
      let tout = jouer(['uname -r', 'sudo apt upgrade']);
      expect(tout).toContain('6.12.38+deb13-amd64');
      expect(tout).toContain('Upgrading: 0, Installing: 0');
      tout = jouer(['sudo apt update', 'apt list --upgradable']);
      expect(tout).toContain("5 packages can be upgraded. Run 'apt list --upgradable' to see them.");
      expect(tout).toContain('linux-image-amd64/trixie-security 6.12.48-1 amd64 [upgradable from: 6.12.38-1]');
      jouer(['tmux new -s maj']);
      expect(c.invite()).toBe(L('[maj] vous@cooperative:~$'));
      tout = jouer(['sudo apt upgrade', 'y']);
      expect(tout).toContain('client_loop: send disconnect: Broken pipe');
      expect(c.invite()).toBe(L('vous@poste:~$'));
      tout = jouer(['ssh cooperative', 'tmux ls', 'tmux attach -t maj']);
      contient(tout, 'la mise à jour tournait dans tmux');
      expect(tout).toContain('maj: 1 windows');
      expect(tout).toContain('Setting up linux-image-amd64 (6.12.48-1) ...');
      tout = jouer(['cat /var/run/reboot-required.pkgs', 'tmux detach', 'sudo reboot']);
      expect(tout).toContain('linux-image-6.12.48+deb13-amd64');
      expect(tout).toContain('[detached (from session maj)]');
      contient(tout, 'la caisse ne répond plus');
      tout = jouer(['ssh cooperative', 'uname -r', 'systemctl --failed', 'sudo systemctl enable --now caisse']);
      expect(tout).toContain('Linux cooperative 6.12.48+deb13-amd64');
      contient(tout, 'https://man.openbsd.org/tmux');
      expect(c.termines).toContain('mises-a-jour');
    });

    it('chapitre 5 — autre solution : sans tmux, dpkg --configure -a, et la caisse activée avant de redémarrer', () => {
      const { c, jouer } = partie(AVANT_MAJ);
      let tout = jouer(['sudo apt update', 'sudo apt upgrade -y']);
      expect(tout).toContain('client_loop: send disconnect: Broken pipe');
      tout = jouer(['ssh cooperative', 'sudo apt upgrade -y', 'sudo apt install curl']);
      contient(tout, 'dpkg --configure -a');
      expect(tout).toContain("Error: dpkg was interrupted, you must manually run 'dpkg --configure -a' to correct the problem.");
      tout = jouer(['sudo dpkg --configure -a', 'sudo apt upgrade']);
      expect(tout).toContain('Setting up libc6 (2.41-12+deb13u1) ...');
      expect(tout).toContain('Upgrading: 0, Installing: 0');
      jouer(['sudo systemctl enable caisse', 'sudo systemctl reboot', 'ssh cooperative']);
      expect(c.termines).toContain('mises-a-jour');
    });

    it('chapitre 5 — fausses pistes : pas de redémarrage, tmux imbriqué, une session inconnue', () => {
      const { c, jouer } = partie(AVANT_MAJ);
      let tout = jouer(['tmux attach', 'tmux new -s maj', 'tmux new -s autre', 'tmux attach -t inconnue']);
      expect(tout).toContain('no server running on /tmp/tmux-1000/default');
      expect(tout).toContain('sessions should be nested with care, unset $TMUX to force');
      tout = jouer(['exit']);
      expect(tout).toContain('[exited]');
      expect(c.invite()).toBe(L('vous@cooperative:~$'));
      jouer(['tmux new -s maj', 'sudo apt update', 'sudo apt upgrade -y', 'ssh cooperative', 'sudo systemctl enable caisse']);
      tout = jouer(['uname -r']);
      expect(tout).toContain('6.12.38+deb13-amd64');
      expect(c.termines).not.toContain('mises-a-jour');
    });

    // Chapitre 6 : les mises à jour automatiques.
    const AVANT_AUTO = ['depart', 'droits', 'secret', 'proxy', 'mises-a-jour'];
    const REGLAGES = (t: string) =>
      t
        .replace('//Unattended-Upgrade::Mail "";', 'Unattended-Upgrade::Mail "root";')
        .replace('//Unattended-Upgrade::Automatic-Reboot "false";', 'Unattended-Upgrade::Automatic-Reboot "true";')
        .replace('//Unattended-Upgrade::Automatic-Reboot-Time "02:00";', 'Unattended-Upgrade::Automatic-Reboot-Time "02:00";');

    it('chapitre 6 — solution : 20auto-upgrades, rapport, redémarrage la nuit, essai, puis le service', () => {
      const { c, jouer, editer } = partie(AVANT_AUTO);
      expect(c.distant?.shell.chapitre.id).toBe('automatiques');
      let tout = jouer([
        'ls /var/log/unattended-upgrades',
        'systemctl list-timers',
        'apt-config dump APT::Periodic',
        'sudo systemctl start apt-daily-upgrade',
      ]);
      expect(tout).toContain("'/var/log/unattended-upgrades'");
      expect(tout).toContain('apt-daily-upgrade.timer');
      expect(tout).toContain('APT::Periodic::Unattended-Upgrade "0";');
      contient(tout, "n'a rien fait");
      editer('sudo nano /etc/apt/apt.conf.d/20auto-upgrades', (t) => t.replace(/"0"/g, '"1"'));
      editer('sudo nano /etc/apt/apt.conf.d/50unattended-upgrades', REGLAGES);
      tout = jouer(['sudo unattended-upgrade --dry-run --debug']);
      expect(tout).toContain('Packages that will be upgraded: libssl3t64 linux-image-6.12.57+deb13-amd64 linux-image-amd64 openssl tzdata');
      expect(tout).toContain("Checking: nodejs ([<Origin component:'main' archive:'nodistro' origin:'Node Source'");
      expect(c.termines).not.toContain('automatiques');
      tout = jouer(['sudo systemctl start apt-daily-upgrade', 'cat /var/log/unattended-upgrades/unattended-upgrades.log']);
      expect(tout).toContain('Found /var/run/reboot-required, rebooting');
      contient(tout, 'https://wiki.debian.org/UnattendedUpgrades');
      expect(c.termines).toContain('automatiques');
    });

    it('chapitre 6 — une autre solution : un fichier à soi, nodejs sur liste noire', () => {
      const { c, jouer, editer } = partie(AVANT_AUTO);
      editer(
        'sudo nano /etc/apt/apt.conf.d/52cooperative',
        () =>
          'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\nUnattended-Upgrade::Origins-Pattern { "origin=*"; };\nUnattended-Upgrade::Package-Blacklist { "nodejs"; };\nUnattended-Upgrade::Mail "lina";\nUnattended-Upgrade::Automatic-Reboot "true";\nUnattended-Upgrade::Automatic-Reboot-Time "21:30";\n',
      );
      jouer(['sudo systemctl start apt-daily-upgrade']);
      expect(c.termines).toContain('automatiques');
    });

    it('chapitre 6 — fausses pistes : point-virgule oublié, origin=*, redémarrage immédiat', () => {
      const { c, jouer, editer } = partie(AVANT_AUTO);
      let tout = editer(
        'sudo nano /etc/apt/apt.conf.d/20auto-upgrades',
        () => 'APT::Periodic::Update-Package-Lists "1"\nAPT::Periodic::Unattended-Upgrade "1";\n',
      );
      tout += jouer(['apt-config dump']);
      expect(tout).toContain('E: Syntax error /etc/apt/apt.conf.d/20auto-upgrades:1: Extra junk after value');
      contient(tout, 'oublié en fin de ligne');
      editer(
        'sudo nano /etc/apt/apt.conf.d/20auto-upgrades',
        () => 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n',
      );
      editer('sudo nano /etc/apt/apt.conf.d/50unattended-upgrades', (t) =>
        t
          .replace('Unattended-Upgrade::Origins-Pattern {', 'Unattended-Upgrade::Origins-Pattern {\n        "origin=*";')
          .replace('//Unattended-Upgrade::Automatic-Reboot "false";', 'Unattended-Upgrade::Automatic-Reboot "true";'),
      );
      tout = jouer(['sudo unattended-upgrade -v']);
      expect(tout).toContain('nodejs');
      // Redémarrage immédiat : la connexion tombe.
      expect(tout).toContain('closed by remote host');
      expect(c.distant).toBeNull();
      tout += jouer(['ssh cooperative']);
      contient(tout, 'en plein après-midi');
      contient(tout, 'nodejs vient de passer en version 22');
      expect(tout).not.toContain('Bravo');
      expect(jouer(['systemctl status caisse'])).toContain('failed');
      expect(c.termines).not.toContain('automatiques');
    });
  });
