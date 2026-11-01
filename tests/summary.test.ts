// Le bilan de fin de chapitre : les commandes tapées (et en erreur), les
// indices, et la commande qui a franchi chaque étape, à côté de la solution
// de référence.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { summary } from '../src/engine/summary';
import { hint } from '../src/engine/hints';
import { translator } from '../src/texts';
import { inLanguage } from './names';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const L = (text: string) => inLanguage(translator('fr'), text);

describe('Bilan de fin de chapitre', () => {
  it('compte les commandes, les erreurs, et note la commande de chaque étape', () => {
    const s = new Shell(chapter('lighthouse'), 'fr');
    s.requestsHints.add(`${hint(s).step}:piste`);
    for (const l of ['lss', 'cat message.txt', 'cd Colline/EcoleDesSignaux/SalleDExercice', 'mv crabe Seau', 'cd ~/Jetee', 'mv filet ~/Port/Hangar', 'cd ~/Port/Remise', 'mv .ampoule_de_secours ~/Jetee/Phare/Escalier/Lanterne/ampoule'])
      s.execute(L(l));
    expect(s.finished).toBe(true);
    const b = summary(s);
    expect(b.commands).toBe(8);
    expect(b.errors).toBe(1);
    expect(b.hints).toBe(1);
    expect(b.steps.length).toBeGreaterThan(0);
    // Chaque étape a sa solution de référence ; la dernière a été franchie par le mv final.
    expect(b.steps.every((e) => e.solution.length > 0)).toBe(true);
    expect(b.steps.some((e) => e.line === L('mv .ampoule_de_secours ~/Jetee/Phare/Escalier/Lanterne/ampoule'))).toBe(true);
  });

  it('un mot de passe demandé par sudo n’est pas une commande de plus', () => {
    const s = new Shell(chapter('root'), 'fr');
    s.execute('sudo ls');
    s.execute(chapter('root').password!);
    expect(summary(s).commands).toBe(1);
  });
});
