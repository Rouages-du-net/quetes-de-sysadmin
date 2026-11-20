// systemd and the journal on a Debian machine (commands/systemd.ts): the
// default units of a machine whose chapter models none (debian.ts),
// systemctl status without a unit, list-unit-files, is-enabled of a static
// unit; journalctl --since "1 hour ago", -p ranges, -b -1, --list-boots,
// -r, -g, -o short-iso and cat.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';
import { systemd } from '../src/engine/systemd';

const chapter = (): Chapter => ({
  id: 'systemd-test',
  number: 1,
  commands: ['ls', 'cat', 'systemctl', 'journalctl', 'sudo', 'ps', 'reboot', 'grep'],
  home: '/home/you',
  welcome: 'notes',
  final: 'end',
  password: 'sunflower',
  events: [],
  createWorld: () => d({ etc: d({ hostname: f('kneader', { lines: true }) }), home: d({ you: d({ notes: f('x') }) }) }),
});
const shell = () => {
  const s = new Shell(chapter(), 'en', 'kneader');
  s.execute('sudo true');
  s.execute('sunflower');
  return s;
};

describe('systemctl on a default Debian machine', () => {
  it('status without a unit: the machine, running, its control groups', () => {
    const s = shell();
    const out = s.execute('systemctl status') ?? '';
    expect(out.split('\n').slice(0, 2)).toEqual(['● kneader', '    State: running']);
    expect(out).toContain('   Failed: 0 units');
    expect(out).toContain('           │ ├─cron.service\n           │ │ └─489 /usr/sbin/cron -f');
    expect(out).toContain(`               │ ├─${s.shellPid} -bash`);
    expect(out).toContain('systemctl status');
    // A failed service: degraded.
    systemd(s)!.services.cron.state = 'failed';
    expect(s.execute('systemctl status')).toContain('    State: degraded');
    expect(s.execute('systemctl --failed')).toContain('cron.service');
  });

  it('list-unit-files: STATE and PRESET, filtered by type, state, pattern', () => {
    const s = shell();
    const all = s.execute('systemctl list-unit-files') ?? '';
    expect(all.split('\n')[0]).toMatch(/^UNIT FILE +STATE +PRESET$/);
    expect(all).toMatch(/^cron\.service +enabled +enabled$/m);
    expect(all).toMatch(/^systemd-journald\.service +static +-$/m);
    expect(all).toMatch(/\n\n\d+ unit files listed\.$/);
    expect(s.execute('systemctl list-unit-files --type=service --state=enabled')).toBe(
      'UNIT FILE                 STATE   PRESET\ncron.service              enabled enabled\ngetty@tty1.service        enabled enabled\nssh.service               enabled enabled\nsystemd-timesyncd.service enabled enabled\n\n4 unit files listed.',
    );
    expect(s.execute("systemctl list-unit-files 'ss*'")).toContain('ssh.service');
    expect(s.execute('systemctl is-enabled systemd-journald')).toBe('static');
    expect(s.execute('systemctl status systemd-journald')).toContain('Loaded: loaded (/usr/lib/systemd/system/systemd-journald.service; static)');
    s.execute('sudo systemctl disable cron');
    expect(s.execute('systemctl is-enabled cron')).toBe('disabled');
    expect(s.lastStatus).toBe(1);
  });
});

describe('journalctl', () => {
  it('--since "1 hour ago", -p, -g, -r, -o', () => {
    const s = shell();
    const hour = s.execute('sudo journalctl --since "1 hour ago"');
    expect(hour).toContain('CRON[2392]: (root) CMD (cd / && run-parts --report /etc/cron.hourly)');
    expect(hour).toContain('Accepted publickey for you from 192.0.2.2');
    expect(hour).not.toContain('Starting cron.service');
    expect(s.execute('sudo journalctl --since "30 min ago" -u ssh -o cat')).toMatch(/^Accepted publickey for you/);
    expect(s.execute('sudo journalctl -p err')).toBe('-- No entries --');
    expect(s.execute('sudo journalctl -g "session opened" -r -n 1 --no-pager')).toContain('sshd-session[');
    expect(s.execute('sudo journalctl -u cron -o short-iso -n 1')).toMatch(/^2026-12-31T23:17:00\+01:00 kneader CRON\[2391\]: pam_unix\(cron:session\): session closed for user root$/);
    expect(s.execute('sudo journalctl -o json')).toBe("Unknown output format 'json'.");
  });

  it('-b -1 after a reboot; --list-boots', () => {
    const s = shell();
    expect(s.execute('sudo journalctl -b -1')).toBe('Data from the specified boot (-1) is not available: No such boot ID in journal');
    s.execute('sudo reboot');
    const previous = s.execute('sudo journalctl -b -1');
    expect(previous).toContain('Started cron.service');
    expect(previous).toContain('The system will reboot now!');
    expect(s.execute('sudo journalctl -b 0')).not.toContain('Accepted publickey');
    const boots = (s.execute('sudo journalctl --list-boots') ?? '').split('\n');
    expect(boots[0]).toBe('IDX BOOT ID                          FIRST ENTRY                 LAST ENTRY');
    expect(boots[1]).toMatch(/^ -1 01f3c1e9a7d54b2c8e06a1d9f4b7c2e5 /);
    expect(boots[2]).toMatch(/^ {2}0 02f3c1e9a7d54b2c8e06a1d9f4b7c2e5 /);
    // The base processes come back with the boot.
    expect(s.execute('ps aux')).toContain('/usr/sbin/cron -f');
  });

  it('the manual, in French too', () => {
    const s = new Shell(chapter(), 'fr', 'kneader');
    expect(s.execute('man journalctl')).toContain('-b -1 montre le démarrage d\'avant');
    expect(s.execute('man systemctl')).toContain('list-unit-files liste les fichiers');
  });
});
