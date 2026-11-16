// iptables (the classic host firewall): the filter table and its verdict,
// the command, and the effect on a port's reachability (ports.ts).

import { describe, it, expect } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { COMMANDS } from '../src/engine/commands';
import { newIptables, outVerdict, verdict, type Iptables } from '../src/engine/iptables';
import { portState } from '../src/engine/ports';

const chapter = STORIES[0].chapters[0];
function shell(who = 'root') {
  const s = new Shell(chapter, 'en');
  s.who = who;
  return s;
}
const run = (s: Shell, ...args: string[]) => (COMMANDS.iptables.launch({ args, input: null, game: s, last: true }) ?? '') + s.recoverErrors().map((e) => '\n' + e).join('');
const state = (s: Shell) => s.state.iptables as Iptables;

describe('iptables: the command and the model', () => {
  it('appends rules, sets the policy, and decides a connection', () => {
    const s = shell();
    run(s, '-A', 'INPUT', '-p', 'tcp', '--dport', '22', '-j', 'ACCEPT');
    run(s, '-A', 'INPUT', '-p', 'tcp', '--dport', '80', '-j', 'ACCEPT');
    run(s, '-P', 'INPUT', 'DROP');
    expect(verdict(state(s), 22, '203.0.113.9')).toBe('accepted');
    expect(verdict(state(s), 80, '203.0.113.9')).toBe('accepted');
    expect(verdict(state(s), 443, '203.0.113.9')).toBe('blocked'); // policy DROP
  });

  it('matches a source network, and REJECT refuses', () => {
    const s = shell();
    run(s, '-A', 'INPUT', '-s', '10.0.0.0/8', '-p', 'tcp', '--dport', '5432', '-j', 'ACCEPT');
    run(s, '-A', 'INPUT', '-p', 'tcp', '--dport', '5432', '-j', 'REJECT');
    expect(verdict(state(s), 5432, '10.1.2.3')).toBe('accepted'); // from the LAN
    expect(verdict(state(s), 5432, '203.0.113.9')).toBe('refused'); // from outside
  });

  it('a stateful set-up: ESTABLISHED,RELATED does not accept a NEW connection', () => {
    const s = shell();
    run(s, '-A', 'INPUT', '-m', 'state', '--state', 'ESTABLISHED,RELATED', '-j', 'ACCEPT');
    run(s, '-A', 'INPUT', '-p', 'tcp', '--dport', '22', '-j', 'ACCEPT');
    run(s, '-P', 'INPUT', 'DROP');
    expect(verdict(state(s), 22, '203.0.113.9')).toBe('accepted'); // explicit NEW accept
    expect(verdict(state(s), 80, '203.0.113.9')).toBe('blocked'); // only the stateful rule would match, and not for NEW
  });

  it('-i lo only matches the machine itself; -L -n shows 0.0.0.0/0', () => {
    const s = shell();
    run(s, '-A', 'INPUT', '-i', 'lo', '-j', 'ACCEPT');
    run(s, '-A', 'INPUT', '-p', 'tcp', '--dport', '22', '-j', 'ACCEPT');
    run(s, '-P', 'INPUT', 'DROP');
    expect(verdict(state(s), 3000, '127.0.0.1')).toBe('accepted');
    expect(verdict(state(s), 3000, '203.0.113.9')).toBe('blocked');
    expect(verdict(state(s), 22, '203.0.113.9')).toBe('accepted');
    expect(run(s, '-L', 'INPUT', '-n')).toMatch(/ACCEPT\s+all\s+--\s+0\.0\.0\.0\/0\s+0\.0\.0\.0\/0\s+in:lo/);
  });

  it('the OUTPUT chain decides an outgoing connection', () => {
    const s = shell();
    run(s, '-A', 'OUTPUT', '-d', '198.51.100.66', '-j', 'DROP');
    expect(outVerdict(state(s), '198.51.100.66', 3333)).toBe('blocked');
    expect(outVerdict(state(s), '198.51.100.67', 3333)).toBe('accepted');
    expect(run(s, '-S', 'OUTPUT')).toContain('-A OUTPUT -d 198.51.100.66/32 -j DROP');
  });

  it('-L lists, -S dumps, -D and -I edit, -F flushes', () => {
    const s = shell();
    run(s, '-A', 'INPUT', '-p', 'tcp', '--dport', '22', '-j', 'ACCEPT');
    run(s, '-A', 'INPUT', '-p', 'tcp', '--dport', '80', '-j', 'DROP');
    const l = run(s, '-L', 'INPUT', '-n');
    expect(l).toContain('Chain INPUT (policy ACCEPT)');
    expect(l).toMatch(/ACCEPT .*tcp .*dpt:22/);
    expect(run(s, '-S', 'INPUT')).toContain('-A INPUT -p tcp --dport 22 -j ACCEPT');
    // insert at the top, delete by spec, delete by number
    run(s, '-I', 'INPUT', '1', '-p', 'tcp', '--dport', '443', '-j', 'ACCEPT');
    expect(state(s).filter.chains.INPUT.rules[0].dport).toBe(443);
    run(s, '-D', 'INPUT', '-p', 'tcp', '--dport', '80', '-j', 'DROP');
    expect(state(s).filter.chains.INPUT.rules.some((r) => r.dport === 80)).toBe(false);
    run(s, '-F');
    expect(state(s).filter.chains.INPUT.rules).toHaveLength(0);
  });

  it('needs root, and iptables-save prints the ruleset', () => {
    const user = shell('you');
    expect(run(user, '-L')).toContain('you must be root');
    const s = shell();
    run(s, '-A', 'INPUT', '-p', 'tcp', '--dport', '22', '-j', 'ACCEPT');
    const saved = (COMMANDS['iptables-save'].launch({ args: [], input: null, game: s, last: true }) ?? '') as string;
    expect(saved).toContain('*filter');
    expect(saved).toContain('-A INPUT -p tcp --dport 22 -j ACCEPT');
    expect(saved).toContain('COMMIT');
  });
});

describe('iptables: a port\'s reachability', () => {
  it('a DROP on a listening port makes it filtered, an ACCEPT keeps it open', () => {
    const s = shell();
    s.state.listening = [
      { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 700 },
      { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: 800 },
    ];
    s.state.iptables = newIptables();
    run(s, '-A', 'INPUT', '-p', 'tcp', '--dport', '22', '-j', 'ACCEPT');
    run(s, '-A', 'INPUT', '-p', 'tcp', '--dport', '80', '-j', 'DROP');
    run(s, '-P', 'INPUT', 'DROP');
    expect(portState(s, 22, false, '203.0.113.9')).toBe('open');
    expect(portState(s, 80, false, '203.0.113.9')).toBe('filtered');
    expect(portState(s, 443, false, '203.0.113.9')).toBe('filtered'); // policy DROP, nothing listening anyway
    // a local connection ignores the firewall
    expect(portState(s, 80, true, '127.0.0.1')).toBe('open');
  });
});
