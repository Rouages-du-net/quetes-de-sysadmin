// Le bilan de fin de chapitre : les commandes tapées (et en erreur), les
// indices, et la commande qui a franchi chaque étape, à côté de la solution
// de référence.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/moteur/shell';
import { HISTOIRES } from '../src/moteur/chapitres';
import { bilan } from '../src/moteur/bilan';
import { indice } from '../src/moteur/indices';
import { traducteur } from '../src/textes';
import { dansLaLangue } from './noms';

const chapitre = (id: string) => HISTOIRES.flatMap((h) => h.chapitres).find((c) => c.id === id)!;
const L = (texte: string) => dansLaLangue(traducteur('fr'), texte);

describe('Bilan de fin de chapitre', () => {
  it('compte les commandes, les erreurs, et note la commande de chaque étape', () => {
    const s = new Shell(chapitre('eveil'), 'fr');
    s.indicesDemandes.add(`${indice(s).etape}:piste`);
    for (const l of ['lss', 'cat message.txt', 'cd Colline/EcoleDesSignaux/SalleDExercice', 'mv crabe Seau', 'cd ~/Jetee', 'mv filet ~/Port/Hangar', 'cd ~/Port/Remise', 'mv .ampoule_de_secours ~/Jetee/Phare/Escalier/Lanterne/ampoule'])
      s.executer(L(l));
    expect(s.termine).toBe(true);
    const b = bilan(s);
    expect(b.commandes).toBe(8);
    expect(b.erreurs).toBe(1);
    expect(b.indices).toBe(1);
    expect(b.etapes.length).toBeGreaterThan(0);
    // Chaque étape a sa solution de référence ; la dernière a été franchie par le mv final.
    expect(b.etapes.every((e) => e.solution.length > 0)).toBe(true);
    expect(b.etapes.some((e) => e.ligne === L('mv .ampoule_de_secours ~/Jetee/Phare/Escalier/Lanterne/ampoule'))).toBe(true);
  });

  it('un mot de passe demandé par sudo n’est pas une commande de plus', () => {
    const s = new Shell(chapitre('racine'), 'fr');
    s.executer('sudo ls');
    s.executer(chapitre('racine').motDePasse!);
    expect(bilan(s).commandes).toBe(1);
  });
});
