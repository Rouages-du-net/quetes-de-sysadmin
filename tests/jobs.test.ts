// Jobs, like bash 5.2: cmd & ("[1] PID", "[1]+  Done …" after the next
// command), jobs (-l, -p), fg, bg, Ctrl-Z on a follow, kill %N (Terminated,
// Killed), wait, disown, nohup (nohup.out), watch (a screen redrawn as
// time passes, Ctrl-C), $!, and the console replaying Ctrl-Z.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';
import { colourise } from '../src/engine/highlighting';

const chapter = (): Chapter => ({
  id: 'jobs-test',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'echo', 'cat', 'tail', 'sleep', 'kill', 'touch', 'wc', 'sudo', 'exit'],
  home: '/home/you',
  welcome: 'notes.txt',
  final: 'end',
  password: 'sunflower',
  events: [],
  createWorld: () => d({ tmp: d({}), var: d({ log: d({ syslog: f('line1', { lines: true }) }) }), home: d({ you: d({ 'notes.txt': f('alpha\nbeta', { lines: true }) }) }) }),
});

const shell = () => new Shell(chapter(), 'en');
const pid = (s: Shell) => s.shellPid;

describe('Jobs', () => {
  it('cmd & prints [1] PID, runs, and is reported Done after the next command', () => {
    const s = shell();
    expect(s.execute('echo x | cat &')).toBe(`[1] ${pid(s) + 100}\nx`);
    expect(s.execute('echo $!')).toBe(`${pid(s) + 100}\n[1]+  Done                    echo x | cat`);
    expect(s.execute('true')).toBe('');
    // A failing job: Exit N.
    s.execute('cat nowhere &');
    expect(s.execute('true')).toContain('[1]+  Exit 1                  cat nowhere');
  });

  it('jobs, jobs -l, kill %N: Terminated, Killed; no such job', () => {
    const s = shell();
    s.execute('sleep 50 &');
    s.execute('sleep 60 &');
    expect(s.execute('jobs')).toBe('[1]-  Running                 sleep 50 &\n[2]+  Running                 sleep 60 &');
    expect(s.execute('jobs -l')).toContain(`[2]+  ${pid(s) + 101} Running                 sleep 60 &`);
    expect(s.execute('jobs -p')).toBe(`${pid(s) + 100}\n${pid(s) + 101}`);
    expect(s.execute('kill %3')).toBe('bash: kill: %3: no such job');
    expect(s.execute('kill %1')).toBe('');
    expect(s.execute('true')).toBe('[1]-  Terminated              sleep 50');
    expect(s.execute(`kill -9 ${pid(s) + 101}`)).toBe('');
    expect(s.execute('echo')).toBe('\n[2]+  Killed                  sleep 60'.slice(1));
    expect(s.execute('jobs')).toBe('');
  });

  it('Ctrl-Z stops a follow; bg lets it run; fg brings it back; disown forgets', () => {
    const s = shell();
    s.execute('tail -f /var/log/syslog');
    expect(s.follow).not.toBeNull();
    expect(s.suspend()).toBe('^Z\n[1]+  Stopped                 tail -f /var/log/syslog');
    expect(s.follow).toBeNull();
    expect(s.execute('jobs')).toBe('[1]+  Stopped                 tail -f /var/log/syslog');
    expect(s.execute('bg')).toBe('[1]+ tail -f /var/log/syslog &');
    expect(s.execute('bg')).toBe('-bash: bg: job 1 already in background');
    expect(s.execute('fg')).toBe('tail -f /var/log/syslog');
    expect(s.follow).not.toBeNull();
    s.suspend();
    expect(s.execute('disown')).toBe('');
    expect(s.execute('jobs; fg')).toBe('-bash: fg: current: no such job');
  });

  it('a follow started with & goes on in the background; wait waits for it until Ctrl-C', () => {
    const s = shell();
    expect(s.execute('tail -f /var/log/syslog &')).toBe(`[1] ${pid(s) + 100}\nline1`);
    expect(s.follow).toBeNull();
    expect(s.execute('jobs')).toBe('[1]+  Running                 tail -f /var/log/syslog &');
    s.execute('wait');
    expect(s.follow).not.toBeNull();
    s.follow = null;
    s.execute('sleep 5 &');
    expect(s.execute('wait %2; echo $?')).toBe('0');
    expect(s.execute('jobs')).toBe('[1]+  Running                 tail -f /var/log/syslog &');
    expect(s.execute('wait %7')).toBe('-bash: wait: %7: no such job');
    expect(s.lastStatus).toBe(127);
  });

  it('nohup appends the output to nohup.out', () => {
    const s = shell();
    expect(s.execute('nohup echo hi')).toBe("nohup: ignoring input and appending output to 'nohup.out'");
    s.execute('nohup echo again &');
    expect(s.read('/home/you/nohup.out')).toBe('hi\nagain');
    expect(s.execute('nohup')).toBe("nohup: missing operand\nTry 'nohup --help' for more information.\n[1]+  Done                    nohup echo again");
    expect(s.execute('nohup echo out > /tmp/log')).toBe('nohup: ignoring input');
    expect(s.read('/tmp/log')).toBe('out');
  });

  it('watch shows a screen, redrawn when the output changes, until Ctrl-C', () => {
    const s = shell();
    const first = s.execute('watch -n 5 wc -l notes.txt') ?? '';
    expect(first.split('\n')[0]).toMatch(/^Every 5\.0s: wc -l notes\.txt +sysadmin$/);
    expect(first).toContain('2 notes.txt');
    expect(s.follow?.screen).toBe(true);
    expect(s.follow!.read()).toBe('');
    s.find('/home/you/notes.txt')!.type === 'file' && Object.assign(s.find('/home/you/notes.txt')!, { content: 'a\nb\nc' });
    expect(s.follow!.read()).toContain('3 notes.txt');
    expect(s.execute('watch -n x ls')).toBe("watch: failed to parse argument: 'x'");
  });

  it('highlights & as an operator', () => {
    const s = shell();
    expect(colourise(s, 'sleep 5 &').find((t) => t.text === '&')?.kind).toBe('operator');
  });
});
