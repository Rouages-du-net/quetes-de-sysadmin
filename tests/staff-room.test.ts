// The Staff Room: a primary school's CUPS server. Each chapter is replayed
// to the end from the workstation (ssh chalk), with another solution and
// false leads, in each language; the expected texts are checked in French.
// Also: cupsd.conf as cupsd reads it (Location, Allow, Order, @LOCAL, the
// policy), its times and sizes, and the commands' outputs.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { translator } from '../src/texts';
import { inLanguage, machinesInLanguage, languagesFor } from './names';
import { appendLog, cups, locationFor, matches, parseConf, reaches, sizeValue, timeValue, verdict } from '../src/engine/cups';
import { cupsdConf } from '../src/engine/chapters/staff-room';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const PASSWORD = 'chalkboard-29';
const LOCATION = '<Location /printers/staffroom>\n  Order allow,deny\n  Allow 198.51.100.0/24\n</Location>\n\n# Restrict access to the admin pages...';

describe('CUPS: cupsd.conf, access, policy', () => {
  it('reads cupsd.conf like cupsd: directives, Location and Policy blocks, unknown directives, syntax errors', () => {
    const c = parseConf(cupsdConf({ logLevel: 'debug2', remoteAdmin: true, cancelAny: true }) + '\nFooBar 1');
    expect(c.directives.loglevel).toBe('debug2');
    expect(c.listen).toEqual(['*:631', '/run/cups/cups.sock']);
    expect(c.locations.map((l) => l.path)).toEqual(['/', '/admin', '/admin/conf', '/admin/log']);
    expect(c.locations[1].allow).toEqual(['@LOCAL']);
    expect(c.policies.default.limits.find((l) => l.ops.includes('Cancel-Job'))!.require).toBeNull();
    expect(c.warnings[0]).toMatch(/^Unknown directive FooBar on line \d+ of \/etc\/cups\/cupsd\.conf\.$/);
    expect(parseConf('<Location />\n  Order allow,deny\n').errors[0]).toMatch(/^Syntax error on line \d+ of \/etc\/cups\/cupsd\.conf\.$/);
    expect(locationFor(c, '/printers/staffroom')!.path).toBe('/');
    expect(locationFor(parseConf(cupsdConf().replace('# Restrict access to the admin pages...', LOCATION)), '/printers/staffroom')!.path).toBe('/printers/staffroom');
  });

  it('rotates a log past MaxLogSize into NAME.O when cupsd next writes to it', () => {
    const s = new Shell(chapter('paper-trail'), 'en');
    cups(s).conf = parseConf(cupsdConf({ maxLogSize: '1m' }));
    appendLog(s, 'error_log', ['E [07/Dec/2029:16:00:00 +0000] something']);
    expect(s.find('/var/log/cups/error_log.O')?.type).toBe('file');
    expect(s.read('/var/log/cups/error_log')).toBe('E [07/Dec/2029:16:00:00 +0000] something');
  });

  it('times and sizes as cupsd reads them', () => {
    expect(timeValue('Yes')).toBe(Infinity);
    expect(timeValue('No')).toBe(0);
    expect(timeValue('1w')).toBe(604_800_000);
    expect(timeValue('86400')).toBe(86_400_000);
    expect(sizeValue('1m')).toBe(1_048_576);
    expect(sizeValue('0')).toBe(0);
  });

  it('decides who reaches a path: Listen, @LOCAL, networks, Order, localhost always', () => {
    const s = new Shell(chapter('new-printer'), 'en');
    const st = cups(s);
    expect(matches(st, '@LOCAL', '203.0.113.77')).toBe(true);
    expect(matches(st, '@LOCAL', '192.0.2.200')).toBe(true);
    expect(matches(st, '@IF(eth1)', '203.0.113.77')).toBe(false);
    expect(matches(st, '198.51.100.0/24', '198.51.100.23')).toBe(true);
    expect(matches(st, '198.51.100.0/255.255.255.0', '198.51.100.23')).toBe(true);
    expect(matches(st, '198.51.100', '198.51.100.23')).toBe(true);
    expect(reaches(s, '203.0.113.77', '/printers/library')).toBe(true);
    expect(reaches(s, '203.0.113.77', '/admin')).toBe(false);
    expect(reaches(s, '127.0.0.1', '/admin')).toBe(true);
    // Listen localhost only: nobody else connects.
    const local = parseConf(cupsdConf().replace('Port 631', 'Listen localhost:631'));
    expect(reaches(s, '198.51.100.23', '/printers/office', local)).toBe(false);
    expect(verdict(s, { from: '198.51.100.23', user: 'amara', printer: 'office' })).toBeNull();
    expect(verdict(s, { from: '198.51.100.23', user: 'amara', printer: 'nowhere' })!.message).toBe('The printer or class does not exist.');
  });
});

