// L'éditeur nano : ouvrir, écrire (^O) avec les bons droits, quitter (^X).
// Enregistrer change l'état du système : les objectifs des quêtes suivent.

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;

for (const language of LANGUAGES)
  describe(`Langue : ${language}`, () => {
    const fr = language === 'fr';
    // Le compte du joueur dans la langue (vous@poste, you@poste), comme les noms des lieux.
    const L = (line: string) => inLanguage(translator(language), line);

    it('nouveau fichier : ouvrir, écrire, quitter, relire', () => {
      const c = new Console({ language });
      c.execute('nano notes.txt');
      expect(c.edition?.path).toBe(L('/home/vous/notes.txt'));
      if (fr) expect(c.edition?.message).toBe('[ Nouveau fichier ]');
      const { message, written } = c.save('ligne 1\nligne 2\n');
      expect(written).toBe(true);
      if (fr) expect(message).toBe('[ 2 lignes écrites ]');
      c.quitEdition();
      expect(c.edition).toBeNull();
      expect(c.execute('cat notes.txt')).toBe('ligne 1\nligne 2');
      c.execute('nano notes.txt');
      expect(c.edition?.text).toBe('ligne 1\nligne 2\n');
      if (fr) expect(c.edition?.message).toBe('[ 2 lignes lues ]');
    });

    it('fichier de root : protégé sans sudo, écrit avec sudo ; l’objectif de la quête suit', () => {
      const s = new Shell(chapter('premier-jour'), language);
      const BLOCKED = '/etc/nginx/blocked.conf';
      s.execute(`nano ${BLOCKED}`);
      if (fr) expect(s.edition?.message).toBe(`[ Le fichier « ${BLOCKED} » est protégé en écriture ]`);
      const addition = s.edition!.text + 'deny 198.51.100.77;\n';
      if (fr) expect(s.saveEdition(addition)).toBe(`[ Erreur d'écriture de ${BLOCKED} : Permission non accordée ]`);
      s.quitEdition();
      expect(s.read(BLOCKED)).not.toContain('198.51.100.77');
      s.execute(`sudo nano ${BLOCKED}`);
      s.execute(machinesInLanguage(s.t, 'bienvenue-2026'));
      expect(s.edition?.root).toBe(true);
      s.saveEdition(s.edition!.text + 'deny 198.51.100.77;\n');
      expect(s.flags.has('regle')).toBe(true);
      if (fr) expect(s.quitEdition()).toContain('sudo systemctl reload nginx');
      expect(s.read(BLOCKED)).toContain('deny 203.0.113.5;');
    });

    it('Datacenter, chapitre 1 : bloquer le robot avec nano est une solution correcte', () => {
      const s = new Shell(chapter('premier-jour'), language);
      s.execute('sudo nano /etc/nginx/blocked.conf');
      s.execute(machinesInLanguage(s.t, 'bienvenue-2026'));
      s.saveEdition(s.edition!.text + 'deny 198.51.100.77;\n');
      s.quitEdition();
      for (const l of ['sudo systemctl reload nginx', 'ps aux', 'sudo kill 4242', 'grep " 503 " /var/log/nginx/access.log | wc -l > ~/rapport.txt', 'echo "Coupable : 198.51.100.77" >> rapport.txt'])
        s.execute(l);
      expect(s.finished).toBe(true);
    });

    it('fausses pistes : dossier, sans argument, dossier inexistant', () => {
      const c = new Console({ language });
      const directory = c.execute('nano /etc');
      expect(c.edition).toBeNull();
      if (fr) expect(directory).toBe('« /etc » est un répertoire');
      if (fr) expect(c.execute('nano')).toContain('Usage : nano fichier');
      c.execute('nano /nulle/part/notes.txt');
      const { written, message } = c.save('x\n');
      expect(written).toBe(false);
      if (fr) expect(message).toBe("[ Erreur d'écriture de /nulle/part/notes.txt : Aucun fichier ou dossier de ce nom ]");
    });

    it('une fin de chapitre atteinte dans l’éditeur est bien notée par la console', () => {
      const dc = STORIES.find((h) => h.id === 'datacenter')!;
      const c = new Console({ language, finished: ['eveil', 'bourg', 'racine'] });
      c.connect('datacenter', dc.chapters[0]);
      for (const l of ['sudo kill 4242', 'bienvenue-2026', 'echo "deny 198.51.100.77;" | sudo tee -a /etc/nginx/blocked.conf', 'sudo systemctl reload nginx', 'ps aux', 'sudo kill 4244', 'grep " 503 " /var/log/nginx/access.log | wc -l > ~/rapport.txt'])
        c.execute(machinesInLanguage(c.t, l));
      c.execute('nano rapport.txt');
      c.save(c.edition!.text + 'Coupable : 198.51.100.77\n');
      c.quitEdition();
      expect(c.finished).toContain('premier-jour');
    });
  });
