// The Zine Library: AppArmor on Debian 13. Each chapter is replayed to the
// end from the workstation (ssh stapler), with another solution and false
// leads, in each language; the expected texts are checked in French. Also:
// the engine (apparmor.ts: globbing, the parser, the decisions) and the
// error explainer on AppArmor's errors.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { translator } from '../src/texts';
import { inLanguage, machinesInLanguage, languagesFor } from './names';
import { explain } from '../src/engine/explainer';
import { expandVariables, globToRegex, parseFile, permits, readMode, withFlags } from '../src/engine/apparmor';
import { globPath, readEvents } from '../src/engine/commands/apparmor';
import { PHP_FPM_PROFILE } from '../src/engine/chapters/zine-library';

const PASSWORD = 'riso-ink-33';
const LOCAL = '/etc/apparmor.d/local/php-fpm';

describe('The Zine Library: the engine', () => {
  it('globs like apparmor.d(5)', () => {
    expect(globToRegex('/srv/scans/*').test('/srv/scans/a.pdf')).toBe(true);
    expect(globToRegex('/srv/scans/*').test('/srv/scans/')).toBe(false);
    expect(globToRegex('/srv/scans/*').test('/srv/scans/a/b.pdf')).toBe(false);
    expect(globToRegex('/srv/scans/**').test('/srv/scans/a/b.pdf')).toBe(true);
    expect(globToRegex('/srv/scans/**').test('/srv/scans/')).toBe(false);
    expect(globToRegex('/srv/scans/{,**}').test('/srv/scans/')).toBe(true);
    expect(globToRegex('/usr/{bin,sbin}/php-fpm*').test('/usr/sbin/php-fpm8.4')).toBe(true);
    expect(globToRegex(expandVariables('@{HOME}/.ssh/*', { HOME: ['/home/*/', '/root/'] })).test('/root/.ssh/id_ed25519')).toBe(true);
    expect(globPath('/srv/scans/a.pdf')).toBe('/srv/scans/*');
    expect(globPath('/srv/scans/*')).toBe('/srv/scans/**');
    expect(globPath('/srv/scans/a.pdf', true)).toBe('/srv/scans/*.pdf');
  });

  it('reads profiles like apparmor_parser, and decides like the kernel', () => {
    const files: Record<string, string> = {
      '/etc/apparmor.d/php-fpm': PHP_FPM_PROFILE,
      '/etc/apparmor.d/tunables/global': '@{PROC}=/proc/\n@{run}=/run/ /var/run/\n@{pid}=[0-9]*',
      '/etc/apparmor.d/abstractions/base': '  /etc/ld.so.cache mr,',
      '/etc/apparmor.d/abstractions/nameservice': '  /etc/passwd r,',
      '/etc/apparmor.d/abstractions/php': '  /etc/php/** r,',
      '/etc/apparmor.d/abstractions/ssl_certs': '  /etc/ssl/certs/* r,',
      [LOCAL]: '/srv/scans/ r,\n/srv/scans/** rw',
    };
    const io = { read: (p: string) => files[p] ?? null, list: () => null };
    const bad = parseFile('/etc/apparmor.d/php-fpm', io);
    // The missing comma is seen at the next token: the profile's closing brace, back in the profile's file.
    expect(bad.error).toEqual({ file: '/etc/apparmor.d/php-fpm', line: 61, message: 'syntax error, unexpected TOK_CLOSE, expecting TOK_END_OF_RULE' });
    files[LOCAL] = '/srv/scans/ r,\n/srv/scans/** rw,\nowner /srv/backup/* w,';
    const { profiles, error } = parseFile('/etc/apparmor.d/php-fpm', io);
    expect(error).toBeNull();
    const p = profiles[0];
    expect(p.name).toBe('php-fpm');
    expect(p.flags).toEqual(['attach_disconnected']);
    expect(p.attachRe!.test('/usr/sbin/php-fpm8.4')).toBe(true);
    expect(permits(p, '/srv/scans/', 'r', false)).toBe(true);
    expect(permits(p, '/srv/scans/x.pdf', 'c', false)).toBe(true);
    expect(permits(p, '/etc/shadow', 'r', true)).toBe(false);
    expect(permits(p, '/srv/backup/a', 'w', false)).toBe(false);
    expect(permits(p, '/srv/backup/a', 'w', true)).toBe(true);
    expect(p.caps.map((c) => c.name)).toContain('dac_override');
    expect(readMode('rwx', false)).toBe("Invalid mode, 'x' must be preceded by exec qualifier 'i', 'p', or 'u'");
    expect(readMode('rix', false)).toEqual({ perms: 'r', exec: 'ix' });
    expect(withFlags('profile x /bin/x flags=(attach_disconnected) {', (f) => [...f, 'complain'])).toBe('profile x /bin/x flags=(attach_disconnected, complain) {');
    expect(withFlags('/bin/x flags=(complain) {', (f) => f.filter((x) => x !== 'complain'))).toBe('/bin/x {');
    const events = readEvents('type=AVC msg=audit(1994000000.123:301): apparmor="ALLOWED" operation="open" class="file" profile="/usr/local/sbin/zine-backup" name="/etc/zine-backup.conf" pid=4410 comm="zine-backup" requested_mask="r" denied_mask="r" fsuid=0 ouid=0');
    expect(events[0]).toMatchObject({ kind: 'ALLOWED', operation: 'open', name: '/etc/zine-backup.conf', mask: 'r', owner: true, serial: 301 });
  });

  it('explains AppArmor errors', () => {
    const t = translator('en');
    const why = (text: string) => explain({ failed: true, output: '', errors: [text] }, t);
    expect(why('You do not have enough privilege to read the profile set.')).toBe('apparmor-root');
    expect(why('apparmor_parser: Unable to replace "php-fpm".  Permission denied; attempted to load a profile while confined?')).toBe('apparmor-root');
    expect(why('AppArmor parser error for /etc/apparmor.d/php-fpm in profile /etc/apparmor.d/local/php-fpm at line 8: syntax error, unexpected TOK_CLOSE, expecting TOK_END_OF_RULE')).toBe('apparmor-parser');
  });
});