for (const language of languagesFor('staff-room'))
  describe(`The Staff Room — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => inLanguage(t, machinesInLanguage(t, line));
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    function play(finished: string[]) {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('staff-room'), ...finished] });
      const one = (l: string) => {
        const o = c.execute(L(l));
        let out = typeof o === 'string' ? o : '';
        if (c.shell.waiting) {
          const p = c.execute(machinesInLanguage(t, PASSWORD));
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        return out;
      };
      const run = (...lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        const before = one(command);
        c.shell.saveEdition(change(c.shell.edition!.text));
        return `${before}\n${c.shell.quitEdition() ?? ''}`;
      };
      run('ssh chalk', 'yes');
      return { c, run, edit, chalk: () => c.remote!.shell, finished: () => c.remote!.shell.finished };
    }

    it('chapter 1 — solution: lpstat, the error_log, cancel -x the runaway job, cupsenable', () => {
      const { run, finished, chalk } = play([]);
      let all = run('cat message_from_ines.txt', 'cat note_from_joe.txt', 'lpstat -t');
      expect(all).toContain('printer office disabled since Fri Nov 16 16:12:33 2029 -\n\tPrinter stopped due to backend errors; please consult the error_log file for details.');
      expect(all).toMatch(/office-117 +sven +3650000896   Fri Nov 16 16:05:02 2029/);
      contains(all, 'ErrorPolicy');
      contains(all, 'Sven');
      all = run('tail -n 8 /var/log/cups/error_log');
      expect(all).toContain('[Job 117] Unable to connect to printer; will retry in 30 seconds...');
      expect(all).toContain('E [16/Nov/2029:16:12:33 +0000] [Job 117] End of messages');
      contains(all, 'LogDebugHistory');
      all = run('lpq -P office', 'df -h');
      expect(all).toContain('office is not ready\nRank    Owner   Job     File(s)                         Total Size\n1st     sven    117     yearbook-2029-proofs.pdf        3650000896 bytes');
      expect(all).toMatch(/\/dev\/vda3 +5[.,]0G +4[.,]5G +\d+M +90% \/var/);
      contains(all, 'spool');
      all = run('cancel 117', 'sudo ls /var/spool/cups');
      expect(all).toContain('d00117-001');
      contains(all, 'PreserveJobFiles');
      expect(finished()).toBe(false);
      all = run('cancel -x 117', 'sudo du -sh /var/spool/cups');
      expect(all).not.toContain('3.4G');
      contains(all, 'son document aussi');
      all = run('cupsenable office');
      contains(all, 'CE QUI S');
      expect(finished()).toBe(true);
      all = run('lpstat -p office', 'lpstat -W completed -o');
      expect(all).toMatch(/printer office (now printing office-\d+|is idle)\. {2}enabled since Mon Nov 19/);
      expect(all).toMatch(/office-117 +sven/);
      expect(cups(chalk()).jobs.find((x) => x.id === 117)!.state).toBe('canceled');
    });

    it('chapter 1 — false leads: a restart, printers.conf by hand, rm in the spool, cancel -a; then cupsenable', () => {
      const { run, edit, finished, chalk } = play([]);
      let all = run('sudo systemctl restart cups', 'lpstat -p office');
      expect(all).toContain('printer office disabled since');
      contains(all, 'survit à un');
      all = edit('sudo nano /etc/cups/printers.conf', (x) => x.replace('State Stopped', 'State Idle')) + run('ls');
      contains(all, 'DO NOT EDIT THIS FILE');
      all = run('sudo systemctl restart cups', 'lpstat -p office');
      expect(all).toContain('printer office disabled since');
      contains(all, 'réécrit ses');
      all = run('sudo rm /var/spool/cups/d00117-001', 'lpq');
      contains(all, 'cupsd n');
      expect(all).toContain('117     yearbook-2029-proofs.pdf');
      all = run('cancel -a');
      contains(all, 'ceux des collègues aussi');
      expect(finished()).toBe(false);
      all = run('lpq');
      expect(all).toMatch(/1st +amara +125 +register-class-2B\.pdf/);
      run('cupsenable office');
      expect(finished()).toBe(true);
      expect(cups(chalk()).jobs.filter((x) => x.id < 125 && x.state === 'canceled')).toHaveLength(8);
    });

    it('chapter 1 — another way: enabled first (the yearbook prints), cancelled, then purged; and cupsd stopped, printers.conf edited, started', () => {
      const { run, finished } = play([]);
      let all = run('cupsenable office', 'lpq');
      expect(all).toMatch(/active +sven +117/);
      contains(all, 'sur 900');
      run('lprm 117');
      expect(finished()).toBe(false);
      run('cancel -x 117');
      expect(finished()).toBe(true);
      const second = play([]);
      second.run('cancel -x 117', 'sudo systemctl stop cups');
      second.edit('sudo nano /etc/cups/printers.conf', (x) => x.replace('State Stopped', 'State Idle'));
      all = second.run('sudo systemctl start cups', 'lpstat -p office');
      expect(all).toMatch(/printer office (is idle|now printing)/);
      expect(second.finished()).toBe(true);
    });

    it('chapter 2 — solution: driverless, the default, a Location for the staff, hpcups', () => {
      const { run, edit, finished } = play(['stuck-queue']);
      let all = run('cat message_from_ines.txt', 'cat delivery_note.txt', 'driverless', 'sudo lpinfo -v');
      expect(all).toContain('ipp://RICOH%20IM%20C3010._ipp._tcp.local/');
      expect(all).toContain('network socket://198.51.100.22');
      contains(all, 'IPP Everywhere');
      all = run('lpadmin -p staffroom -E -v ipp://mfp-staffroom.internal/ipp/print -m everywhere', 'lpstat -p staffroom');
      expect(all).toContain('printer staffroom is idle.');
      all = run('lpadmin -d staffroom', 'lpstat -d', 'tail -n 6 /var/log/cups/access_log', 'ip -br addr');
      expect(all).toContain('system default destination: staffroom');
      expect(all).toMatch(/203\.0\.113\.77 - pupil .*"POST \/printers\/staffroom HTTP\/1\.1" 200 \d+ Print-Job successful-ok/);
      contains(all, 'skins');
      all = run('grep -A4 "<Location />" /etc/cups/cupsd.conf');
      expect(all).toContain('Allow @LOCAL');
      edit('sudo nano /etc/cups/cupsd.conf', (x) => x.replace('# Restrict access to the admin pages...', LOCATION));
      all = run('sudo cupsd -t', 'sudo systemctl restart cups', 'lpstat -t', 'tail -n 4 /var/log/cups/access_log');
      expect(all).toContain('"/etc/cups/cupsd.conf" is OK.');
      expect(all).toMatch(/203\.0\.113\.77 - - .*"POST \/printers\/staffroom HTTP\/1\.1" 403 0 - -/);
      contains(all, 'la vieille LaserJet');
      all = run('lpadmin -p reception -E -v socket://laserjet-reception.internal:9100 -m everywhere');
      expect(all).toContain('lpadmin: IPP Everywhere driver requires an IPP connection.');
      contains(all, 'port brut 9100');
      all = run('lpinfo -m | grep -i 4250', 'sudo apt install printer-driver-hpcups');
      expect(all).toContain('Unable to locate package printer-driver-hpcups');
      all = run('sudo apt update', 'sudo apt install -y printer-driver-hpcups', 'lpinfo -m | grep 4250');
      expect(all).toContain('drv:///hpcups.drv/hp-laserjet_4250.ppd HP LaserJet 4250, hpcups 3.25.2');
      expect(finished()).toBe(false);
      all = run('lpadmin -p reception -E -v socket://laserjet-reception.internal:9100 -m drv:///hpcups.drv/hp-laserjet_4250.ppd');
      expect(all).toContain('lpadmin: Printer drivers are deprecated and will stop working in a future version of CUPS.');
      contains(all, 'CE QUI S');
      expect(finished()).toBe(true);
    });

    it('chapter 2 — false leads: -E before -p, lpoptions -d, Allow all, not shared; another way: allow:@staff and a generic PPD', () => {
      const { run, finished, chalk } = play(['stuck-queue']);
      let all = run('lpadmin -E -p mfp -v ipp://mfp-staffroom.internal/ipp/print -m everywhere', 'lpstat -p mfp');
      expect(all).toContain('printer mfp disabled since');
      contains(all, 'chiffrer la connexion');
      all = run('cupsenable mfp', 'cupsaccept mfp', 'lpoptions -d mfp');
      contains(all, 'VOTRE imprimante');
      all = run('cupsctl --remote-any', 'grep -A4 "<Location />" /etc/cups/cupsd.conf');
      expect(all).toContain('Allow all');
      contains(all, 'Allow all');
      run('cupsctl --no-remote-any', 'lpadmin -d mfp');
      all = run('lpadmin -p mfp -o printer-is-shared=false');
      contains(all, 'le personnel ne peut plus');
      run('lpadmin -p mfp -o printer-is-shared=true -u allow:@staff');
      run('lpadmin -p reception -E -v socket://laserjet-reception.internal:9100 -m drv:///sample.drv/generic.ppd');
      expect(finished()).toBe(true);
      expect(verdict(chalk(), { from: '203.0.113.77', user: 'pupil', printer: 'mfp' })!.status).toBe('client-error-not-authorized');
      all = run('lpstat -l -p mfp');
      expect(all).toContain('\tUsers allowed:\n\t\t@staff');
    });

    it('chapter 3 — solution: cupsctl, the old log, the history, the policy, /admin', () => {
      const { run, finished, chalk } = play(['stuck-queue', 'new-printer']);
      let all = run('cat message_from_ines.txt', 'cat dpo_request.txt', 'df -h /var', 'sudo du -sh /var/log/cups/* /var/spool/cups');
      expect(all).toMatch(/3[.,]9G\t\/var\/log\/cups\/error_log/);
      contains(all, 'pèse 3,9');
      all = run('sudo grep job-name /var/log/cups/error_log');
      expect(all).toContain('job-name="report-autumn-');
      contains(all, 'noms des élèves');
      all = run('lpstat -W completed -o', 'cupsctl');
      expect(all).toMatch(/staffroom-1188 +amara/);
      expect(all).toContain('_user_cancel_any=1');
      expect(all).toContain('JobPrivateValues=none');
      contains(all, 'remonte à octobre');
      run('cupsctl --no-debug-logging', 'cupsctl MaxLogSize=1m', 'sudo truncate -s 0 /var/log/cups/error_log');
      run('cupsctl PreserveJobHistory=1w PreserveJobFiles=No', 'cupsctl JobPrivateValues=default', 'cupsctl --no-user-cancel-any');
      expect(finished()).toBe(false);
      all = run('cupsctl --no-remote-admin', 'cupsctl');
      expect(all).toContain('_remote_admin=0');
      contains(all, 'CE QUI S');
      expect(finished()).toBe(true);
      all = run('lpstat -W completed -o', 'tail -n 2 /var/log/cups/access_log');
      expect(all).not.toContain('staffroom-1188');
      expect(reaches(chalk(), '198.51.100.23', '/admin')).toBe(false);
    });

    it('chapter 3 — false leads: nano without a restart, a broken file, error_log.O; another way: nano, cupsd -t, logrotate', () => {
      const { run, edit, finished } = play(['stuck-queue', 'new-printer']);
      let all = edit('sudo nano /etc/cups/cupsd.conf', (x) => x.replace('LogLevel debug2', 'LogLevel warn')) + run('ls');
      contains(all, 'ce qu');
      all = edit('sudo nano /etc/cups/cupsd.conf', (x) => x.replace('</Policy>', '')) + run('sudo cupsd -t', 'sudo systemctl restart cups');
      expect(all).toMatch(/Syntax error on line \d+ of \/etc\/cups\/cupsd\.conf\./);
      contains(all, 'personne ne peut imprimer');
      edit('sudo nano /etc/cups/cupsd.conf', (x) =>
        x
          .replace(/<Limit All>\n    Order deny,allow\n  <\/Limit>/, '<Limit All>\n    Order deny,allow\n  </Limit>\n</Policy>')
          .replace('MaxLogSize 0', 'MaxLogSize 1m')
          .replace('PreserveJobHistory Yes', 'PreserveJobHistory 604800')
          .replace('PreserveJobFiles Yes', 'PreserveJobFiles No')
          .replace('JobPrivateValues none', 'JobPrivateValues default')
          .replace('  <Limit Cancel-Job CUPS-Authenticate-Job>\n', '  <Limit Cancel-Job CUPS-Authenticate-Job>\n    Require user @OWNER @SYSTEM\n')
          .replace(/(<Location \/admin[^>]*>\n(?:.*\n)*?)  Allow @LOCAL\n/g, '$1'),
      );
      all = run('sudo cupsd -t', 'sudo systemctl start cups', 'sudo logger x', 'ls -lh /var/log/cups');
      expect(all).toContain('"/etc/cups/cupsd.conf" is OK.');
      expect(finished()).toBe(false);
      // At warn, cupsd hardly writes: the old log stays until someone removes it.
      all = run('lp -d staffroom /tmp/test-page.txt', 'ls -lh /var/log/cups');
      expect(all).toMatch(/3[.,]9G .* error_log/);
      run('sudo rm -f /var/log/cups/error_log.O /var/log/cups/error_log');
      expect(finished()).toBe(true);
    });
  });
