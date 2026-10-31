// La carte : les lieux visités, le chemin qui y mène, les lieux aperçus
// depuis eux ; rien d'autre (ni ce qui est plus loin, ni les lieux cachés
// pas encore visités, ni les fichiers).
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { HISTOIRES } from '../src/engine/chapters';
import { carte, type Lieu } from '../src/engine/map';
import { LANGUES, traducteur } from '../src/texts';
import { dansLaLangue } from './names';
import { poste } from '../src/engine/workstation';

const chapitre = (id: string) => HISTOIRES.flatMap((h) => h.chapitres).find((c) => c.id === id)!;
// Tous les lieux de la carte, par chemin.
const lieux = (l: Lieu): Record<string, Lieu> => Object.assign({ [l.chemin]: l }, ...l.enfants.map(lieux));

for (const langue of LANGUES)
  describe(`Carte en ${langue}`, () => {
    const L = (texte: string) => dansLaLangue(traducteur(langue), texte);

    it('au départ : la maison, ce qu’on y aperçoit, et la racine', () => {
      const s = new Shell(chapitre('eveil'), langue);
      const c = lieux(carte(s));
      expect(c['/'].visite).toBe(true);
      expect(c[L('/Cabane')]).toMatchObject({ ici: true, maison: true, visite: true });
      expect(c[L('/Cabane/Colline')]).toMatchObject({ visite: false, ici: false });
      expect(c[L('/Cabane/Jetee')].visite).toBe(false);
      // Plus loin que ce qu'on aperçoit : rien.
      expect(c[L('/Cabane/Jetee/Phare')]).toBeUndefined();
      expect(c[L('/Cabane/Colline/EcoleDesSignaux')]).toBeUndefined();
      // Pas de fichiers.
      expect(Object.keys(c).some((k) => k.endsWith('.txt'))).toBe(false);
    });

    it('en avançant : le lieu visité, puis ce qu’on y aperçoit ; un lieu fermé', () => {
      const s = new Shell(chapitre('eveil'), langue);
      s.executer(L('cd Jetee'));
      let c = lieux(carte(s));
      expect(c[L('/Cabane/Jetee')]).toMatchObject({ ici: true, visite: true });
      expect(c[L('/Cabane')]).toMatchObject({ ici: false, maison: true });
      // Le Phare est bloqué par le filet.
      expect(c[L('/Cabane/Jetee/Phare')]).toMatchObject({ visite: false, ferme: true });
      s.executer(L('cd ~/Colline/EcoleDesSignaux'));
      c = lieux(carte(s));
      expect(c[L('/Cabane/Colline')].visite).toBe(true);
      expect(c[L('/Cabane/Colline/EcoleDesSignaux/SalleDExercice')].visite).toBe(false);
      expect(c[L('/Cabane/Jetee')]).toMatchObject({ visite: true, ici: false });
    });

    it('un lieu caché n’y paraît qu’une fois visité', () => {
      const s = new Shell(poste([]), langue);
      const ssh = `${s.maison}/.ssh`;
      expect(lieux(carte(s))[ssh]).toBeUndefined();
      s.executer('cd .ssh');
      expect(lieux(carte(s))[ssh]).toMatchObject({ ici: true, visite: true });
    });

    it('sur un serveur : la vraie arborescence depuis /, les maisons des autres aperçues en passant', () => {
      const c = lieux(carte(new Shell(chapitre('racine'), langue)));
      expect(c['/home'].visite).toBe(true);
      expect(c['/etc']).toMatchObject({ visite: false });
      expect(c['/home/nour']).toMatchObject({ visite: false });
    });
  });
