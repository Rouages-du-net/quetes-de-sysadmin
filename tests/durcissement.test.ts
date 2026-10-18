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
