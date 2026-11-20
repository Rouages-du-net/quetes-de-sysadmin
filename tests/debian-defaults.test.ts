// A Debian machine's default state (debian.ts): what a chapter that models
// no mounts, processes, memory or network still shows, like a fresh
// Debian 13 server; and what a chapter models stays its own.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';

const chapter = (state?: () => Record<string, unknown>): Chapter => ({
  id: 'debian-test',
  number: 1,
  commands: ['ls', 'cat', 'ps', 'df', 'mount', 'free', 'ip', 'hostname', 'top', 'findmnt', 'uname', 'sudo', 'kill', 'grep', 'apt'],
  home: '/home/you',
  welcome: 'notes',
  final: 'end',
  password: 'sunflower',
  events: [],
  createWorld: () => d({ etc: d({ hostname: f('kneader', { lines: true }), hosts: f('127.0.0.1\tlocalhost\n127.0.1.1\tkneader', { lines: true }) }), usr: d({ lib: d({}) }), home: d({ you: d({ notes: f('x') }) }) }),
  ...(state ? { state } : {}),
});

describe("A Debian machine's default state", () => {
  it('df and mount: the root file system, the EFI partition, the tmpfs', () => {
    const s = new Shell(chapter(), 'en', 'kneader');
    const df = s.execute('df -h') ?? '';
    expect(df.split('\n')[0]).toMatch(/^Filesystem/);
    expect(df).toMatch(/^\/dev\/vda1 .* \/$/m);
    expect(df).toMatch(/^tmpfs .* \/run$/m);
    expect(df).toMatch(/^\/dev\/vda15 .* \/boot\/efi$/m);
    // Pseudo file systems: in mount and findmnt, not in df.
    expect(df).not.toContain('/proc');
    expect(s.execute('mount')).toContain('proc on /proc type proc (rw,nosuid,nodev,noexec,relatime)');
    expect(s.execute('mount')).toContain('/dev/vda1 on / type ext4 (rw,relatime,errors=remount-ro)');
    expect(s.execute('findmnt')).toContain('/dev/vda1');
    expect(s.execute('df -hT /home/you')).toMatch(/\/dev\/vda1\s+ext4/);
  });

  it('ps: systemd, journald, cron, sshd, the session, and ps itself', () => {
    const s = new Shell(chapter(), 'en', 'kneader');
    const ps = s.execute('ps aux');
    for (const p of ['/sbin/init', 'systemd-journald', '/usr/sbin/cron -f', 'sshd: /usr/sbin/sshd -D [listener]', `sshd-session: you@pts/0`, '-bash', 'ps aux']) expect(ps).toContain(p);
    // procps cuts a long user name: systemd+.
    expect(ps).toMatch(/^systemd\+ /m);
    expect(ps).toMatch(new RegExp(`^you +${s.shellPid} .* -bash$`, 'm'));
    // Not root: the system's processes can't be killed.
    expect(s.execute('kill 489')).toContain('489');
    expect(s.execute('ps aux')).toContain('cron');
  });

  it('free and top: 2 GiB of memory, no swap', () => {
    const s = new Shell(chapter(), 'en', 'kneader');
    expect(s.execute('free -h')).toMatch(/^Mem: +1\.9Gi/m);
    expect(s.execute('free -h')).toMatch(/^Swap: +0B/m);
    const top = s.execute('top -b -n 1');
    expect(top).toMatch(/^top - /);
    expect(top).toContain('systemd-journald');
  });

  it("ip and hostname -I: lo and eth0, with the machine's documentation address", () => {
    const s = new Shell(chapter(), 'en', 'kneader');
    const ip = s.execute('ip a');
    expect(ip).toContain('1: lo: <LOOPBACK,UP,LOWER_UP>');
    expect(ip).toContain('inet 192.0.2.24/24 brd 192.0.2.255 scope global eth0');
    expect(s.execute('ip r')).toBe('default via 192.0.2.1 dev eth0 onlink\n192.0.2.0/24 dev eth0 proto kernel scope link src 192.0.2.24');
    expect(s.execute('ip -br a')).toContain('eth0             UP             192.0.2.24/24');
    expect(s.execute('hostname -I')).toBe('192.0.2.24 ');
    expect(s.execute('hostname -i')).toBe('127.0.1.1');
    // Changing it is still root's.
    expect(s.execute('ip addr add 192.0.2.99/24 dev eth0')).toBe('RTNETLINK answers: Operation not permitted');
    expect(s.lastStatus).toBe(2);
  });

  it('/etc/os-release, hostnamectl; lsb_release is not installed', () => {
    const s = new Shell(chapter(), 'en', 'kneader');
    expect(s.execute('cat /etc/os-release')).toContain('PRETTY_NAME="Debian GNU/Linux 13 (trixie)"');
    expect(s.execute('ls -l /etc')).toContain('os-release -> ../usr/lib/os-release');
    expect(s.execute('grep VERSION_CODENAME /etc/os-release')).toBe('VERSION_CODENAME=trixie');
    expect(s.execute('cat /etc/debian_version')).toBe('13.2');
    const h = s.execute('hostnamectl');
    expect(h).toContain(' Static hostname: kneader');
    expect(h).toContain('Operating System: Debian GNU/Linux 13 (trixie)');
    expect(h).toContain('          Kernel: Linux 6.12.0-quetes');
    expect(s.execute('hostnamectl set-hostname oven')).toBe('Could not set static hostname: Access denied');
    expect(s.lastStatus).toBe(1);
    expect(s.execute('lsb_release -a')).toContain('lsb_release: command not found');
  });

  it("what the chapter models stays the chapter's", () => {
    const s = new Shell(chapter(() => ({ mounts: [{ path: '/', capacity: 1e9, name: '/dev/sda1' }], process: [{ pid: 7, user: 'root', cpu: 0, mem: 0, command: 'only' }] })), 'en', 'kneader');
    expect((s.execute('df') ?? '').split('\n')).toHaveLength(2);
    expect(s.execute('ps aux')).toBe('USER          PID  %CPU  %MEM COMMAND\nroot            7   0.0   0.0 only');
    // FreeBSD keeps its own world: nothing of Debian's.
    const bsd = new Shell(chapter(() => ({ os: 'freebsd' })), 'en', 'kneader');
    expect(bsd.state.mounts).toBeUndefined();
    expect(bsd.exists('/etc/os-release')).toBe(false);
  });

  it('the manual knows hostnamectl, in French too', () => {
    const s = new Shell(chapter(), 'fr', 'kneader');
    expect(s.execute('man hostnamectl')).toContain("montre l'identité de la machine");
  });
});
