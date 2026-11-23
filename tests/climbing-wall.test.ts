// The Climbing Wall: Network UPS Tools and power cuts. Each chapter is
// replayed to the end from the workstation (ssh belay), with another
// solution and false leads, in each language; the expected texts are
// checked in French. Also: the engine (nut.ts: configuration files, the
// clients' errors) and the error explainer on NUT's errors.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { explain } from '../src/engine/explainer';
import { readMonConf, readSched, readUpsConf, readUsers, readUpsdConf, shutdownKind, splitName, words } from '../src/engine/nut';

const PASSWORD = 'quickdraw-42';
const UPSMON = '/etc/nut/upsmon.conf';

describe('The Climbing Wall: the engine', () => {
  it('reads NUT configuration files like parseconf', () => {
    expect(words('SHUTDOWNCMD "/sbin/shutdown -h +0"  # halt')).toEqual(['SHUTDOWNCMD', '/sbin/shutdown -h +0']);
    expect(splitName('hallups@belay:3493')).toEqual({ upsname: 'hallups', host: 'belay', port: 3493 });
    expect(splitName('hallups')).toEqual({ upsname: 'hallups', host: 'localhost', port: 3493 });
    const mon = readMonConf('MONITOR hallups@localhost 1 upsmon pw master\nMINSUPPLIES 0\nNOTIFYFLAG ONBATT SYSLOG+EXEC\nNOTIFYFLAG BOGUS WALL\nMONITOR short');
    expect(mon.monitors[0]).toMatchObject({ upsname: 'hallups', host: 'localhost', pv: 1, primary: true });
    expect(mon.minsupplies).toBe(0);
    expect(mon.flags.ONBATT).toEqual(['SYSLOG', 'EXEC']);
    expect(mon.warnings).toContain("'BOGUS' is not a valid notify event name");
    expect(mon.warnings).toContain('MONITOR configuration directives require five arguments.');
    expect(readUpsConf('[hallups]\n\tdriver = usbhid-ups\n\tport = auto\n\toffdelay = 180').hallups).toMatchObject({ driver: 'usbhid-ups', port: 'auto', offdelay: 180 });
    const { users } = readUsers('[admin]\n\tpassword = x\n\tactions = SET\n\tinstcmds = test.battery.start.quick\n[nas]\n\tpassword = y\n\tupsmon slave');
    expect(users.admin).toMatchObject({ actions: ['SET'], instcmds: ['test.battery.start.quick'] });
    expect(users.nas.upsmon).toBe('secondary');
    expect(readUpsdConf('LISTEN 198.51.100.141\nACL all 0.0.0.0/0').listen).toEqual([{ address: '198.51.100.141', port: 3493 }]);
    expect(readSched('CMDSCRIPT /x\nAT ONBATT * START-TIMER onbatt 60').error).toBe('PIPEFN must be set before any ATs in the config file!');
    expect(shutdownKind('/sbin/shutdown -h +0')).toBe('halt');
    expect(shutdownKind('/sbin/shutdown -r now')).toBe('reboot');
    expect(shutdownKind('/bin/true')).toBe('none');
  });

  it('explains NUT errors', () => {
    const t = translator('en');
    const why = (text: string) => explain({ failed: true, output: '', errors: [text] }, t);
    expect(why('Instant command failed: Access denied')).toBe('ups-denied');
    expect(why('Error: Unknown UPS')).toBe('ups-unknown');
    expect(why('Error: Driver not connected')).toBe('ups-driver');
  });
});

