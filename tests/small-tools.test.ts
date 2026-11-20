// Small everyday tools (commands/small-tools.ts): basename, dirname,
// realpath, yes, tac, nl, column, paste, md5sum, sha1sum, cmp, whereis,
// more, vmstat, lscpu, timeout, install, chattr/lsattr, shutdown,
// poweroff, ss -s; htop and cal aren't installed on a minimal Debian.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';

const mine = { owner: 'you' };
const chapter = (): Chapter => ({
  id: 'small-tools-test',
  number: 1,
  commands: ['ls', 'cat', 'cut', 'sha256sum', 'which', 'free', 'nproc', 'reboot', 'chmod', 'sleep', 'echo', 'sudo', 'diff', 'ss', 'head', 'rm', 'mv', 'tee'],
  home: '/home/you',
  welcome: 't',
  final: '',
  events: [],
  password: 'sunflower',
  createWorld: () =>
    d({
      etc: d({ 'resolv.conf': f('nameserver 192.0.2.53', { lines: true, owner: 'root' }) }),
      tmp: d({}, undefined, { mode: 'rwxrwxrwt' }),
      home: d({ you: d({ t: f('a b\nccc d', { lines: true, ...mine }), u: f('1\n2', { lines: true, ...mine }), lk: f('', { link: 't', ...mine }) }, undefined, mine) }),
    }),
});
const shell = (language: 'en' | 'fr' = 'en') => {
  const s = new Shell(chapter(), language);
  s.colours = false;
  return s;
};
const root = (s: Shell) => {
  s.execute('sudo true');
  s.execute(s.t.language === 'fr' ? 'tournesol' : 'sunflower');
};

describe('names and paths', () => {
  it('basename, dirname, realpath', () => {
    const s = shell();
    expect(s.execute('basename /srv/backup/site.tar.gz .tar.gz')).toBe('site');
    expect(s.execute('basename -s .txt x.txt y.txt')).toBe('x\ny');
    expect(s.execute('basename')).toBe("basename: missing operand\nTry 'basename --help' for more information.");
    expect(s.execute('dirname /a/b/c a b/ /')).toBe('/a/b\n.\n.\n/');
    expect(s.execute('realpath lk ../you/./u')).toBe('/home/you/t\n/home/you/u');
    expect(s.execute('realpath nope')).toBe('/home/you/nope');
    expect(s.execute('realpath nope/x')).toBe('realpath: nope/x: No such file or directory');
    expect(s.execute('realpath -e nope')).toBe('realpath: nope: No such file or directory');
  });
});

describe('text', () => {
  it('yes, tac, nl, column, paste', () => {
    const s = shell('fr');
    expect(s.execute('yes | head -3')).toBe('y\ny\ny');
    expect(s.execute('yes ok | head -1')).toBe('ok');
    expect(s.execute('tac t')).toBe('ccc d\na b');
    expect(s.execute('nl t')).toBe('     1\ta b\n     2\tccc d');
    expect(s.execute('echo -e "a\\n\\nb" | nl')).toBe('     1\ta\n       \n     2\tb');
    expect(s.execute('column -t t')).toBe('a    b\nccc  d');
    expect(s.execute('echo -e "a:b\\nccc:d" | column -t -s:')).toBe('a    b\nccc  d');
    expect(s.execute('paste t u')).toBe('a b\t1\nccc d\t2');
    expect(s.execute('paste -d, t u')).toBe('a b,1\nccc d,2');
    expect(s.execute('paste -sd+ u')).toBe('1+2');
    expect(s.execute('more t u')).toBe('::::::::::::::\nt\n::::::::::::::\na b\nccc d\n::::::::::::::\nu\n::::::::::::::\n1\n2');
  });

  it('md5sum and sha1sum give the real digests, cmp the first difference', () => {
    const s = shell();
    expect(s.execute('md5sum t')).toBe('27478adb04ef4b2500cb84ef509056aa  t');
    expect(s.execute('sha1sum t')).toBe('ee891b97d9425ac6e60bead8cdc3dab31787f2c6  t');
    expect(s.execute('echo x | md5sum')).toBe('401b30e3b8b5d629635a5c613cdb7919  -');
    s.execute('md5sum t u > sums');
    expect(s.execute('md5sum -c sums')).toBe('t: OK\nu: OK');
    expect(s.execute('cmp t u')).toBe('t u differ: char 1, line 1');
    expect(s.lastStatus).toBe(1);
    expect(s.execute('cmp -s t t')).toBe('');
    expect(s.lastStatus).toBe(0);
    expect(s.execute('cmp t nope')).toBe('cmp: nope: No such file or directory');
    expect(s.lastStatus).toBe(2);
  });
});

