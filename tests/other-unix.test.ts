// The Other Unix: the film club's FreeBSD server. Replayed with the console,
// in every language.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { translator } from '../src/texts';
import { inLanguage, machinesInLanguage, languagesFor } from './names';
import { YESTERDAY } from '../src/engine/chapters/film-club';

const ERASER = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('other-unix')])];
const MDP = 'film-reel-2029';

for (const language of languagesFor('other-unix'))
  describe(`The Other Unix — ${language}`, () => {
    const fr = language === 'fr';
    const L = (line: string) => inLanguage(translator(language), line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...ERASER, ...finished] });
      const one = (l: string) => {
        let output = c.execute(machinesInLanguage(c.t, L(l))) ?? '';
        if (c.shell.waiting) output += '\n' + (c.execute(machinesInLanguage(c.t, MDP)) ?? '');
        return output;
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        one(command);
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      play(['ssh projector', 'yes']);
      return { c, play, edit, flag: (id: string) => c.shell.flags.has(id) };
    };

    // ——— Chapter 1: "The Script That Broke" ———
    it('chapter 1 — solution: each GNU habit fixed for BSD', () => {
      const { c, play, edit, flag } = part();
      expect(play(['uname'])).toContain('FreeBSD');
      expect(play(['./nightly-backup.sh'])).toContain('nightly-backup.sh: not found');
      expect(flag('not-found')).toBe(true);
      edit('nano nightly-backup.sh', (t) => t.replace('#!/bin/bash', '#!/bin/sh'));
      expect(play(['./nightly-backup.sh'])).toContain('date: illegal option -- d');
      const manual = play(['man date']);
      expect(manual).toContain('-v');
      contains(manual, 'FreeBSD');
      edit('nano nightly-backup.sh', (t) => t.replace('date -d yesterday', 'date -v-1d'));
      expect(play(['./nightly-backup.sh'])).toContain('stat: illegal option -- c');
      edit('nano nightly-backup.sh', (t) => t.replace('stat -c %s', 'stat -f %z'));
      expect(play(['./nightly-backup.sh'])).toContain('sed: 1: "/var/backups/state.conf": undefined label "ackups/state.conf"');
      expect(c.finished).not.toContain('portable-script');
      edit('nano nightly-backup.sh', (t) => t.replace('sed -i "', `sed -i '' "`));
      const all = play(['./nightly-backup.sh']);
      expect(all).toContain(`Backup of ${YESTERDAY} done`);
      contains(all, 'Bravo');
      expect(c.finished).toContain('portable-script');
      expect(play(['cat /var/backups/state.conf'])).toContain(`last=${YESTERDAY}`);
    });

    it('chapter 1 — false lead: making the archive by hand, without fixing the script', () => {
      const { c, play, edit } = part();
      play([`tar -czf /var/backups/site-${YESTERDAY}.tar.gz /usr/local/www/club`]);
      edit('nano /var/backups/state.conf', (t) => t.replace(/^last=.*$/m, `last=${YESTERDAY}`));
      play([`echo "Backup of ${YESTERDAY} done (1 bytes)."`, 'cat nightly-backup.sh']);
      expect(c.finished).not.toContain('portable-script');
      // The script, fixed, still has to run to its end.
      edit('nano nightly-backup.sh', (t) => t.replace('#!/bin/bash', '#!/bin/sh').replace('date -d yesterday', 'date -v-1d').replace('stat -c %s', 'stat -f %z').replace('sed -i "', `sed -i '' "`));
      expect(play(['sh nightly-backup.sh'])).toContain(`Backup of ${YESTERDAY} done`);
      expect(c.finished).toContain('portable-script');
    });

    it('chapter 1 — false leads: bash from pkg is not enough, Linux commands are not there', () => {
      const { c, play, edit } = part();
      expect(play(['systemctl status'])).toContain('systemctl: not found');
      play(['sudo pkg install -y bash']);
      edit('nano nightly-backup.sh', (t) => t.replace('#!/bin/bash', '#!/usr/local/bin/bash'));
      expect(play(['./nightly-backup.sh'])).toContain('date: illegal option -- d');
      expect(c.finished).not.toContain('portable-script');
    });

    // ——— Chapter 2: "No systemd Here" ———
    it('chapter 2 — solution: pkg, rc.conf, service, sockstat', () => {
      const { c, play, flag } = part(['portable-script']);
      expect(play(['sudo apt install nginx'])).toContain('apt: not found');
      play(['sudo pkg install nginx', 'y']);
      expect(flag('installed')).toBe(true);
      expect(play(['sudo service nginx start'])).toContain("Cannot 'start' nginx");
      expect(play(['sudo sysrc nginx_enable=YES'])).toContain('nginx_enable:  -> YES');
      expect(c.finished).not.toContain('rc-services');
      expect(play(['sudo service nginx start'])).toContain('Starting nginx.');
      expect(play(['sockstat -4l'])).toMatch(/nginx .*\*:80/);
      expect(c.finished).toContain('rc-services');
    });

    it('chapter 2 — false lead: onestart runs it, but not at the next boot', () => {
      const { c, play, flag } = part(['portable-script']);
      play(['sudo pkg install -y nginx', 'sudo service nginx onestart']);
      expect(flag('onestart')).toBe(true);
      expect(c.finished).not.toContain('rc-services');
      play(['sudo service nginx enable']);
      expect(c.finished).toContain('rc-services');
    });

    it('chapter 2 — BSD tools: ps -ef, ls --all, grep -P, find -printf, du -b', () => {
      const { c, play, flag } = part(['portable-script']);
      expect(play(['ps -ef'])).toContain('HOME=');
      expect(flag('ps-ef')).toBe(true);
      expect(play(['ps aux'])).toContain('/usr/sbin/sshd');
      expect(play(['ls --all'])).toContain('ls: unknown option -- all');
      expect(play(['grep -P "[0-9]" lucien-notes.txt'])).toContain('grep: unknown option -- P');
      expect(play(['find . -printf "%f"'])).toContain('find: -printf: unknown primary or operator');
      expect(play(['du -b lucien-notes.txt'])).toContain('du: illegal option -- b');
      const manual = play(['man ps']);
      expect(manual).toContain('ps -axj');
      expect(manual).not.toContain('systemctl(');
      expect(c.finished).not.toContain('rc-services');
    });

    // ——— Chapter 3: "The Last Rule Wins" ———
    const PF_GOOD = `block in all
pass in proto tcp to port { 22 80 }
pass out all keep state`;

    it('chapter 3 — solution: pf in its own order, enabled at boot', () => {
      const { c, play, edit, flag } = part(['portable-script', 'rc-services']);
      play(['cat /etc/pf.conf', 'sudo pfctl -nf /etc/pf.conf']);
      expect(flag('checked')).toBe(true);
      // Switched on as it is: the last rule (block in all) wins, ssh included.
      play(['sudo sysrc pf_enable=YES', 'sudo service pf start']);
      expect(flag('locked-out')).toBe(true);
      edit('sudo nano /etc/pf.conf', () => PF_GOOD);
      expect(c.finished).not.toContain('last-rule');
      play(['sudo pfctl -f /etc/pf.conf']);
      expect(play(['sudo pfctl -sr'])).toContain('block drop in all');
      expect(c.finished).toContain('last-rule');
      // From the workstation: 80 answers, 3306 no longer does.
      play(['exit']);
      expect(play(['nc -zv projector 80'])).toMatch(/succeeded|open/);
      expect(play(['nc -zv projector 3306'])).not.toMatch(/succeeded/);
    });

    it('chapter 3 — other solution: quick passes; false lead: not enabled at boot', () => {
      const { c, play, edit, flag } = part(['portable-script', 'rc-services']);
      edit('sudo nano /etc/pf.conf', (t) => t.replace('pass in proto tcp', 'pass in quick proto tcp'));
      play(['sudo pfctl -f /etc/pf.conf', 'sudo pfctl -e']);
      expect(flag('not-at-boot')).toBe(true);
      expect(c.finished).not.toContain('last-rule');
      play(['sudo sysrc pf_enable=YES']);
      expect(c.finished).toContain('last-rule');
    });
  });
