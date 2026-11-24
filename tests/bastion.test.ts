// The Bastion: an incident on the Bakery's delivery server, handled in four
// steps (detect, contain, eradicate, harden). Replayed with the console, in
// every language.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { translator } from '../src/texts';
import { inLanguage, machinesInLanguage, languagesFor } from './names';
import { ATTACKER, POOL, deployKeys } from '../src/engine/chapters/bastion';

const ERASER = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('bastion')])];
const MDP = 'sandwich-loaf-2029';

for (const language of languagesFor('bastion'))
  describe(`The Bastion — ${language}`, () => {
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
      play(['ssh oven', 'yes']);
      return { c, play, edit, flag: (id: string) => c.shell.flags.has(id) };
    };

    // ——— Chapter 1: "The Alarm" ———
    const NOTE = `# Incident
/tmp/.cache/kworkerd (deploy) -> ${POOL}:3333
deploy, password, from ${ATTACKER}, 13/04 02:40`;

    it('chapter 1 — solution: what runs, where it talks to, how it got in, noted', () => {
      const { c, play, edit } = part();
      let all = play(['ps aux']);
      expect(all).toContain('/tmp/.cache/kworkerd');
      all = play(['ss -tn']);
      expect(all).toContain(`${POOL}:3333`);
      expect(all).not.toContain('kworkerd');
      all = play(['sudo ss -tnp']);
      expect(all).toContain('kworkerd');
      all = play(['sudo netstat -tnp']);
      expect(all).toContain(`${POOL}:3333`);
      all = play(['sudo journalctl -u ssh']);
      expect(all).toContain(`Accepted password for deploy from ${ATTACKER}`);
      all = play(['last']);
      expect(all).toContain(ATTACKER);
      expect(c.finished).not.toContain('alarm');
      const end = edit('nano incident.md', () => NOTE);
      contains(end, 'Bravo');
      expect(c.finished).toContain('alarm');
    });

    it('chapter 1 — false lead: a note without how it got in', () => {
      const { c, play, edit } = part();
      play(['ps aux', 'sudo ss -tnp', 'sudo journalctl -u ssh']);
      edit('nano incident.md', () => `/tmp/.cache/kworkerd -> ${POOL}:3333`);
      expect(c.finished).not.toContain('alarm');
    });

    // ——— Chapter 2: "Containment" ———
    it('chapter 2 — solution: cut, stop in order, close deploy', () => {
      const { c, play, flag } = part(['alarm']);
      play([`sudo iptables -A OUTPUT -d ${POOL} -j DROP`, `sudo iptables -A INPUT -s ${ATTACKER} -j DROP`]);
      expect(flag('pool')).toBe(true);
      expect(flag('attacker')).toBe(true);
      // The miner alone comes back: the watchdog restarts it.
      play(['sudo killall kworkerd']);
      expect(flag('respawn')).toBe(true);
      let all = play(['ps -ef']);
      expect(all).toContain('kworkerd');
      play(['sudo kill 4410', 'sudo killall kworkerd']);
      all = play(['ps aux']);
      expect(all).not.toContain('.cache');
      // -L alone isn't enough.
      play(['sudo usermod -L deploy']);
      expect(flag('password-only')).toBe(true);
      expect(c.finished).not.toContain('containment');
      play(['sudo usermod -e 1 deploy']);
      expect(c.finished).toContain('containment');
    });

    it('chapter 2 — false leads: locked out, the app killed and relaunching the miner', () => {
      const { c, play, flag } = part(['alarm']);
      play(['sudo iptables -P INPUT DROP']);
      expect(flag('locked-out')).toBe(true);
      play(['sudo iptables -P INPUT ACCEPT']);
      play([`sudo iptables -A OUTPUT -d ${POOL} -j DROP`, `sudo iptables -A INPUT -s ${ATTACKER} -j DROP`, 'sudo chage -E 0 deploy']);
      // Everything of deploy's: the app goes too.
      play(['sudo killall -u deploy']);
      expect(flag('app-down')).toBe(true);
      expect(c.finished).not.toContain('containment');
      // Starting it again relaunches the watchdog and the miner (the tampered server.js).
      play(['sudo systemctl start delivery']);
      expect(flag('relaunched')).toBe(true);
      expect(c.finished).not.toContain('containment');
      const all = play(['ps -ef']);
      const watchdog = /^deploy\s+(\d+).*\/bin\/sh \/tmp\/\.cache\/\.w/m.exec(all)![1];
      play([`sudo kill -STOP ${watchdog}`, 'sudo killall kworkerd', `sudo kill -9 ${watchdog}`]);
      expect(c.finished).toContain('containment');
    });

    // ——— Chapter 3: "Eradication" ———
    const removeIntruder = (t: string) => t.split('\n').filter((l) => !l.includes(deployKeys().intruder.split(' ')[1])).join('\n');

    it('chapter 3 — solution: crontab, key, files, signed release', () => {
      const { c, play, edit, flag } = part(['alarm', 'containment']);
      edit('sudo crontab -u deploy -e', (t) => t.replace(/^@reboot.*$/m, ''));
      expect(flag('cron')).toBe(true);
      const all = play(['sudo ssh-keygen -lf /home/deploy/.ssh/authorized_keys']);
      expect(all).toContain('deploy@ci-runner');
      edit('sudo nano /home/deploy/.ssh/authorized_keys', removeIntruder);
      expect(flag('key')).toBe(true);
      play(['sudo rm /tmp/.cache/kworkerd /tmp/.cache/.w']);
      expect(flag('files')).toBe(true);
      expect(play(['sudo find /srv/delivery -type f -mtime -3'])).toContain('server.js');
      expect(play(['sudo gpg --verify /home/deploy/delivery-2.3.1.tar.gz.asc /home/deploy/delivery-2.3.1.tar.gz'])).toContain('BAD signature');
      expect(play(['gpg --verify /srv/releases/delivery-2.3.1.tar.gz.asc /srv/releases/delivery-2.3.1.tar.gz'])).toContain('Good signature');
      expect(c.finished).not.toContain('eradication');
      play(['sudo tar -xzf /srv/releases/delivery-2.3.1.tar.gz -C /srv']);
      expect(flag('restored')).toBe(true);
      expect(c.finished).toContain('eradication');
      play(['sudo systemctl restart delivery']);
      expect(play(['ps aux'])).not.toContain('.cache');
    });

    it('chapter 3 — false leads: crontab -r, the rebuilt copy, emptying the keys', () => {
      const { c, play, edit, flag } = part(['alarm', 'containment']);
      play(['sudo crontab -u deploy -r']);
      expect(flag('cron-all')).toBe(true);
      play(['sudo tar -xzf /home/deploy/delivery-2.3.1.tar.gz -C /srv', 'sudo rm /tmp/.cache/kworkerd /tmp/.cache/.w']);
      expect(flag('restored')).toBe(false);
      edit('sudo nano /home/deploy/.ssh/authorized_keys', () => '');
      expect(flag('key-all')).toBe(true);
      expect(c.finished).not.toContain('eradication');
    });

    // ——— Chapter 4: "Hardening" ———
    const FIREWALL = [
      'sudo iptables -A INPUT -i lo -j ACCEPT',
      'sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT',
      'sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT',
      'sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT',
      'sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT',
      'sudo iptables -P INPUT DROP',
    ];

    it('chapter 4 — solution: the drop-in, default-deny saved, deploy by key', () => {
      const { c, play, flag } = part(['alarm', 'containment', 'eradication']);
      let all = play(['sudo sshd -T']);
      expect(all).toContain('passwordauthentication yes');
      expect(flag('looked')).toBe(true);
      play(['sudo rm /etc/ssh/sshd_config.d/50-delivery.conf']);
      expect(flag('not-reloaded')).toBe(true);
      play(['sudo systemctl reload ssh']);
      expect(flag('passwords')).toBe(true);
      play(FIREWALL);
      expect(flag('firewall')).toBe(true);
      all = play(['sudo iptables-save | sudo tee /etc/iptables/rules.v4']);
      expect(all).toContain(':INPUT DROP');
      expect(flag('saved')).toBe(true);
      expect(c.finished).not.toContain('hardening');
      play(['sudo usermod -e "" deploy']);
      expect(c.finished).toContain('hardening');
    });

    it('chapter 4 — false leads: no loopback, a redirection as yourself, the main file', () => {
      const { c, play, flag, edit } = part(['alarm', 'containment', 'eradication']);
      edit('sudo nano /etc/ssh/sshd_config', (t) => t.replace('PasswordAuthentication no', 'PasswordAuthentication no\n# checked'));
      play(['sudo systemctl reload ssh']);
      expect(flag('passwords')).toBe(false);
      play(FIREWALL.filter((l) => !l.includes(' lo ')));
      expect(flag('no-loopback')).toBe(true);
      const all = play(['sudo iptables-save > /etc/iptables/rules.v4']);
      expect(all).toMatch(/Permission denied|Permission non accordée/);
      expect(c.finished).not.toContain('hardening');
    });
  });