for (const language of languagesFor('zine-library'))
  describe(`The Zine Library — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => inLanguage(t, machinesInLanguage(t, line));
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    function play(finished: string[], id: string) {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('zine-library'), ...finished] });
      const one = (l: string) => {
        const o = c.execute(L(l));
        let out = typeof o === 'string' ? o : '';
        if (c.shell.waiting) {
          const p = c.execute(PASSWORD);
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        if (c.shell.question && /continue connecting/.test(c.shell.question.prompt)) {
          const p = c.execute('yes');
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        return out;
      };
      const log: string[] = [];
      const run = (...lines: string[]) => {
        const out = lines.map(one).join('\n');
        log.push(out);
        return out;
      };
      const edit = (command: string, ...changes: [string, string][]) => {
        const before = one(command);
        let text = c.shell.edition!.text;
        for (const [a, b] of changes) {
          expect(text, a).toContain(a);
          text = text.replace(a, b);
        }
        c.shell.saveEdition(text);
        const out = `${before}\n${c.shell.quitEdition() ?? ''}`;
        log.push(out);
        return out;
      };
      // Answers to a tool's questions (aa-logprof), typed as they are.
      const answer = (...texts: string[]) => {
        const out = texts
          .map((text) => {
            const o = c.execute(text);
            return `${c.shell.question?.prompt ?? ''}\n${typeof o === 'string' ? o : ''}`;
          })
          .join('\n');
        log.push(out);
        return out;
      };
      run('ssh stapler');
      return { c, run, edit, answer, everything: () => log.join('\n'), finished: () => c.finished.includes(id) };
    }

    // ——— Chapter 1: Denied ———

    const newPlace: [string, string] = ['/var/www/zinecat/scans/** rw,', '/var/www/zinecat/scans/** rw,\n/srv/scans/ r,\n/srv/scans/** rw,'];

    it('chapter 1 — solution: the kernel\'s log, the profile, a rule in local/php-fpm, the profile reloaded', () => {
      const { run, edit, finished, everything } = play([], 'denied-upload');
      let all = run('cat message_from_nomvula.txt', 'cat notes_from_bartek.txt', 'curl -s http://localhost/', 'ls -ld /srv/scans', 'sudo journalctl -k | grep DENIED | tail -3');
      expect(all).toContain('Could not read the scans.');
      expect(all).toMatch(/apparmor="DENIED" operation="open" class="file" profile="php-fpm" name="\/srv\/scans\/" pid=81[34] comm="php-fpm8.4" requested_mask="r" denied_mask="r" fsuid=33 ouid=33/);
      expect(all).toContain('operation="mknod"');
      contains(all, 'le noyau a refusé à php-fpm');
      all = run('sudo aa-status', 'cat /etc/apparmor.d/php-fpm', 'cat /etc/apparmor.d/local/php-fpm');
      expect(all).toContain('apparmor module is loaded.');
      expect(all).toMatch(/^\s+\/usr\/sbin\/php-fpm8\.4 \(813\) php-fpm$/m);
      expect(all).toContain('3 processes are in enforce mode.');
      expect(all).toContain('include if exists <local/php-fpm>');
      contains(all, 'local/php-fpm');
      edit(`sudo nano ${LOCAL}`, newPlace);
      all = run('sudo apparmor_parser -r -v /etc/apparmor.d/php-fpm');
      expect(all).toContain('Replacement succeeded for "php-fpm".');
      all = run('ls /srv/scans', 'curl -s http://localhost/', 'sudo journalctl -k -n 3');
      expect(all).toContain('riso-dreams-04.pdf');
      expect(all).toContain('apparmor="STATUS" operation="profile_replace" profile="unconfined" name="php-fpm"');
      expect(finished()).toBe(true);
      contains(everything(), 'Vous avez terminé Refusé.');
    });

    it('chapter 1 — false leads: chmod 777, the vendor\'s file, complain, disable; another solution: a file of php-fpm.d and systemctl reload apparmor', () => {
      const { run, edit, finished } = play([], 'denied-upload');
      let all = run('sudo chmod 777 /srv/scans');
      contains(all, 'tout le monde');
      all = run('sudo apparmor_parser -r /etc/apparmor.d/local/php-fpm');
      expect(all).toContain('AppArmor parser error for /etc/apparmor.d/local/php-fpm in profile /etc/apparmor.d/local/php-fpm at line 2: syntax error, unexpected TOK_MODE, expecting TOK_OPEN');
      contains(all, 'un morceau de profil');
      all = edit('sudo nano /etc/apparmor.d/php-fpm', ['  include if exists <local/php-fpm>', '  include if exists <local/php-fpm>\n  /srv/scans/** rw']);
      contains(all, 'apparmor-profiles');
      all = run('sudo apparmor_parser -r /etc/apparmor.d/php-fpm');
      expect(all).toMatch(/AppArmor parser error for \/etc\/apparmor\.d\/php-fpm in profile \/etc\/apparmor\.d\/php-fpm at line \d+: syntax error, unexpected TOK_CLOSE, expecting TOK_END_OF_RULE/);
      edit('sudo nano /etc/apparmor.d/php-fpm', ['  include if exists <local/php-fpm>\n  /srv/scans/** rw', '  include if exists <local/php-fpm>']);
      run('sudo chmod 755 /srv/scans');
      all = run('sudo aa-complain /etc/apparmor.d/php-fpm', 'curl -s http://localhost/', 'sudo journalctl -k | grep ALLOWED | tail -1');
      expect(all).toContain('Setting /etc/apparmor.d/php-fpm to complain mode.');
      expect(all).toContain('apparmor="ALLOWED"');
      contains(all, 'mode complain');
      expect(finished()).toBe(false);
      all = run('sudo aa-disable /etc/apparmor.d/php-fpm', 'sudo aa-status --show=processes');
      expect(all).toContain('Disabling /etc/apparmor.d/php-fpm.');
      expect(all).toContain('0 processes have profiles defined.');
      contains(all, 'php-fpm tourne maintenant sans confinement');
      expect(finished()).toBe(false);
      // Another place for the rule: a file of php-fpm.d, which the profile includes too.
      run('sudo mkdir /etc/apparmor.d/php-fpm.d');
      edit('sudo nano /etc/apparmor.d/php-fpm.d/zinecat', ['', '/srv/scans/ r,\n/srv/scans/** rw,\n']);
      all = run('sudo aa-enforce /etc/apparmor.d/php-fpm', 'sudo aa-status --show=processes');
      expect(all).toContain('Setting /etc/apparmor.d/php-fpm to enforce mode.');
      expect(all).toContain('0 processes have profiles defined.');
      contains(all, 'tournent sans confinement');
      expect(finished()).toBe(false);
      run('sudo systemctl restart php8.4-fpm', 'sudo systemctl reload apparmor');
      expect(finished()).toBe(true);
    });

    // ——— Chapter 2: A Profile of Our Own ———

    it('chapter 2 — solution: aa-autodep, a run in complain mode, aa-logprof, aa-enforce, a run, /etc/shadow refused', () => {
      const { run, edit, answer, finished, everything } = play(['denied-upload'], 'backup-profile');
      let all = run('cat message_from_hinewai.txt', 'cat /usr/local/sbin/zine-backup', 'cat /etc/zine-backup.conf');
      contains(all, 'tar, en root');
      all = run('sudo aa-autodep /usr/local/sbin/zine-backup', 'cat /etc/apparmor.d/usr.local.sbin.zine-backup');
      expect(all).toContain('Writing updated profile for /usr/local/sbin/zine-backup.');
      expect(all).toContain('/usr/local/sbin/zine-backup flags=(complain) {');
      expect(all).toContain('  /usr/bin/dash ix,');
      all = run('sudo zine-backup', 'sudo grep ALLOWED /var/log/audit/audit.log | tail -2');
      expect(all).toMatch(/zine-backup: \/srv\/backup\/zine-\d{8}-\d{4}\.tar\.gz written/);
      expect(all).toContain('apparmor="ALLOWED"');
      contains(all, 'aa-logprof');
      all = run('sudo aa-logprof');
      expect(all).toContain('Reading log entries from /var/log/audit/audit.log.');
      expect(all).toContain('Complain-mode changes:');
      expect(all).toContain('Execute:  /usr/bin/date');
      // date, tar, gzip: Inherit; the capability: Allow.
      all = answer('i', 'i', 'i', 'a');
      expect(all).toContain('Adding capability dac_read_search to profile.');
      // The rest: each path, globbed when it is a directory's file.
      for (let k = 0; k < 40 && /Path: /.test(all.split('Profile:').at(-1) ?? ''); k++) {
        const block = all.split('Profile:').at(-1)!;
        const path = /Path:\s+(\S+)/.exec(block)![1];
        if (/^\/srv\/scans\/.|^\/var\/lib\/zinecat\/.|^\/srv\/backup\/./.test(path)) all = answer('g', 'g', 'a');
        else all = answer('a');
      }
      expect(all).toContain('= Changed Local Profiles =');
      all = answer('s');
      expect(all).toContain('Writing updated profile for /usr/local/sbin/zine-backup.');
      all = run('cat /etc/apparmor.d/usr.local.sbin.zine-backup', 'sudo aa-enforce /etc/apparmor.d/usr.local.sbin.zine-backup');
      expect(all).toContain('/srv/scans/** r,');
      expect(all).toContain('/usr/bin/tar ix,');
      expect(all).toContain('Setting /etc/apparmor.d/usr.local.sbin.zine-backup to enforce mode.');
      expect(finished()).toBe(false);
      edit('sudo nano /etc/zine-backup.conf', ['/var/lib/zinecat"', '/var/lib/zinecat /etc/shadow"']);
      all = run('sudo zine-backup', 'sudo grep DENIED /var/log/audit/audit.log | tail -1');
      expect(all).toContain('tar: /etc/shadow: Cannot open: Permission denied');
      expect(all).toContain('apparmor="DENIED" operation="open" class="file" profile="/usr/local/sbin/zine-backup" name="/etc/shadow"');
      contains(all, 'root ou pas');
      edit('sudo nano /etc/zine-backup.conf', ['/var/lib/zinecat /etc/shadow"', '/var/lib/zinecat"']);
      all = run('sudo systemctl start zine-backup', 'sudo journalctl -u zine-backup | grep written');
      expect(all).toMatch(/written/);
      expect(finished()).toBe(true);
      contains(everything(), 'Vous avez terminé Un profil à nous.');
    });

    it('chapter 2 — false leads: enforced too early, /** rwix; another solution: a profile by hand', () => {
      const { run, edit, finished } = play(['denied-upload'], 'backup-profile');
      let all = run('sudo aa-autodep /usr/local/sbin/zine-backup', 'sudo aa-enforce /usr/local/sbin/zine-backup', 'sudo zine-backup');
      expect(all).toContain('cannot open /etc/zine-backup.conf: Permission denied');
      contains(all, 'trop tôt');
      edit('sudo nano /etc/apparmor.d/usr.local.sbin.zine-backup', ['  /usr/local/sbin/zine-backup r,', '  /usr/local/sbin/zine-backup r,\n  /** rwix,']);
      all = run('sudo apparmor_parser -r /etc/apparmor.d/usr.local.sbin.zine-backup', 'sudo zine-backup');
      // /** gives every file, not the capabilities: the catalogue (www-data's, 640) stays out of reach.
      expect(all).toContain('tar: /var/lib/zinecat: Cannot open: Permission denied');
      contains(all, '/etc/shadow');
      expect(finished()).toBe(false);
      edit(
        'sudo nano /etc/apparmor.d/usr.local.sbin.zine-backup',
        ['  /** rwix,', '  include <abstractions/nameservice>\n  capability dac_read_search,\n  /etc/zine-backup.conf r,\n  /usr/bin/{date,tar,gzip} ix,\n  /srv/scans/{,**} r,\n  /var/lib/zinecat/{,**} r,\n  /srv/backup/zine-*.tar.gz w,'],
      );
      all = run('sudo apparmor_parser -r /etc/apparmor.d/usr.local.sbin.zine-backup', 'sudo zine-backup', 'sudo aa-status --enforced');
      expect(all).toContain('written');
      expect(finished()).toBe(true);
    });
  });
