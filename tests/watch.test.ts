// La Veille : le serveur petrin, six mois après « L'Audit ». Rejoué avec la
// console, dans chaque langue.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage } from './names';
import { CVE } from '../src/engine/chapters/watch';

const ERASER = [...new Set([...STORIES.find((h) => h.id === 'effaceur')!.chapters.map((c) => c.id), ...prerequisites('veille')])];
const MDP = 'levain-2028';

for (const language of LANGUAGES)
  describe(`La Veille — ${language}`, () => {
    const fr = language === 'fr';
    const L = (line: string) => inLanguage(translator(language), line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...ERASER, ...finished] });
      const one = (l: string) => {
        let output = c.execute(L(l)) ?? '';
        if (c.shell.waiting) output += '\n' + (c.execute(MDP) ?? '');
        return output;
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        one(command);
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      play(['ssh petrin', 'yes']);
      return { c, jouer: play, editer: edit };
    };

    // ——— Chapitre 1 : « Le bulletin » ———
    const DOC_WATCH = () => `# ${fr ? 'Veille' : 'Watch'} — ${fr ? 'Le Fournil' : 'The Bakery'}

## ${fr ? 'Concerne ce serveur' : 'Concerns this server'}
${CVE.nginx.id} (nginx), ${CVE.rsync.id} (rsync), ${CVE.ssh.id} (openssh-server) — ${fr ? 'déjà protégé par la configuration' : 'already protected by the configuration'}.

## ${fr ? 'Sans objet' : 'Not applicable'}
${CVE.certbot.id} (python3-certbot-nginx) : ${fr ? "n'est pas installé sur ce serveur" : 'is not installed on this server'}.
${CVE.curl.id} (curl) : ${fr ? 'déjà corrigé, la version installée est au-delà de la version corrigée' : 'already fixed, the installed version is past the fixed version'}.`;

    it('chapitre 1 — solution : trier le bulletin, le reste sans objet', () => {
      const { c, jouer: play, editer: edit } = part();
      let all = play(['cat bulletin-securite.txt']);
      contains(all, 'BULLETIN DE SÉCURITÉ');
      all = play(['apt list --installed']);
      expect(all).not.toContain('certbot');
      const review = edit('nano veille.md', (t) => t.replace(/\(à compléter[^\n]*|\(to complete[^\n]*/g, 'x'));
      contains(review, 'Salomé relit ton tri');
      expect(c.finished).not.toContain('bulletin');
      edit('nano veille.md', DOC_WATCH);
      expect(c.finished).toContain('bulletin');
    });

    it('chapitre 1 — fausses pistes : certbot ou curl classés « concerne »', () => {
      const { c, editer: edit } = part();
      const bad = () => `# ${fr ? 'Veille' : 'Watch'}
## ${fr ? 'Concerne ce serveur' : 'Concerns this server'}
${CVE.nginx.id}, ${CVE.rsync.id}, ${CVE.ssh.id}, ${CVE.certbot.id}, ${CVE.curl.id}
## ${fr ? 'Sans objet' : 'Not applicable'}
${fr ? 'rien' : 'nothing'}`;
      edit('nano veille.md', bad);
      expect(c.finished).not.toContain('bulletin');
    });

    // ——— Chapitre 2 : « La priorité » ———
    const DOC_PRIORITY = (inverse = false) => {
      const ids = inverse ? [CVE.rsync.id, CVE.nginx.id] : [CVE.nginx.id, CVE.rsync.id];
      return `# ${fr ? 'Priorité' : 'Priority'}
1. ${ids[0]} — ${fr ? 'joignable depuis internet (80, 443)' : 'reachable from the internet (80, 443)'}
2. ${ids[1]} — ${fr ? "aucun port en écoute, c'est un outil local" : 'no port at all, a local tool'}
${CVE.ssh.id} (openssh-server) : ${fr ? 'déjà protégé (KbdInteractiveAuthentication à no), rien à faire' : 'already protected (KbdInteractiveAuthentication set to no), nothing to do'}`;
    };

    it('chapitre 2 — solution : nginx avant rsync, avec pourquoi', () => {
      const { c, jouer: play, editer: edit } = part(['bulletin']);
      const all = play(['ss -tlnp']);
      expect(all).toContain(':80');
      expect(all.split('\n').filter((l) => l.startsWith('LISTEN')).join('\n')).not.toContain('rsync');
      edit('nano priorite.md', () => DOC_PRIORITY(false));
      expect(c.finished).toContain('priorite');
    });

    it('chapitre 2 — fausse piste : classer par score seul (rsync avant nginx)', () => {
      const { c, jouer: play, editer: edit } = part(['bulletin']);
      const e = (id: string) => c.shell.flags.has(id);
      play(['nmap -sV petrin.internal']);
      edit('nano priorite.md', () => DOC_PRIORITY(true));
      expect(e('score-seul') || !c.finished.includes('priorite')).toBe(true);
      expect(c.finished).not.toContain('priorite');
      edit('nano priorite.md', () => DOC_PRIORITY(false));
      expect(c.finished).toContain('priorite');
    });

    // ——— Chapitre 3 : « Le correctif » ———
    it('chapitre 3 — solution : apt update puis upgrade, le site tient', () => {
      const { c, jouer: play } = part(['bulletin', 'priorite']);
      let all = play(['sudo apt upgrade']);
      expect(all).toContain('Upgrading: 0');
      expect(c.finished).not.toContain('correctif');
      play(['sudo apt update', 'sudo apt upgrade -y']);
      all = play(['curl -I http://fournil.example/']);
      expect(all).toContain('200');
      expect(c.finished).toContain('correctif');
    });

    // ——— Chapitre 4 : « Sans preuve, pas de certitude » ———
    it('chapitre 4 — solution : apt confirme, la tentative est trouvée dans le journal', () => {
      const { c, jouer: play } = part(['bulletin', 'priorite', 'correctif']);
      let all = play(['apt list --upgradable']);
      expect(all).toContain('Listing... Done');
      expect(c.finished).not.toContain('preuve');
      all = play(['grep "HTTP/2" /var/log/nginx/access.log']);
      expect(all).toContain('203.0.113.77');
      play(['curl -I http://fournil.example/']);
      expect(c.finished).toContain('preuve');
    });

    // ——— Chapitre 5 : « Mettre en veille » ———
    const TWENTY_ACTIVE = (t: string) => t.replace('"0"', '"1"').replace('"0"', '"1"');
    const restrict = (t: string) =>
      t
        .replace(/^(\s*"origin=\$\{distro_codename\},label=Debian";)$/m, '//$1')
        .replace(/^(\s*)"origin=Debian,codename=\$\{distro_codename\},label=Debian";$/m, '$1//"origin=Debian,codename=${distro_codename},label=Debian";')
        .replace('//Unattended-Upgrade::Mail "";', 'Unattended-Upgrade::Mail "root";');

    it('chapitre 5 — solution : unattended-upgrades restreint à la sécurité, une tâche cron hebdomadaire', () => {
      const { c, jouer: play, editer: edit } = part(['bulletin', 'priorite', 'correctif', 'preuve']);
      edit('sudo nano /etc/apt/apt.conf.d/20auto-upgrades', TWENTY_ACTIVE);
      expect(c.finished).not.toContain('routine');
      edit('sudo nano /etc/apt/apt.conf.d/50unattended-upgrades', restrict);
      expect(c.finished).not.toContain('routine');
      edit('sudo crontab -e', (t) => `${t}\n0 9 * * 1 apt list --upgradable | mail -s "Veille hebdomadaire" root\n`);
      expect(c.finished).toContain('routine');
    });

    it('chapitre 5 — une autre voie : un timer systemd plutôt qu\'une tâche cron', () => {
      const { c, jouer: play, editer: edit } = part(['bulletin', 'priorite', 'correctif', 'preuve']);
      edit('sudo nano /etc/apt/apt.conf.d/20auto-upgrades', TWENTY_ACTIVE);
      edit('sudo nano /etc/apt/apt.conf.d/50unattended-upgrades', restrict);
      edit(
        'sudo nano /etc/systemd/system/veille.service',
        () => '[Unit]\nDescription=Veille hebdomadaire\n\n[Service]\nType=oneshot\nExecStart=/bin/sh -c "apt list --upgradable | mail -s Veille root"\n',
      );
      edit(
        'sudo nano /etc/systemd/system/veille.timer',
        () => '[Unit]\nDescription=Veille hebdomadaire\n\n[Timer]\nOnCalendar=weekly\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n',
      );
      play(['sudo systemctl enable --now veille.timer']);
      expect(c.finished).toContain('routine');
    });

    it('chapitre 5 — fausses pistes : actif sans restreindre à la sécurité, aucun rendez-vous', () => {
      const { c, jouer: play, editer: edit } = part(['bulletin', 'priorite', 'correctif', 'preuve']);
      const e = (id: string) => c.shell.flags.has(id);
      edit('sudo nano /etc/apt/apt.conf.d/20auto-upgrades', TWENTY_ACTIVE);
      expect(e('active')).toBe(true);
      expect(e('securite')).toBe(false);
      edit('sudo nano /etc/apt/apt.conf.d/50unattended-upgrades', restrict);
      expect(e('securite')).toBe(true);
      expect(c.finished).not.toContain('routine');
    });
  });
