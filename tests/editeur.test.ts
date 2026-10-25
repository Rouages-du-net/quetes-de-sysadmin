// L'éditeur nano : ouvrir, écrire (^O) avec les bons droits, quitter (^X).
// Enregistrer change l'état du système : les objectifs des quêtes suivent.

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/moteur/shell';
import { Console } from '../src/moteur/console';
import { HISTOIRES } from '../src/moteur/chapitres';
import { LANGUES, LANGUE_DE_REFERENCE, traducteur } from '../src/textes';
import { dansLaLangue, machinesDansLaLangue } from './noms';

const chapitre = (id: string) => HISTOIRES.flatMap((h) => h.chapitres).find((c) => c.id === id)!;

for (const langue of LANGUES)
  describe(`Langue : ${langue}`, () => {
    const fr = langue === LANGUE_DE_REFERENCE;
    // Le compte du joueur dans la langue (vous@poste, you@poste), comme les noms des lieux.
    const L = (ligne: string) => dansLaLangue(traducteur(langue), ligne);

    it('nouveau fichier : ouvrir, écrire, quitter, relire', () => {
      const c = new Console({ langue });
      c.executer('nano notes.txt');
      expect(c.edition?.chemin).toBe(L('/home/vous/notes.txt'));
      if (fr) expect(c.edition?.message).toBe('[ Nouveau fichier ]');
      const { message, ecrit } = c.enregistrer('ligne 1\nligne 2\n');
      expect(ecrit).toBe(true);
      if (fr) expect(message).toBe('[ 2 lignes écrites ]');
      c.quitterEdition();
      expect(c.edition).toBeNull();
      expect(c.executer('cat notes.txt')).toBe('ligne 1\nligne 2');
      c.executer('nano notes.txt');
      expect(c.edition?.texte).toBe('ligne 1\nligne 2\n');
      if (fr) expect(c.edition?.message).toBe('[ 2 lignes lues ]');
    });

    it('fichier de root : protégé sans sudo, écrit avec sudo ; l’objectif de la quête suit', () => {
      const s = new Shell(chapitre('premier-jour'), langue);
      const BLOQUES = '/etc/nginx/blocked.conf';
      s.executer(`nano ${BLOQUES}`);
      if (fr) expect(s.edition?.message).toBe(`[ Le fichier « ${BLOQUES} » est protégé en écriture ]`);
      const ajout = s.edition!.texte + 'deny 198.51.100.77;\n';
      if (fr) expect(s.enregistrerEdition(ajout)).toBe(`[ Erreur d'écriture de ${BLOQUES} : Permission non accordée ]`);
      s.quitterEdition();
      expect(s.lire(BLOQUES)).not.toContain('198.51.100.77');
      s.executer(`sudo nano ${BLOQUES}`);
      s.executer(machinesDansLaLangue(s.t, 'bienvenue-2026'));
      expect(s.edition?.root).toBe(true);
      s.enregistrerEdition(s.edition!.texte + 'deny 198.51.100.77;\n');
      expect(s.drapeaux.has('regle')).toBe(true);
      if (fr) expect(s.quitterEdition()).toContain('sudo systemctl reload nginx');
      expect(s.lire(BLOQUES)).toContain('deny 203.0.113.5;');
    });

    it('Datacenter, chapitre 1 : bloquer le robot avec nano est une solution correcte', () => {
      const s = new Shell(chapitre('premier-jour'), langue);
      s.executer('sudo nano /etc/nginx/blocked.conf');
      s.executer(machinesDansLaLangue(s.t, 'bienvenue-2026'));
      s.enregistrerEdition(s.edition!.texte + 'deny 198.51.100.77;\n');
      s.quitterEdition();
      for (const l of ['sudo systemctl reload nginx', 'ps aux', 'sudo kill 4242', 'grep " 503 " /var/log/nginx/access.log | wc -l > ~/rapport.txt', 'echo "Coupable : 198.51.100.77" >> rapport.txt'])
        s.executer(l);
      expect(s.termine).toBe(true);
    });

    it('fausses pistes : dossier, sans argument, dossier inexistant', () => {
      const c = new Console({ langue });
      const dossier = c.executer('nano /etc');
      expect(c.edition).toBeNull();
      if (fr) expect(dossier).toBe('« /etc » est un répertoire');
      if (fr) expect(c.executer('nano')).toContain('Usage : nano fichier');
      c.executer('nano /nulle/part/notes.txt');
      const { ecrit, message } = c.enregistrer('x\n');
      expect(ecrit).toBe(false);
      if (fr) expect(message).toBe("[ Erreur d'écriture de /nulle/part/notes.txt : Aucun fichier ou dossier de ce nom ]");
    });

    it('une fin de chapitre atteinte dans l’éditeur est bien notée par la console', () => {
      const dc = HISTOIRES.find((h) => h.id === 'datacenter')!;
      const c = new Console({ langue, termines: ['eveil', 'bourg', 'racine'] });
      c.connecter('datacenter', dc.chapitres[0]);
      for (const l of ['sudo kill 4242', 'bienvenue-2026', 'echo "deny 198.51.100.77;" | sudo tee -a /etc/nginx/blocked.conf', 'sudo systemctl reload nginx', 'ps aux', 'sudo kill 4244', 'grep " 503 " /var/log/nginx/access.log | wc -l > ~/rapport.txt'])
        c.executer(machinesDansLaLangue(c.t, l));
      c.executer('nano rapport.txt');
      c.enregistrer(c.edition!.texte + 'Coupable : 198.51.100.77\n');
      c.quitterEdition();
      expect(c.termines).toContain('premier-jour');
    });
  });
