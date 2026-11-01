// The browser's save serves every language: a game
// started in French and resumed in English must keep its keys and its
// ssh config, but connect with the language's account (vous → you),
// and the machine names follow (royaume → kingdom, maison → community).
import { describe, expect, it } from 'vitest';
import { machinesInLanguage } from './names';
import { Console } from '../src/engine/console';
import { config } from '../src/engine/workstation';
import { translator } from '../src/texts';

const play = (c: Console, lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');

describe('Save resumed in another language', () => {
  it('the config the game gave is not kept', () => {
    expect(new Console({ language: 'fr' }).ssh().files.config).toBeUndefined();
  });

  it('an old French save of the config gives way to the language’s one', () => {
    // Before the fix, the game's config was kept as is, in French.
    const c = new Console({ language: 'en', ssh: { files: { config: config(translator('fr')) } } });
    expect(c.workstation.read('~/.ssh/config')).toBe(config(translator('en')));
    play(c, ['ssh kingdom', 'yes']);
    expect(c.prompt()).toBe('you@kingdom:~$');
  });

  it('a modified config keeps its additions, and connects with the language’s account', () => {
    const fr = new Console({ language: 'fr' });
    fr.workstation.place('nano', '~/.ssh/config', { type: 'file', content: `${config(translator('fr'))}\n\nHost wiki\n    HostName wiki.maison.internal\n    User you\n    User gaspard\n    ProxyJump maison` });
    play(fr, ['ssh kingdom', 'yes', 'exit']);
    expect(fr.knownHosts()).toContain('royaume.internal');
    const saved = fr.ssh();
    expect(saved.files.config).toContain('ProxyJump maison');
    const inside = new Console({ language: 'en', ssh: saved, knownHosts: fr.knownHosts() });
    const text = inside.workstation.read('~/.ssh/config')!;
    // Machine names follow the language; wiki, an internal machine, keeps its own.
    expect(text).toContain('ProxyJump community');
    expect(text).toContain('HostName wiki.community.internal');
    expect(text).not.toMatch(/User vous/);
    // An account other than one's own stays as is.
    expect(text).toContain('User gaspard');
    // known_hosts follows too: royaume.internal is already known under its English name, no question.
    expect(inside.knownHosts()).not.toContain('royaume');
    play(inside, ['ssh kingdom']);
    expect(inside.prompt()).toBe('you@kingdom:~$');
  });
});
