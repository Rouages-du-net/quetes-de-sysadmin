// La machine vit pendant qu'on joue (activite.ts) : le temps passe à chaque
// commande et pendant un suivi (tail -f, journalctl -f), que Ctrl-C arrête.
// La sentinelle : les robots attaquent en direct, fail2ban les bannit, puis
// les relâche à la fin du bantime.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { instants } from '../src/engine/activity';
import { LANGUAGES } from '../src/texts';
import { machinesInLanguage } from './names';

const BEFORE = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('letters'), 'shut-the-door', 'firewall'])];
const ROBOT = '198.51.100.23';

describe('instants', () => {
  it('les instants réguliers d’une source dans un intervalle ]de, a]', () => {
    expect(instants(0, 60_000, 20)).toEqual([20_000, 40_000, 60_000]);
    expect(instants(5_000, 44_000, 20)).toEqual([20_000, 40_000]);
    expect(instants(60_000, 60_000, 20)).toEqual([]);
  });
});

for (const language of LANGUAGES)
  describe(`La sentinelle en live — ${language}`, () => {
    const part = () => {
      const c = new Console({ language, finished: BEFORE });
      const play = (lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');
      play(['ssh letters', 'yes']);
      expect(c.remote?.shell.chapter.id).toBe('sentinel');
      return { c, jouer: play };
    };

    it('journalctl -fu ssh : le robot attaque sous nos yeux, fail2ban le bannit, Ctrl-C rend la main', () => {
      const { c, jouer: play } = part();
      const start = play(['journalctl -fu ssh']);
      expect(c.follows).toBe(true);
      expect(start.split('\n').length).toBe(10);
      // Le robot essaie encore… jusqu'au cinquième échec : fail2ban le bannit, plus rien n'arrive de lui.
      const direct = [c.follow(15), c.follow(15), c.follow(15)].join('\n');
      expect(direct).toMatch(new RegExp(`Invalid user \\w+ from ${ROBOT}`));
      // Le bruit de fond d'internet : des scanners, trop peu insistants pour être bannis.
      expect(direct).toMatch(/Invalid user \w+ from (203\.0\.113|192\.0\.2|198\.51\.100)\.1\d\d /);
      expect(c.follow(60)).not.toContain(ROBOT);
      expect(c.interrupt()).toBe('^C');
      expect(c.follows).toBe(false);
      expect(play(['tail -n 1 /var/log/fail2ban.log'])).toContain(`Ban ${ROBOT}`);
    });

    it('tail -f : le bannissement de 10 minutes expire, le robot revient et se fait rebannir', () => {
      const { c, jouer: play } = part();
      play(['tail -f /var/log/fail2ban.log']);
      let direct = '';
      for (let i = 0; i < 40; i++) direct += c.follow(20) + '\n';
      expect(direct).toContain(`Ban ${ROBOT}`);
      expect(direct).toContain(`Unban ${ROBOT}`);
      expect(direct).toContain('Unban 203.0.113.66');
      // Relâché, il recommence ; cinq échecs plus tard, le revoilà banni.
      expect(direct.lastIndexOf(`Ban ${ROBOT}`)).toBeGreaterThan(direct.indexOf(`Unban ${ROBOT}`));
      c.interrupt();
    });

    it('avec un bantime d’une heure, plus de va-et-vient', () => {
      const { c, jouer: play } = part();
      c.execute('sudo nano /etc/fail2ban/jail.local');
      if (c.shell.waiting) c.execute(machinesInLanguage(c.t, 'ants-2026'));
      c.save('[DEFAULT]\nbantime = 1h\nignoreip = 127.0.0.1/8 192.0.2.2 198.51.100.40\n');
      c.quitEdition();
      play(['sudo systemctl reload fail2ban', 'tail -f /var/log/fail2ban.log']);
      let direct = '';
      for (let i = 0; i < 40; i++) direct += c.follow(20) + '\n';
      expect(direct).not.toContain('Unban');
      c.interrupt();
    });

    it('l’instantané de secours rejoue aussi le temps passé à suivre', () => {
      const { c, jouer: play } = part();
      play(['journalctl -fu ssh']);
      c.follow(15);
      c.follow(15);
      c.interrupt();
      const wanted = play(['sudo fail2ban-client status sshd', 'ants-2026']);
      expect(c.restore(c.not! - 2)).toBe(true);
      expect(play(['sudo fail2ban-client status sshd', 'ants-2026'])).toBe(wanted);
    });
  });

for (const language of LANGUAGES)
  describe(`Premier jour en live — ${language}`, () => {
    const eraser = STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id);
    it('tail -f : le robot reçoit des 503 tant que le service sature, des 403 une fois bloqué', () => {
      const c = new Console({ language, finished: eraser });
      const play = (lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');
      play(['ssh datacenter', 'yes', 'tail -f /var/log/nginx/access.log']);
      expect(c.follows).toBe(true);
      expect(c.follow(6)).toMatch(/^198\.51\.100\.77 .*"GET \/catalogue\/recherche\?q=\w+ HTTP\/1\.1" 503 197$/m);
      c.interrupt();
      play(['echo "deny 198.51.100.77;" | sudo tee -a /etc/nginx/blocked.conf', 'welcome-2026', 'sudo systemctl reload nginx', 'tail -f /var/log/nginx/access.log']);
      const after = c.follow(10);
      expect(after).toMatch(/^198\.51\.100\.77 .* 403 153$/m);
      expect(after).not.toMatch(/^198\.51\.100\.77 .* 503 /m);
      c.interrupt();
    });
  });

describe('Suivre un fichier', () => {
  const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;

  it('sans activité, tail -f attend ; dans un tube, il affiche une fois sans suivre', () => {
    const s = new Shell(chapter('second-day'), 'fr');
    s.execute('tail -f /var/log/nginx/access.log');
    expect(s.follow).not.toBeNull();
    expect(s.follow!.read()).toBe('');
    s.follow = null;
    s.execute('tail -f /var/log/nginx/access.log | head -n 1');
    expect(s.follow).toBeNull();
  });
});
