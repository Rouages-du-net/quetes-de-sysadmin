// The Huts: monitoring and logs. Each chapter is replayed to the end, with
// another solution and false leads, in each language; the expected texts are
// checked in French. Also: rsyslog's configuration (legacy and RainerScript
// syntax, rsyslogd -N1, the order of the rules) and the journal on disk.

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { readConfig, route } from '../src/engine/rsyslog';
import { human, systemMaxUse } from '../src/engine/journal-files';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const PASSWORD = 'summit-2028';
const UDP = 'module(load="imudp")\ninput(type="imudp" port="514")';
const PER_HUT = 'template(name="PerHut" type="string" string="/var/log/remote/%HOSTNAME%.log")\nif $fromhost-ip startswith \'198.51.100.\' then {\n  action(type="omfile" dynaFile="PerHut")\n  stop\n}';
const FAILURES = "if $programname == 'sshd' and $msg contains 'Failed password' then /var/log/remote/ssh-failures.log";

function shell(id: string, language = 'en') {
  const s = new Shell(chapter(id), language);
  const t = translator(language);
  // The per-hut files are named after the hosts (rsyslog's %HOSTNAME%), so in this language too.
  const L = (line: string) => inLanguage(t, machinesInLanguage(t, line.replace(/hut-(lake|pass|ridge)\.log/g, (m) => `${inLanguage(t, m.slice(0, -4))}.log`)));
  const one = (l: string) => {
    let output = s.execute(L(l)) ?? '';
    if (s.waiting) output += '\n' + (s.execute(machinesInLanguage(s.t, PASSWORD)) ?? '');
    return [output, ...s.recoverErrors()].filter(Boolean).join('\n');
  };
  const play = (lines: string[]) => lines.map(one).join('\n');
  const edit = (command: string, change: (text: string) => string) => {
    const before = one(command);
    s.saveEdition(change(s.edition!.text));
    return [before, s.quitEdition() ?? ''].join('\n');
  };
  return { s, play, edit };
}

describe('rsyslog and the journal', () => {
  it('reads both syntaxes, checks with -N1, and applies the rules in order', () => {
    const { s, play, edit } = shell('central-logs');
    edit('sudo nano /etc/rsyslog.d/10-remote.conf', () => '$ModLoad imudp\n$UDPServerRun 514\n$template PerHost,"/var/log/remote/%FROMHOST-IP%.log"\n:fromhost-ip, startswith, "198.51.100." ?PerHost\n& stop');
    const c = readConfig(s);
    expect(c.errors).toEqual([]);
    expect(c.inputs).toContainEqual(expect.objectContaining({ type: 'imudp', port: 514 }));
    const hut = { host: 'hut-lake', address: '198.51.100.11', program: 'sshd', facility: 'auth', severity: 'info', text: 'Failed password for root' };
    expect(route(s, c, hut)).toEqual(['/var/log/remote/198.51.100.11.log']);
    expect(route(s, c, { ...hut, host: 'valley', address: '127.0.0.1' })).toEqual(['/var/log/auth.log']);
    expect(route(s, c, { ...hut, host: 'valley', address: '127.0.0.1', facility: 'cron' })).toEqual(['/var/log/syslog', '/var/log/cron.log']);
    edit('sudo nano /etc/rsyslog.d/10-remote.conf', () => 'if $programname = "sshd" then /var/log/x.log\nmodule(load="imnothing")');
    const out = play(['sudo rsyslogd -N1']);
    expect(out).toContain('rsyslogd: version 8.2302.0, config validation run (level 1), master config /etc/rsyslog.conf');
    expect(out).toMatch(/rsyslogd: .*\[v8\.2302\.0\]/);
    expect(s.status).toBe(1);
  });

  it('logger goes through the rules; the journal is measured and trimmed', () => {
    const { s, play, edit } = shell('journal-full');
    // -t alone keeps user.notice: the message goes to syslog, not auth.log.
    play(['logger -t sshd "Failed password for test"']);
    expect(s.read('/var/log/auth.log')).toBe('');
    play(['logger -t sshd -p auth.info "Failed password for test"']);
    expect(s.read('/var/log/auth.log') ?? '').toMatch(/ sshd: Failed password for test$/m);
    expect(play(['logger -p nowhere.info test'])).toContain('logger: unknown priority name: nowhere.info');
    expect(human(1536 * 1024 * 1024)).toBe('1.5G');
    expect(play(['journalctl --vacuum-size=1G'])).toContain('Permission denied');
    edit('sudo nano /etc/systemd/journald.conf', (t) => t.replace('#SystemMaxUse=', 'SystemMaxUse=800M'));
    expect(systemMaxUse(s)).toBe(800 * 1024 * 1024);
  });

  it('grep -h and -H choose whether to print the file name', () => {
    const { play } = shell('ssh-alerts');
    const lake = '/var/log/remote/hut-lake.log';
    expect(play([`sudo grep -c Failed ${lake} /var/log/remote/hut-pass.log`])).toMatch(/^\/var\/log\/remote\/hut-lake\.log:12$/m);
    expect(play([`sudo grep -hc Failed ${lake} /var/log/remote/hut-pass.log`])).toMatch(/^12\n12$/m);
    expect(play([`grep -H Failed ${lake}`])).toMatch(/^\/var\/log\/remote\/hut-lake\.log:.* sshd\[3100\]: Failed/m);
  });
});

