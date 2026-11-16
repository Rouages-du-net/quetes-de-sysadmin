// Standalone neutral tools: killall (stop processes by exact name) and
// netstat (the older counterpart of ss). Tested directly through the
// commands table, with a seeded state, since no chapter lists them yet.

import { describe, it, expect } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { COMMANDS } from '../src/engine/commands';
import type { Process } from '../src/engine/commands/system';

const chapter = STORIES[0].chapters[0];
function shell(who = 'you') {
  const s = new Shell(chapter, 'en');
  s.who = who;
  return s;
}
const run = (s: Shell, cmd: string, ...args: string[]) => COMMANDS[cmd].launch({ args, input: null, game: s, last: true }) ?? '';
const proc = (pid: number, user: string, command: string): Process => ({ pid, user, cpu: 0, mem: 0.1, command });

describe('killall', () => {
  it('stops every process whose program name matches exactly', () => {
    const s = shell('root');
    s.state.process = [proc(10, 'root', 'tail -f /var/log/syslog'), proc(11, 'you', 'tail -f /var/log/auth.log'), proc(12, 'root', 'tailspin')];
    run(s, 'killall', 'tail');
    // "tail" goes, "tailspin" (a different program name) stays.
    expect((s.state.process as Process[]).map((p) => p.pid)).toEqual([12]);
  });

  it('-u without a name stops every process of the account', () => {
    const s = shell('root');
    s.state.process = [proc(10, 'deploy', 'node server.js'), proc(11, 'deploy', '/bin/sh loop'), proc(12, 'root', 'cron -f')];
    run(s, 'killall', '-u', 'deploy');
    expect((s.state.process as Process[]).map((p) => p.pid)).toEqual([12]);
  });

  it('exits 1 and reports when a name matches nothing', () => {
    const s = shell('root');
    s.state.process = [proc(10, 'root', 'nginx: master process')];
    const out = run(s, 'killall', 'ghost');
    expect([out, ...s.recoverErrors()].join('\n')).toContain('killall: ghost: no process found');
    expect(s.status).toBe(1);
  });

  it('sends the chosen signal, and -u limits to an account', () => {
    const s = shell('root');
    const kept: string[] = [];
    s.state.onSignal = (_g: Shell, p: Process, sig: string) => void kept.push(`${p.pid}:${sig}`);
    s.state.process = [proc(20, 'marc', 'worker'), proc(21, 'lea', 'worker')];
    run(s, 'killall', '-STOP', '-u', 'marc', 'worker');
    expect(kept).toEqual(['20:STOP']);
    // lea's worker is untouched (stopped, not removed; STOP keeps the process).
    expect((s.state.process as Process[]).find((p) => p.pid === 21)).toBeTruthy();
  });

  it('a non-root user cannot stop another account\'s process', () => {
    const s = shell('you');
    s.state.process = [proc(30, 'root', 'cron')];
    run(s, 'killall', 'cron');
    expect([...s.recoverErrors()].join('\n')).toContain('Operation not permitted');
    expect((s.state.process as Process[]).length).toBe(1);
  });
});

describe('netstat', () => {
  const listening = () => [
    { proto: 'tcp' as const, address: '0.0.0.0', port: 22, process: 'sshd', pid: 700 },
    { proto: 'tcp' as const, address: '127.0.0.1', port: 5432, process: 'postgres', pid: 800 },
    { proto: 'udp' as const, address: '0.0.0.0', port: 514, process: 'rsyslogd', pid: 611 },
  ];

  it('-tlnp lists the listening TCP ports with their program (root)', () => {
    const s = shell('root');
    s.state.listening = listening();
    const out = run(s, 'netstat', '-tlnp');
    expect(out).toContain('Active Internet connections (only servers)');
    expect(out).toMatch(/tcp .* 0\.0\.0\.0:22 .* LISTEN .* 700\/sshd/);
    expect(out).toMatch(/tcp .* 127\.0\.0\.1:5432 .* LISTEN .* 800\/postgres/);
    // -t without -u: no UDP line.
    expect(out).not.toContain('514');
  });

  it('-u shows UDP, -n keeps numbers, and the program is hidden without root', () => {
    const s = shell('you');
    s.state.listening = listening();
    const out = run(s, 'netstat', '-ulnp');
    expect(out).toMatch(/udp .* 0\.0\.0\.0:514/);
    // not root: no PID/Program column content
    expect(out).not.toContain('611/rsyslogd');
  });

  it('without -n, a known port shows its service name', () => {
    const s = shell('root');
    s.state.listening = [listening()[0]];
    expect(run(s, 'netstat', '-tl')).toMatch(/0\.0\.0\.0:ssh\b/);
  });
});