describe('the machine', () => {
  it('whereis, vmstat, lscpu; htop and cal are not installed', () => {
    const s = shell();
    expect(s.execute('whereis ls nothing')).toBe('ls: /usr/bin/ls /usr/share/man/man1/ls.1.gz\nnothing:');
    expect(s.execute('vmstat')!.split('\n')[1]).toBe(' r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu');
    expect(s.execute('lscpu')).toMatch(/^Architecture: +x86_64\n/);
    expect(s.execute('lscpu')).toContain(`CPU(s):                                  ${s.execute('nproc')}`);
    expect(s.execute('htop')).toContain('htop: command not found');
    expect(s.execute('cal')).toContain('cal: command not found');
    expect(s.execute('ss -s')).toMatch(/^Total: \d+\nTCP: {3}\d+ \(estab \d+, closed 0, orphaned 0, timewait 0\)\n\nTransport Total {5}IP {8}IPv6\n/);
  });

  it('timeout stops what lasts too long', () => {
    const s = shell();
    expect(s.execute('timeout 1 sleep 3')).toBe('');
    expect(s.lastStatus).toBe(124);
    expect(s.execute('timeout -s KILL 1 sleep 3; echo $?')).toBe('137');
    expect(s.execute('timeout 5 echo hi')).toBe('hi');
    expect(s.execute('timeout 5 nothing')).toBe("timeout: failed to run command 'nothing': No such file or directory");
    expect(s.lastStatus).toBe(127);
  });

  it('install copies with its rights; -d creates directories', () => {
    const s = shell();
    s.execute('install -m 640 t /tmp/inst');
    expect(s.execute('ls -l /tmp/inst')).toMatch(/^-rw-r----- .* \/tmp\/inst$/);
    s.execute('install -d -m 750 /tmp/a/b');
    expect(s.execute('ls -ld /tmp/a/b')).toMatch(/^drwxr-x---/);
    expect(s.execute('install -o root t /tmp/x')).toBe("install: cannot change ownership of '/tmp/x': Operation not permitted");
  });
});

describe('chattr and lsattr', () => {
  it('+i stops even root, until -i', () => {
    const s = shell();
    expect(s.execute('chattr +i t')).toBe('chattr: Operation not permitted while setting flags on t');
    root(s);
    s.execute('sudo chattr +i /etc/resolv.conf');
    expect(s.execute('lsattr /etc/resolv.conf')).toBe('----i---------e------- /etc/resolv.conf');
    expect(s.execute('sudo rm /etc/resolv.conf')).toBe("rm: cannot remove '/etc/resolv.conf': Operation not permitted");
    expect(s.execute('echo x | sudo tee /etc/resolv.conf')).toBe('tee: /etc/resolv.conf: Operation not permitted\nx');
    expect(s.execute('sudo mv /etc/resolv.conf /tmp/')).toBe("mv: cannot move '/etc/resolv.conf' to '/tmp/resolv.conf': Operation not permitted");
    expect(s.execute('cat /etc/resolv.conf')).toBe('nameserver 192.0.2.53');
    s.execute('sudo chattr -i /etc/resolv.conf');
    expect(s.execute('lsattr /etc/resolv.conf')).toBe('--------------e------- /etc/resolv.conf');
    expect(s.execute('sudo rm /etc/resolv.conf')).toBe('');
  });

  it('+a: a file that can only grow', () => {
    const s = shell();
    root(s);
    s.execute('sudo chattr +a /home/you/t');
    expect(s.execute('echo z > t')).toBe('-bash: t: Operation not permitted');
    expect(s.execute('echo z >> t && cat t')).toBe('a b\nccc d\nz');
  });
});

describe('stopping the machine', () => {
  it('shutdown schedules or cancels; poweroff and shutdown now drop the session like reboot', () => {
    const s = shell();
    expect(s.execute('poweroff')).toBe('Call to PowerOff failed: Access denied\n(you need to be root: sudo poweroff)');
    root(s);
    expect(s.execute('sudo shutdown +10')).toMatch(/^Shutdown scheduled for \w{3} \d{4}-\d\d-\d\d \d\d:\d\d:00 UTC, use 'shutdown -c' to cancel\.$/);
    expect(s.execute('sudo shutdown -c')).toBe('');
    s.execute('sudo poweroff');
    expect(s.reboot).toBe(true);
    s.reboot = false;
    s.execute('sudo shutdown -r now');
    expect(s.reboot).toBe(true);
  });
});
