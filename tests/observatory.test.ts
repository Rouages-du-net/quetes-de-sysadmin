// The Observatory: the processor on the astronomy club's server. Each
// chapter is replayed to the end, with another solution and false leads, in
// each language; the expected texts are checked in French. Also: the CPU
// model (shares, nice's weight, a service's quota, the load average) and the
// commands built on it (uptime, renice, pgrep, ps -o, top, systemd-cgtop).

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { readNice, readQuota, shares, weight } from '../src/engine/cpu';
import { systemd } from '../src/engine/systemd';
import { GALLERY, WORKERS, galleryTime } from '../src/engine/chapters/observatory';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const MDP = 'nebula-2028';
const TIME = "curl -s -o /dev/null -w '%{time_total}\\n' http://localhost:8080/";

describe('The processor model', () => {
  it('nice weights like the kernel, quotas and nice values read like systemd', () => {
    expect(weight(0)).toBe(1024);
    expect(weight(19)).toBe(15);
    expect(weight(-20)).toBe(88818);
    expect(readQuota('80%')).toBe(0.8);
    expect(readQuota('150%')).toBe(1.5);
    expect(readQuota('80')).toBeNull();
    expect(readNice('19')).toBe(19);
    expect(readNice('-5')).toBe(-5);
    expect(readNice('20')).toBeNull();
  });

  it('shares: by weight, never more than wanted, a quota caps a service', () => {
    const s = new Shell(chapter('heavy-load'), 'en');
    // Nine processes for two CPUs: two ninths each.
    expect(shares(s)[GALLERY]).toBeCloseTo(2 / 9, 5);
    expect(galleryTime(s)).toBeGreaterThan(4);
    s.execute('sudo renice -n 19 -u jules');
    if (s.waiting) s.execute(MDP);
    // The gallery gets the whole CPU it wants; the workers share the other.
    expect(shares(s)[GALLERY]).toBeCloseTo(1, 5);
    expect(shares(s)[WORKERS[0]]).toBeCloseTo(1 / 8, 5);
    const q = new Shell(chapter('quota'), 'en');
    q.execute('sudo systemctl set-property stacking CPUQuota=50%');
    if (q.waiting) q.execute(MDP);
    const total = WORKERS.reduce((t, p) => t + (shares(q)[p] ?? 0), 0);
    expect(total).toBeCloseTo(0.5, 5);
  });
});

