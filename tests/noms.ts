// Les commandes des tests s'écrivent avec les noms français des lieux et des
// objets ; dans une autre langue, chaque nom du monde prend sa traduction
// (voir nom() dans src/moteur/monde.ts). Une copie numérotée (levain_2)
// suit son original. Le compte du joueur se traduit aussi dans vous@royaume
// ou /home/vous:/bin/bash (@ et : séparent les noms).
import { nom } from '../src/moteur/monde';
import type { Traduire } from '../src/textes';

export const dansLaLangue = (t: Traduire, ligne: string) =>
  ligne.replace(/[^\s/"'*@:]+/g, (m) => {
    const copie = /^(.+?)(_\d+)$/.exec(m);
    return copie && nom(t, copie[1]) !== copie[1] ? nom(t, copie[1]) + copie[2] : nom(t, m);
  });
