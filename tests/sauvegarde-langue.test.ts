// La sauvegarde du navigateur sert à toutes les langues : une partie
// commencée en français et reprise en anglais doit garder ses clés et sa
// config ssh, mais se connecter avec le compte de la langue (vous → you).
import { describe, expect, it } from 'vitest';
import { Console } from '../src/moteur/console';
import { config } from '../src/moteur/poste';
import { traducteur } from '../src/textes';

const jouer = (c: Console, lignes: string[]) => lignes.map((l) => c.executer(l) ?? '').join('\n');

describe('Sauvegarde reprise dans une autre langue', () => {
  it('la config que le jeu a donnée n’est pas gardée', () => {
    expect(new Console({ langue: 'fr' }).ssh().fichiers.config).toBeUndefined();
  });

  it('une ancienne sauvegarde française de la config laisse la place à celle de la langue', () => {
    // Avant la correction, la config du jeu était gardée telle quelle, en français.
    const c = new Console({ langue: 'en', ssh: { fichiers: { config: config(traducteur('fr')) } } });
    expect(c.poste.lire('~/.ssh/config')).toBe(config(traducteur('en')));
    jouer(c, ['ssh royaume', 'yes']);
    expect(c.invite()).toBe('you@royaume:~$');
  });

  it('une config modifiée garde ses ajouts, et se connecte avec le compte de la langue', () => {
    const fr = new Console({ langue: 'fr' });
    fr.poste.placer('nano', '~/.ssh/config', { type: 'fichier', contenu: `${config(traducteur('fr'))}\n\nHost wiki\n    HostName wiki.maison.example\n    User vous\n    User gaspard\n    ProxyJump maison` });
    const sauve = fr.ssh();
    expect(sauve.fichiers.config).toContain('ProxyJump maison');
    const en = new Console({ langue: 'en', ssh: sauve, hotesConnus: fr.hotesConnus() });
    const texte = en.poste.lire('~/.ssh/config')!;
    expect(texte).toContain('ProxyJump maison');
    expect(texte).not.toMatch(/User vous/);
    // Un autre compte que le sien reste tel quel.
    expect(texte).toContain('User gaspard');
    jouer(en, ['ssh royaume', 'yes']);
    expect(en.invite()).toBe('you@royaume:~$');
  });
});
