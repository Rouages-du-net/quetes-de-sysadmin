// Package management on a Debian 13 machine (commands/apt.ts, packages.ts):
// apt's search, show, policy, list, remove, purge and autoremove, apt-get's
// and apt-cache's script forms, dpkg's queries (-l, -L, -S, -s), lsb_release.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';
import { systemd } from '../src/engine/systemd';

const chapter = (): Chapter => ({
  id: 'packages-test',
  number: 1,
  commands: ['ls', 'cat', 'grep', 'apt', 'sudo', 'nginx', 'systemctl'],
  home: '/home/you',
  welcome: 'notes',
  final: 'end',
  password: 'sunflower',
  events: [],
  createWorld: () => d({ etc: d({ hostname: f('kneader', { lines: true }) }), usr: d({ lib: d({}), sbin: d({}), bin: d({}) }), home: d({ you: d({ notes: f('x') }) }) }),
  state: () => ({ systemd: { host: 'kneader', services: {}, log: [], clock: Date.UTC(2027, 0, 1), boot: 1 } }),
});
const shell = () => {
  const s = new Shell(chapter(), 'en', 'kneader');
  return s;
};
const asRoot = (s: Shell, line: string) => {
  const out = s.execute(line);
  return s.prompt().includes('password') ? s.execute('sunflower') : out;
};

describe('dpkg: -l, -L, -S, -s', () => {
  it('dpkg -l: the columns as wide as their longest value, ii for installed', () => {
    const s = shell();
    expect(s.execute('dpkg -l bash coreutils')).toBe(
      [
        'Desired=Unknown/Install/Remove/Purge/Hold',
        '| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend',
        '|/ Err?=(none)/Reinst-required (Status,Err: uppercase=bad)',
        '||/ Name           Version      Architecture Description',
        '+++-==============-============-============-=================================',
        'ii  bash           5.2.37-2+b5  amd64        GNU Bourne Again SHell',
        'ii  coreutils      9.7-3        amd64        GNU core utilities',
      ].join('\n'),
    );
    expect(s.execute('dpkg -l nginx')).toBe('dpkg-query: no packages found matching nginx');
    expect(s.lastStatus).toBe(1);
    expect(s.execute('dpkg -l | grep -c "^ii"')).toMatch(/^[5-9]\d$/);
  });

  it('dpkg -L, -S (merged /usr: /bin/ls is no path of a package), -s', () => {
    const s = shell();
    const files = (s.execute('dpkg -L hostname') ?? '').split('\n');
    expect(files[0]).toBe('/.');
    expect(files).toContain('/usr/bin/hostname');
    expect(files).toContain('/usr/share/man/man1/hostname.1.gz');
    expect(s.execute('dpkg -S /usr/bin/ls')).toBe('coreutils: /usr/bin/ls');
    expect(s.execute('dpkg -S /bin/ls')).toBe('dpkg-query: no path found matching pattern /bin/ls');
    expect(s.lastStatus).toBe(1);
    expect(s.execute('dpkg -S useradd')).toContain('passwd: /usr/sbin/useradd');
    expect(s.execute('dpkg -s bash')).toContain('Package: bash\nEssential: yes\nStatus: install ok installed');
    expect(s.execute('dpkg -L nginx')).toContain("dpkg-query: package 'nginx' is not installed");
    expect(s.execute('dpkg -s nginx')).toContain("dpkg-query: package 'nginx' is not installed and no information is available");
  });
});

describe('apt: search, show, policy, list', () => {
  it('the archive is seen once apt update has run; what is installed, always', () => {
    const s = shell();
    expect(s.execute('apt search nginx')).toBe('Sorting... Done\nFull Text Search... Done');
    expect(s.execute('apt show curl')).toContain('Package: curl\nVersion: 8.14.1-2');
    expect(s.execute('apt show nginx')).toBe('Error: No packages found');
    asRoot(s, 'sudo apt update');
    expect(s.execute('apt search nginx')).toContain('nginx/trixie 1.26.3-3 amd64\n  small, powerful, scalable web/proxy server');
    expect(s.execute('apt search ssh')).toContain('openssh-server/trixie 1:10.0p1-7 amd64 [installed]');
    expect(s.execute('apt policy nginx')).toBe(
      'nginx:\n  Installed: (none)\n  Candidate: 1.26.3-3\n  Version table:\n     1.26.3-3 500\n        500 http://deb.debian.org/debian trixie/main amd64 Packages',
    );
    expect(s.execute('apt-cache policy bash')).toContain('  Installed: 5.2.37-2+b5\n  Candidate: 5.2.37-2+b5\n  Version table:\n *** 5.2.37-2+b5 500');
    expect(s.execute('apt list nginx')).toBe('Listing... Done\nnginx/trixie 1.26.3-3 amd64');
    expect(s.execute('apt-cache search "web/proxy"')).toContain('nginx - small, powerful, scalable web/proxy server');
  });

  it('piped, apt warns that its interface is not stable (and still succeeds)', () => {
    const s = shell();
    const out = s.execute('apt list --installed | grep openssh-server');
    expect(out).toContain('WARNING: apt does not have a stable CLI interface. Use with caution in scripts.');
    expect(out).toContain('openssh-server/trixie,now 1:10.0p1-7 amd64 [installed]');
    expect(s.execute('apt-cache policy bash | grep Installed')).toBe('  Installed: 5.2.37-2+b5');
  });
});

