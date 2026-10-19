// La Coopérative : le départ d'un bénévole, les droits partagés, sudo.
// Rejoué avec la console, dans chaque langue.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/moteur/console';
import { HISTOIRES } from '../src/moteur/chapitres';
import { LANGUES, LANGUE_DE_REFERENCE } from '../src/textes';

const EFFACEUR = HISTOIRES.find((h) => h.id === 'effaceur')!.chapitres.map((c) => c.id);
const MDP = 'radis-2027';

for (const langue of LANGUES)
  describe(`La Coopérative — ${langue}`, () => {
    const fr = langue === LANGUE_DE_REFERENCE;
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
      jouer(['sudo cp /srv/sauvegardes/2027-10-18/home/marc/bin/sauvegarde-caisse.sh /home/vous/']);
      tout = editer('crontab -e', (t) => t + '30 2 * * * /home/vous/sauvegarde-caisse.sh\n');
      contient(tout, 'TA crontab');
      expect(c.termines).not.toContain('depart');
      jouer(['sudo cp /home/vous/sauvegarde-caisse.sh /usr/local/bin/']);
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
      expect(tout).toContain("sudo: aucune source sudoers valide n'a été trouvée");
      expect(c.termines).not.toContain('droits');
    });
  });