for (const language of LANGUAGES)
  describe(`The Climbing Wall — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => inLanguage(t, machinesInLanguage(t, line));
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    function play(finished: string[], id: string) {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('climbing-wall'), ...finished] });
      const one = (l: string) => {
        const o = c.execute(L(l));
        let out = typeof o === 'string' ? o : '';
        if (c.shell.waiting) {
          const p = c.execute(machinesInLanguage(t, inLanguage(t, PASSWORD)));
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
      // An answer to a prompt (upscmd's password), typed as is.
      const answer = (text: string) => {
        const o = c.execute(text);
        const out = typeof o === 'string' ? o : '';
        log.push(out);
        return out;
      };
      run('ssh belay');
      return { c, run, edit, answer, everything: () => log.join('\n'), finished: () => c.finished.includes(id) };
    }

    // ——— Chapter 1: The Last Cut ———

    const monitorHallups: [string, string] = ['MONITOR eaton@localhost 1 upsmon Rope-Bag-2028 master', 'MONITOR hallups@localhost 1 upsmon Rope-Bag-2028 primary'];

    it('chapter 1 — solution: the journal, the UPS\'s name, MONITOR fixed, a drill, the power restore policy, a drill again', () => {
      const { run, edit, finished, everything } = play([], 'last-cut');
      let all = run('cat message_from_nkechi.txt', 'cat notes_from_haruto.txt', 'journalctl --list-boots', 'sudo journalctl -u nut-monitor -b -1 | tail -3');
      expect(all).toContain('Poll UPS [eaton@localhost] failed - [eaton] does not exist on server localhost');
      contains(all, 'upsmon interroge un onduleur appelé eaton');
      all = run('upsc -l', 'upsc hallups ups.status', 'upsc hallups battery.runtime');
      expect(all).toContain('Init SSL without certificate database');
      expect(all).toMatch(/^hallups$/m);
      expect(all).toMatch(/^OL$/m);
      contains(all, 'upsd sert un seul onduleur');
      all = edit(`sudo nano ${UPSMON}`, monitorHallups);
      all += run('sudo systemctl reload nut-monitor', 'upsc -c hallups', 'sudo journalctl -u nut-monitor -n 4');
      expect(all).toContain('No longer monitoring UPS [eaton@localhost]');
      expect(all).toContain('UPS: hallups@localhost (primary) (power value 1)');
      expect(all).toMatch(/^127\.0\.0\.1$/m);
      contains(all, 'upsmon surveille maintenant hallups');
      all = run('sudo upsdrvctl -t shutdown', 'sudo upsmon -c fsd');
      expect(all).toContain('*** Testing mode: not calling exec/kill');
      expect(all).toContain('Executing automatic power-fail shutdown');
      expect(all).toMatch(/Connection to .* closed by remote host\./);
      contains(all, 'relais n\'est pas revenu tout seul');
      expect(finished()).toBe(false);
      all = run('ssh belay', 'sudo journalctl -b -1 | grep -E "FSD|powering"', 'sudo ipmitool chassis status', 'sudo ipmitool sel list');
      expect(all).toContain('Signal 10: User requested FSD');
      expect(all).toContain('System is powering down.');
      expect(all).toContain('Power Restore Policy : previous');
      expect(all).toContain('AC lost | Asserted');
      all = run('sudo ipmitool chassis policy list', 'sudo ipmitool chassis policy always-on');
      expect(all).toContain('Set chassis power restore policy to always-on');
      all = run('sudo upsmon -c fsd');
      expect(finished()).toBe(true);
      contains(everything(), 'Vous avez terminé La Dernière Coupure.');
    });

    it('chapter 1 — false leads: MINSUPPLIES 0, a drill while upsmon is blind, upsdrvctl shutdown by hand; another solution: the section renamed', () => {
      const { run, edit, finished } = play([], 'last-cut');
      let all = edit(`sudo nano ${UPSMON}`, ['MINSUPPLIES 1', 'MINSUPPLIES 0']);
      contains(all, 'À 0, upsmon n\'en trouve jamais');
      all = run('sudo systemctl stop nut-monitor', 'sudo upsmon -c reload');
      expect(all).toContain("fopen /run/nut/upsmon.pid: No such file or directory");
      contains(all, 'nut-monitor (upsmon) ne tourne pas');
      edit(`sudo nano ${UPSMON}`, ['MINSUPPLIES 0', 'MINSUPPLIES 1'], ['MONITOR eaton@localhost 1 upsmon', 'MONITOR eaton@localhost 0 upsmon']);
      all = run('sudo systemctl start nut-monitor', 'sudo journalctl -u nut-monitor -n 12');
      expect(all).toContain('Fatal error: insufficient power configured!');
      edit(`sudo nano ${UPSMON}`, ['MONITOR eaton@localhost 0 upsmon', 'MONITOR eaton@localhost 1 upsmon']);
      run('sudo systemctl start nut-monitor');
      all = run('sudo ipmitool chassis policy always-on', 'sudo upsmon -c fsd');
      contains(all, 'upsmon -c fsd teste l\'arrêt, pas la détection');
      expect(finished()).toBe(false);
      expect(run('ssh belay', 'sudo journalctl -b -1 | grep "FSD set"')).toContain('FSD set on UPS eaton@localhost failed');
      // The other way: name the section like the MONITOR line, and restart the driver and upsd.
      edit('sudo nano /etc/nut/ups.conf', ['[hallups]', '[eaton]']);
      all = run('sudo systemctl stop nut-driver@hallups', 'sudo systemctl start nut-driver@eaton', 'upsc eaton');
      expect(all).toContain('Error: Unknown UPS');
      all = run('sudo systemctl restart nut-server', 'sudo systemctl restart nut-monitor', 'upsc eaton ups.status', 'upsc -c eaton');
      expect(all).toMatch(/^127\.0\.0\.1$/m);
      all = run('sudo upsdrvctl shutdown');
      contains(all, 'tapé à la main, il débranche relais');
      run('ssh belay');
      expect(finished()).toBe(false);
      run('sudo upsmon -c fsd');
      expect(finished()).toBe(false);
    });

    // ——— Chapter 2: Down in Order ———

    const listenOffice: [string, string] = ['# MAXAGE 15', 'LISTEN 127.0.0.1 3493\nLISTEN 198.51.100.141 3493\n# MAXAGE 15'];
    const harnessUser: [string, string] = ['upsmon master', 'upsmon primary\n\n[harness]\n\tpassword = Nas-Secret-77\n\tupsmon secondary'];
    const harnessMonitor = (type: string): [string, string] => ['RUN_AS_USER nut', `MONITOR hallups@belay 1 harness Nas-Secret-77 ${type}\nRUN_AS_USER nut`];
    const delays: [string, string] = ['office rack"', 'office rack"\n\toffdelay = 180\n\tondelay = 240'];

    it('chapter 2 — solution: LISTEN and a restart, a secondary account, ufw, harness\'s upsmon, a drill, offdelay, a drill again', () => {
      const { run, edit, finished, everything } = play(['last-cut'], 'down-in-order');
      let all = run('cat message_from_akosua.txt', 'sudo ss -tlnp | grep 3493');
      expect(all).toMatch(/127\.0\.0\.1:3493/);
      all = edit('sudo nano /etc/nut/upsd.conf', listenOffice);
      contains(all, 'upsd ne lit LISTEN qu\'à son démarrage');
      all = run('sudo systemctl restart nut-server', 'sudo ss -tlnp | grep 3493', 'sudo journalctl -u nut-server -n 6');
      expect(all).toContain('listening on 198.51.100.141 port 3493');
      edit('sudo nano /etc/nut/upsd.users', harnessUser);
      all = run('sudo systemctl reload nut-server', 'sudo ufw allow from 198.51.100.142 to any port 3493 proto tcp');
      contains(all, 'Le pare-feu de relais laisse entrer harness');
      run('ssh harness', 'cat /etc/nut/nut.conf | tail -1');
      edit('sudo nano /etc/nut/nut.conf', ['MODE=none', 'MODE=netclient']);
      edit(`sudo nano ${UPSMON}`, harnessMonitor('secondary'));
      all = run('sudo systemctl enable --now nut-monitor', 'upsc hallups@belay ups.status', 'sudo journalctl -u nut-monitor -n 3', 'exit');
      expect(all).toContain('UPS: hallups@belay (secondary) (power value 1)');
      contains(all, 'L\'upsmon de harness est connecté à hallups');
      all = run('upsc -c hallups', 'sudo upsmon -c fsd');
      expect(all).toContain('198.51.100.142');
      contains(all, 'harness a perdu le courant');
      expect(finished()).toBe(false);
      run('ssh belay');
      all = run('ssh harness', 'sudo journalctl -b -1 | grep forced', 'exit');
      expect(all).toContain('UPS hallups@belay: forced shutdown in progress');
      edit('sudo nano /etc/nut/ups.conf', delays);
      all = run('sudo upsmon -c fsd');
      expect(finished()).toBe(true);
      contains(everything(), 'Vous avez terminé Chacun son tour.');
    });

    it('chapter 2 — false leads: LISTEN 0.0.0.0 open to all, harness as a primary, nut-monitor not enabled, ondelay too short', () => {
      const { run, edit, finished } = play(['last-cut'], 'down-in-order');
      edit('sudo nano /etc/nut/upsd.conf', ['# MAXAGE 15', 'LISTEN 0.0.0.0 3493\n# MAXAGE 15']);
      let all = run('sudo systemctl restart nut-server', 'sudo ufw allow 3493/tcp');
      contains(all, 'depuis internet, le port 3493');
      edit('sudo nano /etc/nut/upsd.users', ['upsmon master', 'upsmon primary\n\n[harness]\n\tpassword = Nas-Secret-77\n\tupsmon primary']);
      all = run('sudo systemctl reload nut-server');
      contains(all, 'un primaire peut mettre FSD');
      run('ssh harness');
      edit(`sudo nano ${UPSMON}`, harnessMonitor('secondary'));
      run('sudo systemctl start nut-monitor', 'exit');
      all = edit('sudo nano /etc/nut/ups.conf', ['office rack"', 'office rack"\n\toffdelay = 180\n\tondelay = 60']);
      contains(all, 'ondelay n\'est pas plus grand');
      all = run('sudo upsmon -c fsd');
      contains(all, 'démarré mais pas activé');
      expect(finished()).toBe(false);
      // Fix it all: still not finished until a drill proves it.
      run('ssh belay', 'sudo ufw delete allow 3493/tcp', 'sudo ufw allow from 198.51.100.142 to any port 3493 proto tcp');
      edit('sudo nano /etc/nut/upsd.users', ['[harness]\n\tpassword = Nas-Secret-77\n\tupsmon primary', '[harness]\n\tpassword = Nas-Secret-77\n\tupsmon secondary']);
      edit('sudo nano /etc/nut/ups.conf', ['ondelay = 60', 'ondelay = 240']);
      run('sudo systemctl reload nut-server', 'ssh harness', 'sudo systemctl enable --now nut-monitor', 'exit');
      expect(finished()).toBe(false);
      run('sudo upsmon -c fsd');
      expect(finished()).toBe(true);
    });

    // ——— Chapter 3: Old Battery ———

    const instcmds: [string, string] = ['actions = SET\n', 'actions = SET\n\tinstcmds = test.battery.start.quick\n'];
    const toSched: [string, string] = ['NOTIFYCMD /usr/local/bin/ups-mail', 'NOTIFYCMD /usr/sbin/upssched'];
    const script: [string, string] = ['CMDSCRIPT /usr/bin/upssched-cmd', 'CMDSCRIPT /usr/local/bin/ups-alert'];
    const files: [string, string][] = [
      ['# PIPEFN /run', 'PIPEFN /run'],
      ['# LOCKFN /run', 'LOCKFN /run'],
    ];
    const timers = (online: string): [string, string] => ['#   AT ONLINE * EXECUTE ups-back-on-line', `#   AT ONLINE * EXECUTE ups-back-on-line\nAT ONBATT * START-TIMER onbatt 60\n${online}`];

    it('chapter 3 — solution: runtime, instcmds, the quick test, the new battery and its date, the test again, upssched', () => {
      const { run, edit, answer, finished, everything } = play(['last-cut', 'down-in-order'], 'old-battery');
      let all = run('cat message_from_thandiwe.txt', 'upsc hallups | grep -E "battery|test"', 'upsc -c hallups', 'upscmd -l hallups');
      expect(all).toMatch(/battery\.runtime: [5-6]\d\d$/m);
      expect(all).toContain('test.battery.start.quick - Start a quick battery test');
      expect(all).toContain('198.51.100.142');
      contains(all, 'battery.runtime est en secondes');
      all = run('upscmd -u admin -p Crimp-Admin-2031 hallups test.battery.start.quick');
      expect(all).toContain('Instant command failed: Access denied');
      contains(all, 'instcmds liste les commandes');
      edit('sudo nano /etc/nut/upsd.users', instcmds);
      run('sudo systemctl reload nut-server', 'upscmd -u admin hallups test.battery.start.quick');
      all = answer('Crimp-Admin-2031');
      expect(all).toContain('OK');
      all = run('upsc hallups ups.test.result', 'upsc hallups ups.status');
      expect(all).toContain('Done and warning');
      expect(all).toMatch(/OL( CHRG)? RB/);
      contains(all, 'Ikaika, ravi d\'avoir sa preuve');
      all = run('upsrw -l hallups', 'upsrw -s battery.mfr.date=2032/12/02 -u admin -p Crimp-Admin-2031 hallups', 'upsc hallups battery.mfr.date');
      expect(all).toContain('[battery.mfr.date]\nBattery manufacturing date');
      expect(all).toContain('2032/12/02');
      all = run('upscmd -u admin -p Crimp-Admin-2031 hallups test.battery.start.quick', 'upsc hallups ups.test.result');
      expect(all).toContain('Done and passed');
      contains(all, 'Le test rapide passe avec la batterie neuve');
      edit(`sudo nano ${UPSMON}`, toSched);
      edit('sudo nano /etc/nut/upssched.conf', script, ...files, timers('AT ONLINE * CANCEL-TIMER onbatt online'));
      all = run('sudo systemctl reload nut-monitor');
      expect(finished()).toBe(true);
      const box = run('sudo grep -c ^From /var/mail/thandiwe');
      // Blips go on; the mailbox no longer grows.
      run('true', 'true', 'true', 'true', 'true', 'true', 'true', 'true', 'true', 'true', 'true', 'true');
      expect(run('sudo grep -c ^From /var/mail/thandiwe').trim()).toBe(box.trim());
      contains(everything(), 'Vous avez terminé Vieille Batterie.');
    });

    it('chapter 3 — false leads: a deep test, upssched without PIPEFN, silence, a mail at every ONLINE', () => {
      const { run, edit, finished } = play(['last-cut', 'down-in-order'], 'old-battery');
      edit('sudo nano /etc/nut/upsd.users', ['actions = SET\n', 'actions = SET\n\tinstcmds = ALL\n']);
      let all = run('sudo systemctl reload nut-server', 'upscmd -u admin -p Crimp-Admin-2031 hallups test.battery.start.deep', 'upsc hallups ups.status');
      expect(all).toMatch(/CAL OB DISCHRG/);
      contains(all, 'Un test profond est un étalonnage');
      run('upscmd -u admin -p Crimp-Admin-2031 hallups test.battery.stop');
      edit(`sudo nano ${UPSMON}`, toSched);
      edit('sudo nano /etc/nut/upssched.conf', script, timers('AT ONLINE * EXECUTE online'));
      all = run('sudo systemctl reload nut-monitor');
      contains(all, 'mais upssched.conf l\'arrête');
      all = edit('sudo nano /etc/nut/upssched.conf', ...files);
      contains(all, 'Un clignement de quelques secondes envoie encore un mail');
      edit(`sudo nano ${UPSMON}`, ['NOTIFYFLAG ONBATT SYSLOG+WALL+EXEC', 'NOTIFYFLAG ONBATT IGNORE']);
      all = run('sudo systemctl reload nut-monitor');
      contains(all, 'même une vraie coupure');
      expect(finished()).toBe(false);
    });
  });
