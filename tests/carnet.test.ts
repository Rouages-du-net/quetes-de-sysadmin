// Le carnet du sysadmin : les commandes lancées une première fois, leur ligne
// du manuel, la première ligne tapée, et l'export en Markdown.

import { describe, expect, it } from 'vitest';
import { machinesDansLaLangue } from './noms';
import { prerequis } from '../src/moteur/deverrouillage';
import { Console } from '../src/moteur/console';
import { enMarkdown, noter, description, type Carnet } from '../src/moteur/carnet';
import { traducteur, LANGUES } from '../src/textes';
import { fiches } from '../src/moteur/fiches';
import { HISTOIRES } from '../src/moteur/chapitres';

for (const langue of LANGUES)
  describe(`Le carnet — ${langue}`, () => {
    const t = traducteur(langue);
    const partie = () => {
      const c = new Console({ langue });
      const carnet: Carnet = {};
      const jouer = (ligne: string) => {
        const sh = c.shell;
        const sortie = c.executer(machinesDansLaLangue(c.t, ligne));
        noter(carnet, sh);
        return sortie;
      };
      return { c, carnet, jouer };
    };

    it('note chaque commande une seule fois, avec sa première ligne et son chapitre', () => {
      const { carnet, jouer } = partie();
      jouer('ls -a | cat');
      jouer('ls');
      jouer('head -n 2 bienvenue.txt');
      jouer('ssh royaume');
      jouer('yes');
      jouer('pwd');
      expect(Object.keys(carnet).sort()).toEqual(['cat', 'ls', 'pwd', 'ssh']);
      expect(carnet.ls).toEqual({ ligne: 'ls -a | cat', chapitre: '' });
      expect(carnet.cat.ligne).toBe('ls -a | cat');
      // head n'existe pas encore sur le poste : il n'entre pas au carnet.
      expect(carnet.head).toBeUndefined();
      expect(carnet.pwd.chapitre).toBe('eveil');
    });

    it("ignore ce qui n'est pas une commande du jeu, mais garde man", () => {
      const { carnet, jouer } = partie();
      jouer('frobnicate --now');
      jouer('man ls');
      jouer('sshd_config');
      expect(Object.keys(carnet)).toEqual(['man']);
    });

    it('exporte en Markdown, trié, avec la ligne du manuel', () => {
      const { carnet, jouer } = partie();
      jouer('pwd');
      jouer('ls');
      const md = enMarkdown(carnet, t);
      expect(md.indexOf('## ls')).toBeLessThan(md.indexOf('## pwd'));
      expect(md).toContain('```\nls\n```');
      expect(md).toContain(`${description('ls', t)}.`);
      expect(md).toContain('man ls');
    });
  });

describe('Le carnet et la progression', () => {
  const t = traducteur('fr');
  it('le Markdown commence par les chapitres terminés, histoire par histoire', () => {
    const md = enMarkdown({}, t, ['eveil', 'bourg', 'fermer-la-porte']);
    expect(md).toContain('## Progression');
    expect(md).toMatch(/- L.Effaceur : 2 chapitres terminés sur 4/);
    expect(md).toMatch(/- Les Lettres du quartier : 1 chapitre terminé sur 8/);
    expect(md).toContain('Fermer la porte');
    expect(enMarkdown({}, t, [])).toContain('Aucun chapitre terminé');
  });
});

describe('Les fiches pour les enseignant·es', () => {
  it('chaque chapitre a sa fiche, ses commandes nouvelles une seule fois, une durée', () => {
    const toutes = fiches();
    expect(toutes.length).toBe(HISTOIRES.flatMap((h) => h.chapitres).length);
    const vues = toutes.flatMap((f) => f.nouvelles);
    expect(new Set(vues).size).toBe(vues.length);
    expect(toutes.find((f) => f.chapitre.id === 'eveil')!.nouvelles).toContain('ls');
    expect(toutes.find((f) => f.chapitre.id === 'goulot')!.nouvelles).toContain('iostat');
    expect(toutes.find((f) => f.chapitre.id === 'bourg')!.avant?.id).toBe('eveil');
    expect(toutes.every((f) => f.duree >= 15 && f.duree % 5 === 0)).toBe(true);
  });
});

describe('Le mode examen', () => {
  it("sans indice, mais l'étape finale et son débrief s'affichent", () => {
    const c = new Console({ langue: 'fr', termines: ['eveil', 'bourg', 'racine', 'sauvegarde', ...prerequis('lettres')] });
    c.examen = true;
    const jouer = (lignes: string[]) => lignes.map((l) => c.executer(machinesDansLaLangue(c.t, l)) ?? '').join('\n');
    // La Porte, avec la configuration de sshd : la faute de frappe ne donne plus d'indice.
    let tout = jouer(['ssh lettres', 'yes']);
    c.executer('sudo nano /etc/ssh/sshd_config');
    c.executer(machinesDansLaLangue(c.t, 'fourmis-2026'));
    c.enregistrer(c.edition!.texte.replace('PermitRootLogin yes', 'PermitRootLogin non'));
    tout += c.quitterEdition();
    tout += jouer(['sudo sshd -t']);
    expect(tout).toContain('unsupported option "non"');
    expect(tout).not.toContain('Il y a une erreur dans la configuration de SSH');
    c.executer('sudo nano /etc/ssh/sshd_config.d/00-hardening.conf');
    c.enregistrer('PermitRootLogin no\nPasswordAuthentication no\n');
    c.quitterEdition();
    c.executer('sudo nano /etc/ssh/sshd_config');
    c.enregistrer(c.edition!.texte.replace('PermitRootLogin non', 'PermitRootLogin no'));
    c.quitterEdition();
    tout = jouer(['sudo systemctl reload ssh', 'exit', 'ssh lettres']);
    expect(tout).toContain('https://man.openbsd.org/sshd_config');
    expect(c.termines).toContain('fermer-la-porte');
  });
});
