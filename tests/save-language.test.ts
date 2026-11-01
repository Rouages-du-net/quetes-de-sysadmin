// La sauvegarde du navigateur sert à toutes les langues : une partie
// commencée en français et reprise en anglais doit garder ses clés et sa
// config ssh, mais se connecter avec le compte de la langue (vous → you),
// et les noms des machines suivent (royaume → kingdom, maison → community).
import { describe, expect, it } from 'vitest';
import { machinesInLanguage } from './names';
import { Console } from '../src/engine/console';
import { config } from '../src/engine/workstation';
import { translator } from '../src/texts';

const play = (c: Console, lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');

describe('Sauvegarde reprise dans une autre langue', () => {
  it('la config que le jeu a donnée n’est pas gardée', () => {
    expect(new Console({ language: 'fr' }).ssh().files.config).toBeUndefined();
  });

  it('une ancienne sauvegarde française de la config laisse la place à celle de la langue', () => {
    // Avant la correction, la config du jeu était gardée telle quelle, en français.
    const c = new Console({ language: 'en', ssh: { files: { config: config(translator('fr')) } } });
    expect(c.workstation.read('~/.ssh/config')).toBe(config(translator('en')));
    play(c, ['ssh royaume', 'yes']);
    expect(c.prompt()).toBe('you@kingdom:~$');
  });

  it('une config modifiée garde ses ajouts, et se connecte avec le compte de la langue', () => {
    const fr = new Console({ language: 'fr' });
    fr.workstation.place('nano', '~/.ssh/config', { type: 'fichier', content: `${config(translator('fr'))}\n\nHost wiki\n    HostName wiki.maison.internal\n    User vous\n    User gaspard\n    ProxyJump maison` });
    play(fr, ['ssh royaume', 'yes', 'exit']);
    expect(fr.knownHosts()).toContain('royaume.internal');
    const saved = fr.ssh();
    expect(saved.files.config).toContain('ProxyJump maison');
    const inside = new Console({ language: 'en', ssh: saved, knownHosts: fr.knownHosts() });
    const text = inside.workstation.read('~/.ssh/config')!;
    // Les noms des machines suivent la langue ; wiki, une machine interne, garde le sien.
    expect(text).toContain('ProxyJump community');
    expect(text).toContain('HostName wiki.community.internal');
    expect(text).not.toMatch(/User vous/);
    // Un autre compte que le sien reste tel quel.
    expect(text).toContain('User gaspard');
    // known_hosts suit aussi : royaume.internal est déjà connue sous son nom anglais, pas de question.
    expect(inside.knownHosts()).not.toContain('royaume');
    play(inside, ['ssh royaume']);
    expect(inside.prompt()).toBe('you@kingdom:~$');
  });
});
