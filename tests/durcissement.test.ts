// Les Lettres du quartier, « Fermer la porte » : durcir SSH. Rejoué avec la
// console (la fin demande de se reconnecter), dans chaque langue.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/moteur/console';
import { HISTOIRES } from '../src/moteur/chapitres';
import { LANGUES, LANGUE_DE_REFERENCE } from '../src/textes';

const EFFACEUR = HISTOIRES.find((h) => h.id === 'effaceur')!.chapitres.map((c) => c.id);
const CONFIG = '/etc/ssh/sshd_config';

for (const langue of LANGUES)
  describe(`Langue : ${langue}`, () => {
    const fr = langue === LANGUE_DE_REFERENCE;
    const contient = (tout: string, texte: string) => fr && expect(tout).toContain(texte);
    const partie = () => {
      const c = new Console({ langue, termines: EFFACEUR });
      const jouer = (lignes: string[]) => lignes.map((l) => c.executer(l) ?? '').join('\n');
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
      expect(tout).toContain('root@lettres.example: Permission denied (publickey).');
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
      expect(dehors).toContain('vous@lettres.example: Permission denied (publickey).');
      contient(dehors, 'tu t’es enfermé·e dehors'.replace('’', "'"));
      expect(c.invite()).toBe('vous@poste:~$');
      // Le menu : comme la console de secours de l'hébergeur.
      c.connecter('lettres');
      modifier('/etc/ssh/sshd_config.d/00-durcissement.conf', (t) => t.replace('AllowUsers kofi', 'AllowUsers vous'));
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
    const partie = () => {
      const c = new Console({ langue, termines: [...EFFACEUR, 'fermer-la-porte'] });
      const jouer = (lignes: string[]) => lignes.map((l) => c.executer(l) ?? '').join('\n');
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
      expect(dehors).toContain('ssh: connect to host lettres.example port 22: Connection timed out');
      expect(c.invite()).toBe('vous@poste:~$');
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
