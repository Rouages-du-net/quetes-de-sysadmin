// The Canteen: systemd's dependencies on the solidarity canteen's server.
// Each chapter is replayed to the end, with another solution and false
// leads, in each language; the expected texts are checked in French. Also:
// the unit files as systemd reads them (empty assignments, drop-ins),
// systemd-analyze's durations and verify's messages, the boot's order.

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { analyzeDuration, readSeconds } from '../src/engine/units';
import { systemd } from '../src/engine/systemd';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const MDP = 'lentils-2028';

describe('Units and boot timing', () => {
  it('durations like systemd-analyze, RestartSec= values', () => {
    expect(analyzeDuration(702)).toBe('702ms');
    expect(analyzeDuration(1906)).toBe('1.906s');
    expect(analyzeDuration(120_008)).toBe('2min 0.008s');
    expect(analyzeDuration(5000)).toBe('5s');
    expect(readSeconds('5s')).toBe(5000);
    expect(readSeconds('5')).toBe(5000);
    expect(readSeconds('500ms')).toBe(500);
    expect(readSeconds('2min')).toBe(120_000);
  });
});

for (const language of LANGUAGES)
  describe(`The Canteen — ${language}`, () => {
    const fr = language === 'fr';
    const L = (line: string) => inLanguage(translator(language), machinesInLanguage(translator(language), line));
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    // A game: each line (written with the English names), with sudo's password if asked for.
    function part(id: string) {
      const s = new Shell(chapter(id), language);
      const one = (l: string) => {
        let output = s.execute(L(l)) ?? '';
        if (s.waiting) output += '\n' + (s.execute(machinesInLanguage(s.t, MDP)) ?? '');
        const errors = s.recoverErrors();
        return [output, ...errors].filter(Boolean).join('\n');
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      // An editor opened by a command (nano, systemctl edit): the text changed, saved, closed.
      const edit = (command: string, change: (text: string) => string) => {
        one(command);
        s.saveEdition(change(s.edition!.text));
        return s.quitEdition();
      };
      return { s, play, edit, sd: () => systemd(s)! };
    }
    // systemctl edit's template: the lines go above the "Edits below…" comment.
    const dropIn = (lines: string) => (text: string) => text.replace('\n\n\n', `\n${lines}\n\n`);

    it('the machine is reached from the workstation', () => {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('canteen')] });
      c.execute(L('ssh canteen'));
      c.execute('yes');
      expect(c.remote?.shell.chapter.id).toBe('boot-order');
    });

    it('chapter 1 — solution: the journal, the unit, After= and Requires= in a drop-in, a reboot', () => {
      const { s, play, edit, sd } = part('boot-order');
      let all = play(['cat message_from_ibrahim.txt', 'systemctl status menu', 'journalctl -b -u menu']);
      expect(all).toContain('Error: connect ECONNREFUSED 127.0.0.1:5432');
      expect(all).toContain('Active: failed (Result: exit-code)');
      contains(all, 'et personne');
      all = play(['systemctl cat menu', 'systemctl list-dependencies menu']);
      expect(all).toContain('# /etc/systemd/system/menu.service');
      expect(all).toContain('ExecStart=/usr/bin/node server.js');
      all = edit('sudo systemctl edit menu', dropIn('[Unit]\nAfter=postgresql.service\nRequires=postgresql.service'));
      contains(all, 'après PostgreSQL');
      all = play(['systemctl list-dependencies --after menu', 'systemctl cat menu']);
      expect(all).toContain('└─postgresql.service');
      expect(all).toContain('# /etc/systemd/system/menu.service.d/override.conf');
      expect(s.finished).toBe(false);
      all = play(['sudo reboot', 'systemctl status menu']);
      expect(all).toContain('Active: active (running)');
      expect(all).toContain('Drop-In: /etc/systemd/system/menu.service.d');
      contains(all, 'Tu as terminé le chapitre');
      contains(all, 'DÉPENDANCE OU ORDRE');
      expect(sd().services.postgresql.state).toBe('active');
      expect(s.finished).toBe(true);
    });

    it('chapter 1 — another way: Wants= and After= in the unit file, daemon-reload', () => {
      const { s, play, edit } = part('boot-order');
      edit('sudo nano /etc/systemd/system/menu.service', (t) => t.replace('[Service]', 'Wants=postgresql.service\nAfter=postgresql.service\n\n[Service]'));
      let all = play(['systemctl status menu']);
      expect(all).toContain("Warning: The unit file, source configuration file or drop-ins of menu.service changed on disk. Run 'systemctl daemon-reload' to reload units.");
      all = play(['sudo systemctl daemon-reload', 'sudo reboot', 'systemctl --failed']);
      expect(all).toContain('0 loaded units listed.');
      expect(s.finished).toBe(true);
    });

    it('chapter 1 — false leads: started by hand, Requires= without After=, a wrong unit name', () => {
      const { s, play, edit, sd } = part('boot-order');
      // By hand: it works, but nothing is fixed.
      let all = play(['sudo systemctl start menu']);
      contains(all, 'démarrée à la main');
      expect(sd().services.menu.state).toBe('active');
      expect(s.finished).toBe(false);
      // Requires= alone: both start together, the app still loses the race.
      edit('sudo systemctl edit menu', dropIn('[Unit]\nRequires=postgresql.service'));
      all = play(['sudo reboot']);
      contains(all, 'les deux démarrent en même temps');
      all = play(['systemctl status menu']);
      expect(all).toContain('Error: connect ECONNREFUSED 127.0.0.1:5432');
      // A misspelled unit: ignored, and verify says so for Requires=.
      all = edit('sudo systemctl edit menu', (t) => t.replace('Requires=postgresql.service', 'After=postgres.service\nRequires=postgres.service'));
      all += play(['systemd-analyze verify menu.service']);
      expect(all).toContain('menu.service: Failed to create menu.service/start: Unit postgres.service not found.');
      contains(all, 'pas postgres.service');
      expect(s.finished).toBe(false);
    });

    it('chapter 2 — solution: the start limit, PartOf=, reset-failed, the nightly restart replayed', () => {
      const { s, play, edit, sd } = part('restart-loop');
      let all = play(['cat message_from_ibrahim.txt', 'systemctl status menu', 'journalctl -u menu']);
      expect(all).toContain('Active: failed (Result: start-limit-hit)');
      expect(all).toContain('menu.service: Scheduled restart job, restart counter is at 5.');
      expect(all).toContain('menu.service: Start request repeated too quickly.');
      expect(all).toContain('Error: Connection terminated unexpectedly');
      contains(all, 'au-delà de la limite de démarrages');
      edit('sudo systemctl edit menu', dropIn('[Unit]\nPartOf=postgresql.service'));
      all = play(['sudo systemctl reset-failed menu', 'sudo systemctl start menu', 'systemctl is-active menu']);
      expect(all).toContain('active');
      expect(s.finished).toBe(false);
      all = play(['sudo systemctl restart postgresql', 'systemctl status menu']);
      expect(all).toContain('Active: active (running)');
      expect(all).toContain('Stopping menu.service');
      contains(all, 'Tu as terminé le chapitre');
      contains(all, 'DEUX SORTIES');
      expect(sd().services.menu.result).toBeUndefined();
      expect(s.finished).toBe(true);
    });

    it('chapter 2 — another way: Restart=on-failure with RestartSec=5s', () => {
      const { s, play, edit } = part('restart-loop');
      edit('sudo systemctl edit menu', dropIn('[Service]\nRestart=on-failure\nRestartSec=5s'));
      let all = play(['sudo systemctl start menu', 'sudo systemctl restart postgresql', 'journalctl -u menu']);
      expect(all).toContain('Error: Connection terminated unexpectedly');
      expect(all).toContain('menu.service: Scheduled restart job, restart counter is at 1.');
      all = play(['systemctl status menu']);
      expect(all).toContain('Active: active (running)');
      expect(s.finished).toBe(true);
    });

    it('chapter 2 — false leads: the test without a fix, the start refused, BindsTo=', () => {
      const { s, play, edit, sd } = part('restart-loop');
      // The app started by hand, then the nightly restart: the same loop.
      let all = play(['sudo systemctl start menu', 'sudo systemctl restart postgresql']);
      contains(all, 'Même boucle');
      expect(sd().services.menu.result).toBe('start-limit-hit');
      // Right after, systemd refuses.
      all = play(['sudo systemctl start menu']);
      expect(all).toContain('Job for menu.service failed because start of the service was attempted too often.');
      expect(all).toContain('To force a start use "systemctl reset-failed menu.service"');
      contains(all, 'oublie les');
      // BindsTo=: the app stops with PostgreSQL, and doesn't come back.
      edit('sudo systemctl edit menu', dropIn('[Unit]\nBindsTo=postgresql.service'));
      play(['sudo systemctl reset-failed menu', 'sudo systemctl start menu']);
      all = play(['sudo systemctl restart postgresql', 'systemctl is-active menu']);
      expect(all).toContain('inactive');
      contains(all, 'propage');
      expect(s.finished).toBe(false);
    });

    it('chapter 3 — solution: blame, critical-chain, networkctl, RequiredForOnline=no, a reboot', () => {
      const { s, play, edit, sd } = part('slow-boot');
      let all = play(['cat message_from_ibrahim.txt', 'systemd-analyze time', 'systemd-analyze blame']);
      expect(all).toContain('multi-user.target reached after 2min 0.624s in userspace.');
      expect(all).toMatch(/2min 0\.008s systemd-networkd-wait-online\.service/);
      contains(all, 'presque tout le démarrage');
      all = play(['systemd-analyze critical-chain', 'networkctl']);
      expect(all).toContain('└─network-online.target @2min 0.112s');
      expect(all).toContain('  3 eth1 ether    no-carrier  configuring');
      contains(all, 'sans câble, pas de réseau');
      edit('sudo nano /etc/systemd/network/20-eth1.network', (t) => `${t}\n\n[Link]\nRequiredForOnline=no`);
      expect(s.finished).toBe(false);
      all = play(['sudo reboot', 'systemd-analyze time']);
      expect(all).toContain('multi-user.target reached after 1.819s in userspace.');
      contains(all, 'Tu as terminé le chapitre');
      contains(all, 'LES OUTILS');
      expect(sd().services.nginx.state).toBe('active');
      expect(s.finished).toBe(true);
    });

    it('chapter 3 — another way: wait-online told to wait for any link', () => {
      const { s, play, edit } = part('slow-boot');
      edit(
        'sudo systemctl edit systemd-networkd-wait-online',
        dropIn('[Service]\nExecStart=\nExecStart=/usr/lib/systemd/systemd-networkd-wait-online --any'),
      );
      const all = play(['systemctl cat systemd-networkd-wait-online', 'sudo reboot', 'systemd-analyze blame']);
      expect(all).toContain('/etc/systemd/system/systemd-networkd-wait-online.service.d/override.conf');
      expect(all).toMatch(/1\.203s systemd-networkd-wait-online\.service/);
      expect(s.finished).toBe(true);
    });

    it('chapter 4 — solution: the order of the boot, the hidden list, RequiresMountsFor=, a reboot', () => {
      const { s, play, edit, sd } = part('late-disk');
      let all = play(['cat message_from_ibrahim.txt', 'findmnt /srv/data', 'ls /srv/data/bookings', 'journalctl -b']);
      expect(all).toContain('/srv/data /dev/sdb1 ext4   rw,relatime');
      expect(all).not.toContain('2027-11-29.csv');
      expect(all).toMatch(/06:30:12 canteen systemd\[1\]: Started menu\.service[\s\S]*06:30:24 canteen systemd\[1\]: Mounted srv-data\.mount - \/srv\/data\./);
      contains(all, 'rien n');
      all = play(['sudo umount /srv/data', 'ls /srv/data/bookings']);
      expect(all).toContain('2027-11-29.csv');
      contains(all, 'sur le disque système');
      all = play(['sudo cp /srv/data/bookings/2027-11-29.csv /root/', 'sudo mount /srv/data', 'sudo cp /root/2027-11-29.csv /srv/data/bookings/', 'cat /srv/data/bookings/2027-11-29.csv']);
      expect(all).toContain('08:59;Nadia;2');
      contains(all, 'de retour sur le disque USB');
      expect(s.finished).toBe(false);
      edit('sudo systemctl edit menu', dropIn('[Unit]\nRequiresMountsFor=/srv/data'));
      all = play(['systemctl list-dependencies menu']);
      expect(all).toContain('└─srv-data.mount');
      all = play(['sudo reboot', 'systemd-analyze critical-chain menu.service']);
      expect(all).toContain('menu.service @24.31s +512ms\n└─srv-data.mount @0ms +24.31s');
      contains(all, 'Tu as terminé le chapitre');
      expect(sd().services.menu.state).toBe('active');
      expect(s.finished).toBe(true);
    });

    it('chapter 4 — another way, and false leads: fixed without the hidden list, then nofail removed', () => {
      const { s, play, edit } = part('late-disk');
      // The order fixed, but the morning's list is still hidden under the mount point.
      edit('sudo systemctl edit menu', dropIn('[Unit]\nRequiresMountsFor=/srv/data'));
      let all = play(['sudo reboot', 'systemctl status menu', 'ls /srv/data/bookings']);
      expect(all).toContain('Active: active (running)');
      expect(all).toContain('2027-11-29.csv');
      expect(s.finished).toBe(false);
      all = play(['head -n 1 /srv/data/bookings/2027-11-29.csv']);
      expect(all).not.toContain('Nadia');
      // Found and copied with the disk mounted elsewhere is not possible here: unmount, copy, mount.
      play(['sudo umount /srv/data', 'sudo cp /srv/data/bookings/2027-11-29.csv /tmp/today.csv', 'sudo mount /srv/data', 'sudo cp /tmp/today.csv /srv/data/bookings/2027-11-29.csv']);
      // nofail removed (and the drop-in too): the whole boot waits for the disk. Accepted, with a warning.
      edit('sudo nano /etc/fstab', (t) => t.replace('defaults,nofail', 'defaults'));
      play(['sudo rm /etc/systemd/system/menu.service.d/override.conf', 'sudo systemctl daemon-reload']);
      all = play(['sudo reboot', 'systemctl status menu']);
      contains(all, 'mode de secours');
      expect(s.finished).toBe(true);
    });

    it('chapter 3 — false leads: the app alone stops waiting; wait-online disabled (accepted)', () => {
      const { s, play, edit } = part('slow-boot');
      edit('sudo nano /etc/systemd/system/menu.service', (t) =>
        t.replace('After=network-online.target postgresql.service', 'After=postgresql.service').replace('Wants=network-online.target postgresql.service', 'Wants=postgresql.service'),
      );
      let all = play(['sudo systemctl daemon-reload', 'sudo reboot']);
      contains(all, 'mais nginx, si');
      all = play(['systemd-analyze critical-chain']);
      expect(all).toContain('└─nginx.service');
      expect(s.finished).toBe(false);
      all = play(['sudo systemctl disable systemd-networkd-wait-online', 'sudo reboot', 'systemd-analyze time']);
      contains(all, 'La correction plus fine garde');
      expect(s.finished).toBe(true);
    });
  });
