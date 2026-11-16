// FreeBSD's flavour (see src/engine/freebsd.ts): sed, stat and date in their
// GNU and BSD versions, rc.conf, and pf where the last matching rule wins.
// Tested through the commands table, with a seeded state.

import { describe, it, expect } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { COMMANDS } from '../src/engine/commands';
import { parsePf, pfVerdict, rcConf, setRc, type PfState } from '../src/engine/freebsd';
import { f } from '../src/engine/world';
import { newSystemd } from '../src/engine/systemd';

const chapter = STORIES[0].chapters[0];
function shell(bsd: boolean) {
  const s = new Shell(chapter, 'en');
  s.who = 'root';
  if (bsd) s.state.os = 'freebsd';
  s.state.systemd = newSystemd('test', Date.UTC(2029, 9, 1), Date.UTC(2029, 9, 6, 10, 0), {});
  for (const dir of ['/tmp', '/etc']) if (!s.exists(dir)) s.place('test', dir, { type: 'directory', children: {}, owner: 'root' });
  s.place('test', '/tmp/state.conf', f('last=2029-09-01', { lines: true }));
  return s;
}
const run = (s: Shell, cmd: string, ...args: string[]) => (COMMANDS[cmd].launch({ args, input: null, game: s, last: true }) ?? '') + s.recoverErrors().map((e) => '\n' + e).join('');

describe('sed: GNU and BSD', () => {
  it('GNU: -i alone edits in place', () => {
    const s = shell(false);
    run(s, 'sed', '-i', 's/^last=.*/last=2029-10-05/', '/tmp/state.conf');
    expect(s.read('/tmp/state.conf')).toBe('last=2029-10-05');
  });
  it("BSD: -i takes the next word as the suffix; -i '' for none", () => {
    const s = shell(true);
    // The file's name read as the script: /tmp/ an address, then s with t as its delimiter.
    expect(run(s, 'sed', '-i', 's/^last=.*/last=2029-10-05/', '/tmp/state.conf')).toContain('sed: 1: "/tmp/state.conf"');
    expect(run(s, 'sed', '-i', 's/a/b/', 'notes.txt')).toContain('sed: 1: "notes.txt": invalid command code n');
    run(s, 'sed', '-i', '', 's/^last=.*/last=2029-10-05/', '/tmp/state.conf');
    expect(s.read('/tmp/state.conf')).toBe('last=2029-10-05');
    run(s, 'sed', '-i', '.bak', 's/2029/2030/', '/tmp/state.conf');
    expect(s.read('/tmp/state.conf.bak')).toBe('last=2029-10-05');
  });
  it('s with groups and g, d, p with -n, addresses', () => {
    const s = shell(false);
    s.place('test', '/tmp/t', f('a1 a2\n# c\nb3', { lines: true }));
    expect(run(s, 'sed', 's/a\\([0-9]\\)/[\\1]/g', '/tmp/t')).toBe('[1] [2]\n# c\nb3');
    expect(run(s, 'sed', '/^#/d', '/tmp/t')).toBe('a1 a2\nb3');
    expect(run(s, 'sed', '-n', '$p', '/tmp/t')).toBe('b3');
  });
});

describe('stat and date: GNU and BSD', () => {
  it('stat -c on Linux, -f on FreeBSD; each refuses the other', () => {
    expect(run(shell(false), 'stat', '-c', '%s', '/tmp/state.conf')).toBe('15');
    expect(run(shell(true), 'stat', '-f', '%z', '/tmp/state.conf')).toBe('15');
    expect(run(shell(true), 'stat', '-c', '%s', '/tmp/state.conf')).toContain('stat: illegal option -- c');
  });
  it('date -d on Linux, -v on FreeBSD; each refuses the other', () => {
    expect(run(shell(false), 'date', '-d', 'yesterday', '+%F')).toBe('2029-10-05');
    expect(run(shell(false), 'date', '-d', '3 days ago', '+%F')).toBe('2029-10-03');
    expect(run(shell(false), 'date', '-v-1d', '+%F')).toContain("invalid option -- 'v'");
    expect(run(shell(true), 'date', '-v-1d', '+%F')).toBe('2029-10-05');
    expect(run(shell(true), 'date', '-v-1m', '-v1d', '+%F')).toBe('2029-09-01');
    expect(run(shell(true), 'date', '-d', 'yesterday')).toContain('date: illegal option -- d');
  });
});

describe('rc.conf and pf', () => {
  it('sysrc-like writes keep the other lines', () => {
    const s = shell(true);
    s.place('test', '/etc/rc.conf', f('hostname="projector"\nsshd_enable="YES"', { lines: true }));
    setRc(s, 'nginx_enable', 'YES');
    setRc(s, 'sshd_enable', 'NO');
    expect(rcConf(s)).toEqual({ hostname: 'projector', sshd_enable: 'NO', nginx_enable: 'YES' });
  });
  it('pf: the last matching rule wins, unless quick', () => {
    const load = (text: string): PfState => {
      const r = parsePf(text, '/etc/pf.conf');
      if ('errors' in r) throw new Error(r.errors.join('\n'));
      return { enabled: true, rules: r.rules, skip: r.skip };
    };
    const iptablesOrder = load('pass in proto tcp to port { 22 80 }\nblock in all');
    expect(pfVerdict(iptablesOrder, 22, '203.0.113.9')).toBe('blocked');
    const pfOrder = load('block in all\npass in proto tcp to port { 22 80 }');
    expect(pfVerdict(pfOrder, 22, '203.0.113.9')).toBe('accepted');
    expect(pfVerdict(pfOrder, 3306, '203.0.113.9')).toBe('blocked');
    const quick = load('pass in quick proto tcp to port ssh\nblock return in all');
    expect(pfVerdict(quick, 22, '203.0.113.9')).toBe('accepted');
    expect(pfVerdict(quick, 80, '203.0.113.9')).toBe('refused');
    const macro = load('web = "{ 80 443 }"\nblock in all\npass in proto tcp from 192.0.2.0/24 to any port $web');
    expect(pfVerdict(macro, 443, '192.0.2.2')).toBe('accepted');
    expect(pfVerdict(macro, 443, '203.0.113.9')).toBe('blocked');
  });
  it('pfctl -nf reports a syntax error with its line', () => {
    const s = shell(true);
    s.place('test', '/etc/pf.conf', f('block in all\npass in tcp port 22', { lines: true }));
    expect(run(s, 'pfctl', '-nf', '/etc/pf.conf')).toContain('/etc/pf.conf:2: syntax error');
  });
});