for (const language of LANGUAGES)
  describe(`The Observatory — ${language}`, () => {
    const fr = language === 'fr';
    const L = (line: string) => inLanguage(translator(language), machinesInLanguage(translator(language), line));
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    function part(id: string) {
      const s = new Shell(chapter(id), language);
      const one = (l: string) => {
        let output = s.execute(L(l)) ?? '';
        if (s.waiting) output += '\n' + (s.execute(machinesInLanguage(s.t, MDP)) ?? '');
        const errors = s.recoverErrors();
        return [output, ...errors].filter(Boolean).join('\n');
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        one(command);
        s.saveEdition(change(s.edition!.text));
        return s.quitEdition();
      };
      return { s, play, edit, sd: () => systemd(s)! };
    }
    const dropIn = (lines: string) => (text: string) => text.replace('\n\n\n', `\n${lines}\n\n`);

    it('the machine is reached from the workstation', () => {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('observatory')] });
      c.execute(L('ssh observatory'));
      c.execute('yes');
      expect(c.remote?.shell.chapter.id).toBe('heavy-load');
    });

    it('chapter 1 — solution: the load, the workers, renice -u, the gallery timed', () => {
      const { s, play } = part('heavy-load');
      let all = play(['cat message_from_amara.txt', 'uptime', 'nproc']);
      expect(all).toMatch(/load average: 9\.\d\d, 8\.\d\d, 7\.\d\d/);
      expect(all).toContain('\n2');
      contains(all, 'charge moyenne');
      all = play(['top', 'ps -eo pid,ni,%cpu,comm --sort=-%cpu', TIME]);
      expect(all).toMatch(/2102 jules\s+20\s+0 .* R\s+22\.2 .* stack-worker/);
      expect(all).toContain('   2102   0 22.2 stack-worker');
      expect(all).toContain('5.062500');
      contains(all, 'un neuvième de la machine');
      expect(s.finished).toBe(false);
      all = play(['sudo renice -n 19 -u jules', TIME, 'uptime', 'top']);
      expect(all).toContain('1002 (user ID) old priority 0, new priority 19');
      expect(all).toContain('0.250000');
      // The load doesn't go down: it counts what wants to run.
      expect(all).toMatch(/load average: (8|9)\.\d\d/);
      expect(all).toMatch(/2102 jules\s+39\s+19 .* R\s+12\.5/);
      expect(all).toMatch(/%Cpu\(s\): 50\.0 us,\s+0\.0 sy, 50\.0 ni/);
      contains(all, 'Tu as terminé le chapitre');
      contains(all, 'CE QUE CHANGE NICE');
      expect(s.finished).toBe(true);
    });

    it('chapter 1 — another way: pgrep, then renice on each worker\'s PID', () => {
      const { s, play } = part('heavy-load');
      const all = play(['pgrep -l stack', `sudo renice -n 15 -p ${WORKERS.join(' ')}`, TIME]);
      expect(all).toContain('2101 stack-night\n2102 stack-worker');
      expect(all).toContain('2109 (process ID) old priority 0, new priority 15');
      expect(s.finished).toBe(true);
    });

    it('chapter 1 — another way: a higher priority for the gallery (root only)', () => {
      const { s, play } = part('heavy-load');
      let all = play(['renice -n -10 -p 840']);
      expect(all).toContain('renice: failed to set priority for 840 (process ID): Permission denied');
      expect(s.finished).toBe(false);
      all = play(['sudo renice -n -10 -p 840']);
      expect(all).toContain('840 (process ID) old priority 0, new priority -10');
      contains(all, 'une valeur nice négative');
      expect(s.finished).toBe(true);
    });

    it('chapter 1 — false leads: the parent only, some workers, without sudo, kill', () => {
      const { s, play } = part('heavy-load');
      let all = play(['renice -n 19 -p 2101']);
      expect(all).toContain('renice: failed to set priority for 2101 (process ID): Permission denied');
      all = play(['sudo renice -n 19 -p 2101', TIME]);
      contains(all, 'les enfants déjà lancés ne suivent pas');
      expect(all).toContain('5.062500');
      all = play(['sudo renice -n 19 -p 2102 2103 2104 2105']);
      contains(all, 'pas tous');
      expect(s.finished).toBe(false);
      all = play(['sudo kill 2109']);
      contains(all, 'Recommencer ce chapitre');
      all = play(['sudo renice -n 19 -u jules']);
      expect(s.finished).toBe(false);
    });

    it('chapter 2 — solution: nice caps nothing, set-property CPUQuota=80%', () => {
      const { s, play, sd } = part('quota');
      let all = play(['cat message_from_amara.txt', 'cat mail_from_the_host.txt', 'systemctl cat stacking', 'top']);
      expect(all).toContain('Nice=19');
      expect(all).toContain('40 %');
      expect(all).toMatch(/2102 jules\s+39\s+19 .* R\s+25\.0/);
      contains(all, 'il ne plafonne rien');
      all = play(['systemd-cgtop']);
      expect(all).toMatch(/\/system\.slice\/stacking\.service\s+9\s+200\.0/);
      all = play(['sudo systemctl set-property stacking Nice=10']);
      expect(all).toContain('Failed to set unit properties on stacking.service: Cannot set property Nice, or unknown property.');
      contains(all, 'quand les processus démarrent');
      all = play(['sudo systemctl set-property stacking CPUQuota=150%']);
      contains(all, 'UN processeur');
      expect(s.finished).toBe(false);
      all = play(['sudo systemctl set-property stacking CPUQuota=80%', 'systemd-cgtop', 'cat /etc/systemd/system.control/stacking.service.d/50-CPUQuota.conf']);
      expect(all).toMatch(/\/system\.slice\/stacking\.service\s+9\s+80\.0/);
      expect(all).toContain('CPUQuota=80%');
      contains(all, 'NICE PARTAGE, LE QUOTA PLAFONNE');
      expect(sd().services.stacking.state).toBe('active');
      expect(s.finished).toBe(true);
    });

    it('chapter 2 — another way: the unit file edited by hand, then daemon-reload', () => {
      const { s, play, edit } = part('quota');
      let all = edit('sudo nano /etc/systemd/system/stacking.service', (t) => t.replace('Nice=19', 'Nice=19\nCPUQuota=60%'));
      all += play(['ls']);
      contains(all, 'daemon-reload');
      expect(s.finished).toBe(false);
      all = play(['sudo systemctl daemon-reload', 'top']);
      expect(all).toMatch(/2102 jules\s+39\s+19 .* R\s+7\.5/);
      expect(s.finished).toBe(true);
    });

    it('chapter 2 — another way: systemctl edit, after a restart (the night lost)', () => {
      const { s, play, edit } = part('quota');
      let all = play(['sudo systemctl restart stacking']);
      contains(all, 'repart du début');
      all = edit('sudo systemctl edit stacking', dropIn('[Service]\nCPUQuota=80%'));
      expect(s.finished).toBe(true);
    });

    it('chapter 3 — solution: EMFILE, /proc/PID/limits, LimitNOFILE= in a drop-in, a restart', () => {
      const { s, play, edit } = part('too-many-files');
      let all = play(['cat message_from_amara.txt', 'curl -i http://localhost:8080/archive', 'journalctl -u gallery.service']);
      expect(all).toContain('HTTP/1.1 500 Internal Server Error');
      expect(all).toContain("Error: EMFILE: too many open files, open '/srv/skygallery/photos/archive/IMG_1013.jpg'");
      contains(all, 'le noyau a refusé');
      all = play(['cat /proc/840/limits', 'sudo ls /proc/840/fd | wc -l', 'ulimit -n', 'sudo lsof -p 840 | tail -n 1']);
      expect(all).toMatch(/Max open files\s+1024\s+524288\s+files/);
      expect(all).toContain('\n1024\n');
      expect(all).toContain('1023r');
      contains(all, 'limite souple');
      all = edit('sudo systemctl edit gallery.service', dropIn('[Service]\nLimitNOFILE=4096'));
      contains(all, 'Redémarre la galerie');
      expect(s.finished).toBe(false);
      all = play(['sudo systemctl restart gallery.service', 'curl -i http://localhost:8080/archive', 'cat /proc/840/limits']);
      expect(all).toContain('HTTP/1.1 200 OK');
      expect(all).toMatch(/Max open files\s+4096\s+4096\s+files/);
      contains(all, 'VIENNENT LES LIMITES');
      expect(s.finished).toBe(true);
    });

    it('chapter 3 — false leads: ulimit, limits.conf, prlimit alone, a limit too low', () => {
      const { s, play, edit } = part('too-many-files');
      let all = play(['ulimit -n 4096', 'ulimit -n']);
      expect(all).toContain('4096');
      contains(all, 'TON shell');
      all = edit('sudo nano /etc/security/limits.conf', (t) => t.replace('# End of file', '* soft nofile 8192\n# End of file'));
      all += play(['sudo systemctl restart gallery.service']);
      contains(all, 'pam_limits');
      all = play(['sudo prlimit --pid 840 --nofile=4096:524288', 'curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/archive']);
      expect(all).toContain('200');
      contains(all, 'prochain redémarrage');
      expect(s.finished).toBe(false);
      all = edit('sudo systemctl edit gallery.service', dropIn('[Service]\nLimitNOFILE=2048'));
      contains(all, 'trop basse');
      edit('sudo systemctl edit gallery.service', (t) => t.replace('LimitNOFILE=2048', 'LimitNOFILE=8192:524288'));
      play(['sudo systemctl restart gallery.service']);
      expect(s.finished).toBe(true);
    });

    it('chapter 4 — solution: TERM ignored, KILL, the orphan, the stale PID file', () => {
      const { s, play } = part('stuck-process');
      let all = play(['cat message_from_amara.txt', 'ps -ef', 'cat /usr/local/bin/sync-photos']);
      expect(all).toMatch(/root\s+3302\s+3301 .* rsync -a --partial/);
      expect(all).toContain("trap '' INT TERM HUP");
      contains(all, 'la colonne PPID');
      all = play(['sudo kill 3301', 'ps -p 3301']);
      expect(all).toContain('/bin/bash /usr/local/bin/sync-photos');
      contains(all, 'SIGTERM envoyé');
      all = play(['sudo kill 3302', 'pgrep -l rsync']);
      expect(all).toContain('3303 rsync');
      contains(all, 'relance en boucle');
      all = play(['kill -l', 'sudo kill -KILL 3301', 'ps -ef']);
      expect(all).toContain(' 9) SIGKILL');
      expect(all).toMatch(/root\s+3303\s+1 .* rsync/);
      contains(all, 'adoptés par init');
      all = play(['sudo kill -s TERM 3303', 'cat /run/sync-photos.pid', 'ps -p 3301']);
      expect(all).toContain('3301');
      contains(all, 'fichier PID périmé');
      expect(s.finished).toBe(false);
      all = play(['sudo rm /run/sync-photos.pid']);
      contains(all, 'LES SIGNAUX');
      expect(s.finished).toBe(true);
    });

    it('chapter 4 — another way: pkill -9 on the command line; false leads: the lock first, without sudo', () => {
      const { s, play } = part('stuck-process');
      let all = play(['kill 3301']);
      expect(all).toContain('(3301)');
      expect(s.finished).toBe(false);
      all = play(['sudo rm /run/sync-photos.pid']);
      contains(all, 'une deuxième copie');
      all = play(['sudo pkill -9 -f sync-photos', 'sudo pkill rsync', 'ps -ef']);
      expect(all).not.toContain('rsync -a');
      expect(s.finished).toBe(true);
    });

    it('chapter 2 — false leads: stopping it, renice', () => {
      const { s, play } = part('quota');
      let all = play(['sudo renice -n 19 -u jules', 'sudo systemctl stop stacking']);
      contains(all, 'Ma nuit');
      all = play(['sudo systemctl set-property stacking CPUQuota=80%']);
      expect(s.finished).toBe(false);
      play(['sudo systemctl start stacking']);
      expect(s.finished).toBe(true);
    });
  });

describe('CPU commands, outside the story', () => {
  it('uptime -p, nproc, nice, pgrep and renice errors', () => {
    const s = new Shell(chapter('heavy-load'), 'en');
    expect(s.execute('uptime -p')).toBe('up 12 days, 2 hours, 18 minutes');
    expect(s.execute('nice')).toBe('0');
    expect(s.execute('nice -n 19 nproc')).toBe('2');
    expect(s.execute('pgrep nothing-like-this')).toBe('');
    s.execute('renice -n abc -p 1');
    expect(s.recoverErrors().join('\n')).toContain("renice: invalid priority 'abc'");
    s.execute('renice -n 5 -p 99999');
    expect(s.recoverErrors().join('\n')).toContain('renice: failed to get priority for 99999 (process ID): No such process');
    s.execute('ps -o pid,bogus');
    expect(s.recoverErrors().join('\n')).toContain('error: unknown user-defined format specifier "bogus"');
  });
});
