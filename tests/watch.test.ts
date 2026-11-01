// The Watch: the kneader server, six months after "The Audit". Replayed with
// the console, in every language.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { CVE } from '../src/engine/chapters/watch';

const ERASER = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('watch')])];
const MDP = 'sourdough-2028';

for (const language of LANGUAGES)
  describe(`The Watch — ${language}`, () => {
    const fr = language === 'fr';
    const L = (line: string) => inLanguage(translator(language), line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...ERASER, ...finished] });
      const one = (l: string) => {
        let output = c.execute(L(l)) ?? '';
        if (c.shell.waiting) output += '\n' + (c.execute(machinesInLanguage(c.t, MDP)) ?? '');
        return output;
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        one(command);
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      play(['ssh kneader', 'yes']);
      return { c, jouer: play, editer: edit };
    };

    // ——— Chapter 1: "The bulletin" ———
    const DOC_WATCH = () => `# ${fr ? 'Veille' : 'Watch'} — ${fr ? 'Le Fournil' : 'The Bakery'}

## ${fr ? 'Concerne ce serveur' : 'Concerns this server'}
${CVE.nginx.id} (nginx), ${CVE.rsync.id} (rsync), ${CVE.ssh.id} (openssh-server) — ${fr ? 'déjà protégé par la configuration' : 'already protected by the configuration'}.

## ${fr ? 'Sans objet' : 'Not applicable'}
${CVE.certbot.id} (python3-certbot-nginx) : ${fr ? "n'est pas installé sur ce serveur" : 'is not installed on this server'}.
${CVE.curl.id} (curl) : ${fr ? 'déjà corrigé, la version installée est au-delà de la version corrigée' : 'already fixed, the installed version is past the fixed version'}.`;

    it('chapter 1 — solution: sort the bulletin, the rest not applicable', () => {
      const { c, jouer: play, editer: edit } = part();
      let all = play(['cat security_bulletin.txt']);
      contains(all, 'BULLETIN DE SÉCURITÉ');
      all = play(['apt list --installed']);
      expect(all).not.toContain('certbot');
      const review = edit('nano watch.md', (t) => t.replace(/\(à compléter[^\n]*|\(to complete[^\n]*/g, 'x'));
      contains(review, 'Salomé relit ton tri');
      expect(c.finished).not.toContain('bulletin');
      edit('nano watch.md', DOC_WATCH);
      expect(c.finished).toContain('bulletin');
    });

    it('chapter 1 — false leads: certbot or curl classed as "concerns us"', () => {
      const { c, editer: edit } = part();
      const bad = () => `# ${fr ? 'Veille' : 'Watch'}
## ${fr ? 'Concerne ce serveur' : 'Concerns this server'}
${CVE.nginx.id}, ${CVE.rsync.id}, ${CVE.ssh.id}, ${CVE.certbot.id}, ${CVE.curl.id}
## ${fr ? 'Sans objet' : 'Not applicable'}
${fr ? 'nothing' : 'nothing'}`;
      edit('nano watch.md', bad);
      expect(c.finished).not.toContain('bulletin');
    });

    // ——— Chapter 2: "The priority" ———
    const DOC_PRIORITY = (inverse = false) => {
      const ids = inverse ? [CVE.rsync.id, CVE.nginx.id] : [CVE.nginx.id, CVE.rsync.id];
      return `# ${fr ? 'Priorité' : 'Priority'}
1. ${ids[0]} — ${fr ? 'joignable depuis internet (80, 443)' : 'reachable from the internet (80, 443)'}
2. ${ids[1]} — ${fr ? "aucun port en écoute, c'est un outil local" : 'no port at all, a local tool'}
${CVE.ssh.id} (openssh-server) : ${fr ? 'déjà protégé (KbdInteractiveAuthentication à no), rien à faire' : 'already protected (KbdInteractiveAuthentication set to no), nothing to do'}`;
    };

    it('chapter 2 — solution: nginx before rsync, with the reason why', () => {
      const { c, jouer: play, editer: edit } = part(['bulletin']);
      const all = play(['ss -tlnp']);
      expect(all).toContain(':80');
      expect(all.split('\n').filter((l) => l.startsWith('LISTEN')).join('\n')).not.toContain('rsync');
      edit('nano priority.md', () => DOC_PRIORITY(false));
      expect(c.finished).toContain('priority');
    });

    it('chapter 2 — false lead: ranking by score alone (rsync before nginx)', () => {
      const { c, jouer: play, editer: edit } = part(['bulletin']);
      const e = (id: string) => c.shell.flags.has(id);
      play(['nmap -sV kneader.internal']);
      edit('nano priority.md', () => DOC_PRIORITY(true));
      expect(e('score-only') || !c.finished.includes('priority')).toBe(true);
      expect(c.finished).not.toContain('priority');
      edit('nano priority.md', () => DOC_PRIORITY(false));
      expect(c.finished).toContain('priority');
    });

    // ——— Chapter 3: "The fix" ———
    it('chapter 3 — solution: apt update then upgrade, the site holds', () => {
      const { c, jouer: play } = part(['bulletin', 'priority']);
      let all = play(['sudo apt upgrade']);
      expect(all).toContain('Upgrading: 0');
      expect(c.finished).not.toContain('fix');
      play(['sudo apt update', 'sudo apt upgrade -y']);
      all = play(['curl -I http://bakery.example/']);
      expect(all).toContain('200');
      expect(c.finished).toContain('fix');
    });

    // ——— Chapter 4: "Without proof, no certainty" ———
    it('chapter 4 — solution: apt confirms, the attempt is found in the log', () => {
      const { c, jouer: play } = part(['bulletin', 'priority', 'fix']);
      let all = play(['apt list --upgradable']);
      expect(all).toContain('Listing... Done');
      expect(c.finished).not.toContain('proof');
      all = play(['grep "HTTP/2" /var/log/nginx/access.log']);
      expect(all).toContain('203.0.113.77');
      play(['curl -I http://bakery.example/']);
      expect(c.finished).toContain('proof');
    });

    // ——— Chapter 5: "Keeping watch" ———
    const TWENTY_ACTIVE = (t: string) => t.replace('"0"', '"1"').replace('"0"', '"1"');
    const restrict = (t: string) =>
      t
        .replace(/^(\s*"origin=\$\{distro_codename\},label=Debian";)$/m, '//$1')
        .replace(/^(\s*)"origin=Debian,codename=\$\{distro_codename\},label=Debian";$/m, '$1//"origin=Debian,codename=${distro_codename},label=Debian";')
        .replace('//Unattended-Upgrade::Mail "";', 'Unattended-Upgrade::Mail "root";');

    it('chapter 5 — solution: unattended-upgrades restricted to security, a weekly cron job', () => {
      const { c, jouer: play, editer: edit } = part(['bulletin', 'priority', 'fix', 'proof']);
      edit('sudo nano /etc/apt/apt.conf.d/20auto-upgrades', TWENTY_ACTIVE);
      expect(c.finished).not.toContain('routine');
      edit('sudo nano /etc/apt/apt.conf.d/50unattended-upgrades', restrict);
      expect(c.finished).not.toContain('routine');
      edit('sudo crontab -e', (t) => `${t}\n0 9 * * 1 apt list --upgradable | mail -s "Weekly watch" root\n`);
      expect(c.finished).toContain('routine');
    });

    it('chapter 5 — another way: a systemd timer rather than a cron job', () => {
      const { c, jouer: play, editer: edit } = part(['bulletin', 'priority', 'fix', 'proof']);
      edit('sudo nano /etc/apt/apt.conf.d/20auto-upgrades', TWENTY_ACTIVE);
      edit('sudo nano /etc/apt/apt.conf.d/50unattended-upgrades', restrict);
      edit(
        'sudo nano /etc/systemd/system/weekly-watch.service',
        () => '[Unit]\nDescription=Weekly watch\n\n[Service]\nType=oneshot\nExecStart=/bin/sh -c "apt list --upgradable | mail -s Watch root"\n',
      );
      edit(
        'sudo nano /etc/systemd/system/weekly-watch.timer',
        () => '[Unit]\nDescription=Weekly watch\n\n[Timer]\nOnCalendar=weekly\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n',
      );
      play(['sudo systemctl enable --now weekly-watch.timer']);
      expect(c.finished).toContain('routine');
    });

    it('chapter 5 — false leads: active without restricting to security, no schedule', () => {
      const { c, jouer: play, editer: edit } = part(['bulletin', 'priority', 'fix', 'proof']);
      const e = (id: string) => c.shell.flags.has(id);
      edit('sudo nano /etc/apt/apt.conf.d/20auto-upgrades', TWENTY_ACTIVE);
      expect(e('active')).toBe(true);
      expect(e('security')).toBe(false);
      edit('sudo nano /etc/apt/apt.conf.d/50unattended-upgrades', restrict);
      expect(e('security')).toBe(true);
      expect(c.finished).not.toContain('routine');
    });
  });