for (const language of LANGUAGES)
  describe(`The Huts — ${language}`, () => {
    const fr = language === 'fr';
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const part = (id: string) => shell(id, language);
    // A pattern with the huts' names, in this language.
    const N = (re: RegExp) => new RegExp(re.source.replace(/hut-(lake|pass|ridge)/g, (m) => inLanguage(translator(language), m)));

    it('the machine is reached from the workstation', () => {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('huts')] });
      c.execute(machinesInLanguage(translator(language), 'ssh valley'));
      c.execute('yes');
      expect(c.remote?.shell.chapter.id).toBe('central-logs');
    });

    it('chapter 1 — solution: imudp, the firewall for the huts, one file per hut', () => {
      const { s, play, edit } = part('central-logs');
      let all = play(['cat message_from_lou.txt', 'ss -ulnp']);
      contains(all, 'Rien n');
      all = edit('sudo nano /etc/rsyslog.conf', (t) => t.replace('#module(load="imudp")\n#input(type="imudp" port="514")', UDP));
      all += play(['sudo rsyslogd -N1']);
      expect(all).toContain('rsyslogd: End of config validation run. Bye.');
      contains(all, 'redémarre-le');
      all = play(['sudo systemctl restart rsyslog', 'ss -ulnp', 'ls']);
      expect(all).toContain('0.0.0.0:514');
      contains(all, 'ufw ne laisse entrer');
      all = play(['sudo ufw allow from 198.51.100.0/24 to any port 514 proto udp', 'sudo tail -n 3 /var/log/syslog']);
      contains(all, 'mêlés aux siens');
      expect(s.finished).toBe(false);
      edit('sudo nano /etc/rsyslog.d/10-remote.conf', () => PER_HUT);
      all = play(['sudo systemctl restart rsyslog', 'ls /var/log/remote']);
      for (const hut of ['hut-lake', 'hut-pass', 'hut-ridge']) expect(all).toMatch(N(new RegExp(`${hut}\\.log`)));
      contains(all, 'CE QUI S');
      contains(all, '/var/log/remote/refuge-lac.log');
      expect(s.finished).toBe(true);
    });

    it('chapter 1 — another way: the legacy syntax, 514/udp, one file per address', () => {
      const { s, play, edit } = part('central-logs');
      edit('sudo nano /etc/rsyslog.conf', (t) => t.replace('#module(load="imudp")', '$ModLoad imudp').replace('#input(type="imudp" port="514")', '$UDPServerRun 514'));
      edit('sudo nano /etc/rsyslog.d/10-remote.conf', () => '$template PerHost,"/var/log/remote/%FROMHOST-IP%.log"\n:fromhost-ip, startswith, "198.51.100." ?PerHost\n& stop');
      play(['sudo ufw allow 514/udp', 'sudo systemctl restart rsyslog', 'ls']);
      expect(s.finished).toBe(true);
      expect(s.read('/var/log/remote/198.51.100.12.log')).toMatch(N(/ hut-pass hutmon\[641\]: /));
    });

    it('chapter 1 — false leads: no stop, a mistake in the configuration', () => {
      const { s, play, edit } = part('central-logs');
      edit('sudo nano /etc/rsyslog.conf', (t) => t.replace('#module(load="imudp")\n#input(type="imudp" port="514")', UDP));
      play(['sudo ufw allow from 198.51.100.0/24 to any port 514 proto udp']);
      edit('sudo nano /etc/rsyslog.d/10-remote.conf', () => PER_HUT.replace('  stop\n', '').replace('dynaFile="PerHut"', 'dynaFile="PerHost"'));
      let all = play(['sudo systemctl restart rsyslog', 'journalctl -u rsyslog']);
      expect(all).toContain("Could not find template 0 'PerHost' - action disabled");
      contains(all, 'avec des erreurs');
      // The action disabled, the huts' messages fall through to the default rules.
      contains(all, 'mêlés aux siens');
      edit('sudo nano /etc/rsyslog.d/10-remote.conf', () => PER_HUT.replace('  stop\n', ''));
      play(['sudo systemctl restart rsyslog', 'ls']);
      expect(s.finished).toBe(false);
      edit('sudo nano /etc/rsyslog.d/10-remote.conf', () => PER_HUT);
      play(['sudo systemctl restart rsyslog', 'ls']);
      expect(s.finished).toBe(true);
    });

    it('chapter 2 — solution: du, --disk-usage, --vacuum-size, SystemMaxUse=', () => {
      const { s, play, edit } = part('journal-full');
      let all = play(['cat message_from_lou.txt', 'df -h']);
      expect(all).toMatch(/\/dev\/vda1 +20G .* 9\d% \//);
      all = play(['sudo du -sh /var/log/journal', 'journalctl --disk-usage']);
      expect(all).toMatch(/6[.,]\dG\t\/var\/log\/journal/);
      expect(all).toMatch(/Archived and active journals take up 6\.\dG in the file system\./);
      contains(all, 'trente fichiers archivés');
      all = play(['sudo journalctl --vacuum-size=500M']);
      expect(all).toMatch(/Deleted archived journal \/var\/log\/journal\/6d1f3c2a9b8e47f0a1c2d3e4f5a6b7c8\/system@.*\.journal \(200\.0M\)\./);
      expect(all).toMatch(/Vacuuming done, freed .* of archived journals from \/var\/log\/journal\/6d1f3c2a9b8e47f0a1c2d3e4f5a6b7c8\./);
      contains(all, 'regrossir');
      expect(s.finished).toBe(false);
      all = edit('sudo nano /etc/systemd/journald.conf', (t) => t.replace('#SystemMaxUse=', 'SystemMaxUse=500M'));
      all += play(['ls']);
      contains(all, 'lit sa configuration');
      all = play(['sudo systemctl restart systemd-journald', 'df -h']);
      contains(all, 'LE JOURNAL SUR LE DISQUE');
      expect(s.finished).toBe(true);
    });

    it('chapter 2 — another way: a drop-in, then the restart alone trims the journal', () => {
      const { s, play, edit } = part('journal-full');
      play(['sudo mkdir /etc/systemd/journald.conf.d']);
      edit('sudo nano /etc/systemd/journald.conf.d/size.conf', () => '[Journal]\nSystemMaxUse=1G');
      play(['sudo systemctl restart systemd-journald']);
      expect(s.finished).toBe(true);
    });

    it('chapter 2 — false leads: rm, a limit too high', () => {
      const { s, play, edit } = part('journal-full');
      const dir = '/var/log/journal/6d1f3c2a9b8e47f0a1c2d3e4f5a6b7c8';
      let all = play([`sudo rm ${dir}/system.journal`]);
      contains(all, 'jamais avec rm');
      edit('sudo nano /etc/systemd/journald.conf', (t) => t.replace('#SystemMaxUse=', 'SystemMaxUse=4G'));
      all = play(['sudo systemctl restart systemd-journald', `sudo ls ${dir}`]);
      expect(all).toContain('system.journal');
      contains(all, 'trop haute');
      expect(s.finished).toBe(false);
      edit('sudo nano /etc/systemd/journald.conf', (t) => t.replace('SystemMaxUse=4G', 'SystemMaxUse=700M'));
      play(['sudo systemctl restart systemd-journald']);
      expect(s.finished).toBe(true);
    });

    it('chapter 3 — solution: a rule read before the per-hut stop', () => {
      const { s, play, edit } = part('ssh-alerts');
      let all = play(['cat message_from_lou.txt', 'ls /etc/rsyslog.d', 'sudo grep Failed /var/log/remote/hut-lake.log']);
      expect(all).toMatch(N(/hut-lake sshd\[3100\]: Failed password for invalid user admin from 203\.0\.113\.57/));
      contains(all, 'un message a des propriétés');
      edit('sudo nano /etc/rsyslog.d/05-ssh-failures.conf', () => FAILURES);
      all = play(['sudo rsyslogd -N1', 'sudo systemctl restart rsyslog', 'ls', 'ls', 'ls']);
      contains(all, 'LES RÈGLES DE RSYSLOG');
      expect(s.finished).toBe(true);
      expect(play(['sudo cat /var/log/remote/ssh-failures.log'])).toMatch(N(/hut-pass sshd\[3101\]: Failed password/));
    });

    it('chapter 3 — another way: inside the per-hut block, before the stop', () => {
      const { s, play, edit } = part('ssh-alerts');
      edit('sudo nano /etc/rsyslog.d/10-remote.conf', (t) => t.replace('  stop', `  ${FAILURES}\n  stop`));
      play(['sudo systemctl restart rsyslog', 'ls', 'ls', 'ls']);
      expect(s.finished).toBe(true);
    });

    it('chapter 3 — false leads: after the stop, too wide, a stop that breaks the per-hut files', () => {
      const { s, play, edit } = part('ssh-alerts');
      edit('sudo nano /etc/rsyslog.d/20-ssh.conf', () => FAILURES);
      let all = play(['sudo systemctl restart rsyslog']);
      contains(all, 'Une règle placée\n    après ne les voit jamais'.replace('\n    ', ' '));
      play(['sudo mv /etc/rsyslog.d/20-ssh.conf /etc/rsyslog.d/05-ssh.conf']);
      edit('sudo nano /etc/rsyslog.d/05-ssh.conf', () => "if $programname == 'sshd' then /var/log/remote/ssh-failures.log");
      all = play(['sudo systemctl restart rsyslog', 'ls', 'ls', 'ls']);
      contains(all, 'trop large');
      expect(s.finished).toBe(false);
      edit('sudo nano /etc/rsyslog.d/05-ssh.conf', () => `if $programname == 'sshd' then {\n  /var/log/remote/ssh-failures.log\n  stop\n}`);
      all = play(['sudo systemctl restart rsyslog']);
      contains(all, 'ne reçoivent plus rien');
      expect(s.finished).toBe(false);
      edit('sudo nano /etc/rsyslog.d/05-ssh.conf', () => FAILURES);
      play(['sudo truncate -s 0 /var/log/remote/ssh-failures.log', 'sudo systemctl restart rsyslog', 'ls', 'ls', 'ls']);
      expect(s.finished).toBe(true);
    });
  });
