// La machine vit pendant qu'on joue (activite.ts) : le temps passe à chaque
// commande et pendant un suivi (tail -f, journalctl -f), que Ctrl-C arrête.
// La sentinelle : les robots attaquent en direct, fail2ban les bannit, puis
// les relâche à la fin du bantime.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/moteur/console';
import { Shell } from '../src/moteur/shell';
import { HISTOIRES } from '../src/moteur/chapitres';
import { prerequis } from '../src/moteur/deverrouillage';
import { instants } from '../src/moteur/activite';
import { LANGUES } from '../src/textes';
import { machinesDansLaLangue } from './noms';

const AVANT = [...new Set([...HISTOIRES.find((h) => h.id === 'effaceur')!.chapitres.map((c) => c.id), ...prerequis('lettres'), 'fermer-la-porte', 'pare-feu'])];
const ROBOT = '198.51.100.23';

describe('instants', () => {
  it('les instants réguliers d’une source dans un intervalle ]de, a]', () => {
    expect(instants(0, 60_000, 20)).toEqual([20_000, 40_000, 60_000]);
    expect(instants(5_000, 44_000, 20)).toEqual([20_000, 40_000]);
    expect(instants(60_000, 60_000, 20)).toEqual([]);
  });
});

for (const langue of LANGUES)
  describe(`La sentinelle en direct — ${langue}`, () => {
    const partie = () => {
      const c = new Console({ langue, termines: AVANT });
      const jouer = (lignes: string[]) => lignes.map((l) => c.executer(machinesDansLaLangue(c.t, l)) ?? '').join('\n');
      jouer(['ssh lettres', 'yes']);
      expect(c.distant?.shell.chapitre.id).toBe('sentinelle');
      return { c, jouer };
    };

    it('journalctl -fu ssh : le robot attaque sous nos yeux, fail2ban le bannit, Ctrl-C rend la main', () => {
      const { c, jouer } = partie();
      const debut = jouer(['journalctl -fu ssh']);
      expect(c.suit).toBe(true);
      expect(debut.split('\n').length).toBe(10);
      // Le robot essaie encore… jusqu'au cinquième échec : fail2ban le bannit, plus rien n'arrive de lui.
      const direct = [c.suivre(15), c.suivre(15), c.suivre(15)].join('\n');
      expect(direct).toMatch(new RegExp(`Invalid user \\w+ from ${ROBOT}`));
      // Le bruit de fond d'internet : des scanners, trop peu insistants pour être bannis.
      expect(direct).toMatch(/Invalid user \w+ from (203\.0\.113|192\.0\.2|198\.51\.100)\.1\d\d /);
      expect(c.suivre(60)).not.toContain(ROBOT);
      expect(c.interrompre()).toBe('^C');
      expect(c.suit).toBe(false);
      expect(jouer(['tail -n 1 /var/log/fail2ban.log'])).toContain(`Ban ${ROBOT}`);
    });

    it('tail -f : le bannissement de 10 minutes expire, le robot revient et se fait rebannir', () => {
      const { c, jouer } = partie();
      jouer(['tail -f /var/log/fail2ban.log']);
      let direct = '';
      for (let i = 0; i < 40; i++) direct += c.suivre(20) + '\n';
      expect(direct).toContain(`Ban ${ROBOT}`);
      expect(direct).toContain(`Unban ${ROBOT}`);
      expect(direct).toContain('Unban 203.0.113.66');
      // Relâché, il recommence ; cinq échecs plus tard, le revoilà banni.
      expect(direct.lastIndexOf(`Ban ${ROBOT}`)).toBeGreaterThan(direct.indexOf(`Unban ${ROBOT}`));
      c.interrompre();
    });

    it('avec un bantime d’une heure, plus de va-et-vient', () => {
      const { c, jouer } = partie();
      c.executer('sudo nano /etc/fail2ban/jail.local');
      if (c.shell.attente) c.executer(machinesDansLaLangue(c.t, 'fourmis-2026'));
      c.enregistrer('[DEFAULT]\nbantime = 1h\nignoreip = 127.0.0.1/8 192.0.2.2 198.51.100.40\n');
      c.quitterEdition();
      jouer(['sudo systemctl reload fail2ban', 'tail -f /var/log/fail2ban.log']);
      let direct = '';
      for (let i = 0; i < 40; i++) direct += c.suivre(20) + '\n';
      expect(direct).not.toContain('Unban');
      c.interrompre();
    });

    it('l’instantané de secours rejoue aussi le temps passé à suivre', () => {
      const { c, jouer } = partie();
      jouer(['journalctl -fu ssh']);
      c.suivre(15);
      c.suivre(15);
      c.interrompre();
      const voulu = jouer(['sudo fail2ban-client status sshd', 'fourmis-2026']);
      expect(c.restaurer(c.pas! - 2)).toBe(true);
      expect(jouer(['sudo fail2ban-client status sshd', 'fourmis-2026'])).toBe(voulu);
    });
  });

for (const langue of LANGUES)
  describe(`Premier jour en direct — ${langue}`, () => {
    const effaceur = HISTOIRES.find((h) => h.id === 'effaceur')!.chapitres.map((c) => c.id);
    it('tail -f : le robot reçoit des 503 tant que le service sature, des 403 une fois bloqué', () => {
      const c = new Console({ langue, termines: effaceur });
      const jouer = (lignes: string[]) => lignes.map((l) => c.executer(machinesDansLaLangue(c.t, l)) ?? '').join('\n');
      jouer(['ssh datacenter', 'yes', 'tail -f /var/log/nginx/access.log']);
      expect(c.suit).toBe(true);
      expect(c.suivre(6)).toMatch(/^198\.51\.100\.77 .*"GET \/catalogue\/recherche\?q=\w+ HTTP\/1\.1" 503 197$/m);
      c.interrompre();
      jouer(['echo "deny 198.51.100.77;" | sudo tee -a /etc/nginx/blocked.conf', 'bienvenue-2026', 'sudo systemctl reload nginx', 'tail -f /var/log/nginx/access.log']);
      const apres = c.suivre(10);
      expect(apres).toMatch(/^198\.51\.100\.77 .* 403 153$/m);
      expect(apres).not.toMatch(/^198\.51\.100\.77 .* 503 /m);
      c.interrompre();
    });
  });

describe('Suivre un fichier', () => {
  const chapitre = (id: string) => HISTOIRES.flatMap((h) => h.chapitres).find((c) => c.id === id)!;

  it('sans activité, tail -f attend ; dans un tube, il affiche une fois sans suivre', () => {
    const s = new Shell(chapitre('deuxieme-jour'), 'fr');
    s.executer('tail -f /var/log/nginx/access.log');
    expect(s.suivi).not.toBeNull();
    expect(s.suivi!.lire()).toBe('');
    s.suivi = null;
    s.executer('tail -f /var/log/nginx/access.log | head -n 1');
    expect(s.suivi).toBeNull();
  });
});