describe('apt remove, purge, autoremove', () => {
  it('nginx installed with its dependency, removed (rc), its dependency autoremoved, its configuration purged', () => {
    const s = shell();
    asRoot(s, 'sudo apt update');
    s.execute('sudo apt install -y nginx');
    expect(systemd(s)!.services.nginx.state).toBe('active');
    expect(s.execute('apt list "nginx*"')).toContain('nginx-common/trixie,now 1.26.3-3 all [installed,automatic]');
    // Not root: apt stops at the lock.
    expect(s.execute('apt remove nginx')).toContain('Unable to acquire the dpkg frontend lock');
    const plan = s.execute('sudo apt remove nginx');
    expect(plan).toContain('The following package was automatically installed and is no longer required:\n  nginx-common\nUse \'sudo apt autoremove\' to remove it.');
    expect(plan).toContain('REMOVING:\n  nginx\n');
    expect(s.execute('y')).toContain('Removing nginx (1.26.3-3) ...');
    expect(systemd(s)!.services.nginx.state).toBe('inactive');
    expect(s.exists('/usr/sbin/nginx')).toBe(false);
    expect(s.execute('dpkg -l "nginx*"')).toMatch(/^rc {2}nginx {10}1\.26\.3-3/m);
    expect(s.execute('sudo apt autoremove -y')).toContain('Removing nginx-common (1.26.3-3) ...');
    const purge = s.execute('sudo apt purge -y nginx');
    expect(purge).toContain('REMOVING:\n  nginx*');
    expect(purge).toContain('Purging configuration files for nginx (1.26.3-3) ...');
    expect(s.execute('dpkg -l nginx')).toBe('dpkg-query: no packages found matching nginx');
    expect(s.execute('sudo apt remove nginx')).toContain("Package 'nginx' is not installed, so not removed");
    expect(s.execute('sudo apt remove nosuch')).toContain('Error: Unable to locate package nosuch');
  });

  it('an essential package asks for the phrase; apt-get -y refuses', () => {
    const s = shell();
    const plan = asRoot(s, 'sudo apt remove bash');
    expect(plan).toContain('WARNING: The following essential packages will be removed.');
    expect(plan).toContain("To continue type in the phrase 'Yes, do as I say!'");
    expect(s.execute('y')).toBe('Abort.');
    expect(s.execute('dpkg -l bash')).toContain('ii  bash');
    expect(s.execute('sudo apt-get remove -y bash')).toContain('E: Essential packages were removed and -y was used without --allow-remove-essential.');
    expect(s.lastStatus).toBe(100);
  });
});

describe("apt-get and apt-cache: the scripts' forms", () => {
  it('install, remove, update -qq, the E: errors', () => {
    const s = shell();
    expect(s.execute('apt-get install curl')).toBe(
      'E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?',
    );
    expect(s.lastStatus).toBe(100);
    expect(asRoot(s, 'sudo apt-get -qq update')).toBe('');
    expect(s.execute('sudo apt-get install foo')).toContain('E: Unable to locate package foo');
    const install = s.execute('sudo apt-get install -y lsb-release');
    expect(install).toContain('The following NEW packages will be installed:\n  lsb-release\n0 upgraded, 1 newly installed, 0 to remove and 0 not upgraded.');
    expect(s.execute('lsb_release -a')).toBe('Distributor ID:\tDebian\nDescription:\tDebian GNU/Linux 13 (trixie)\nRelease:\t13\nCodename:\ttrixie');
    expect(s.execute('lsb_release -cs')).toBe('trixie');
    expect(s.execute('sudo apt-get remove -y lsb-release')).toContain('The following packages will be REMOVED:\n  lsb-release\n0 upgraded, 0 newly installed, 1 to remove and 0 not upgraded.');
    expect(s.execute('lsb_release -a')).toContain('lsb_release: command not found');
    expect(s.execute('sudo apt-get install curl')).toContain('curl is already the newest version (8.14.1-2).\n0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.');
    expect(s.execute('apt-cache depends openssh-server')).toContain('  Depends: openssh-client');
  });

  it('the manual knows them, in French too', () => {
    const s = new Shell(chapter(), 'fr', 'kneader');
    expect(s.execute('man apt-get')).toContain("l'apt des scripts");
    expect(s.execute('man dpkg')).toContain('dpkg -S /usr/bin/ls');
  });
});
