// Accounts on a Debian machine (commands/accounts.ts): useradd with
// Debian's defaults, adduser's questions, passwd (one's own after the
// current password, root's for another, -l, -u, -S, -a), su with the
// account's password, getent, w, lastlog2 (lastlog is gone from Debian 13).
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';

const chapter = (): Chapter => ({
  id: 'accounts-test',
  number: 1,
  commands: ['ls', 'cat', 'sudo', 'usermod', 'who', 'last', 'id', 'su', 'exit', 'whoami'],
  home: '/home/you',
  welcome: 'notes',
  final: 'end',
  password: 'sunflower',
  events: [],
  createWorld: () =>
    d({
      etc: d({ hostname: f('kneader', { lines: true }), hosts: f('127.0.0.1\tlocalhost\n127.0.1.1\tkneader', { lines: true }) }),
      home: d({ you: d({ notes: f('x') }) }),
    }),
});
const shell = (language: 'en' | 'fr' = 'en') => {
  const s = new Shell(chapter(), language, 'kneader');
  s.execute('sudo true');
  s.execute(language === 'fr' ? 'tournesol' : 'sunflower');
  return s;
};

describe('useradd and adduser', () => {
  it("useradd -m -s /bin/bash -G sudo: the account, its group, its home from /etc/skel; Debian's defaults otherwise", () => {
    const s = shell();
    expect(s.execute('useradd alex')).toBe('useradd: Permission denied.\nuseradd: cannot lock /etc/passwd; try again later.');
    expect(s.execute('sudo useradd -m -s /bin/bash -G sudo alex')).toBe('');
    expect(s.execute('getent passwd alex')).toBe('alex:x:1001:1001::/home/alex:/bin/bash');
    expect(s.execute('getent group sudo')).toBe('sudo:x:27:you,alex');
    expect(s.execute('ls -A /home/alex')).toBe('.bash_logout  .bashrc  .profile');
    expect(s.execute('ls -ld /home/alex')).toMatch(/^drwxr-xr-x alex +alex/);
    // No password yet: locked (L).
    expect(s.execute('sudo passwd -S alex')).toMatch(/^alex L \d{4}-\d\d-\d\d 0 99999 7 -1$/);
    // Without -m nor -s: no home, /bin/sh.
    s.execute('sudo useradd sam');
    expect(s.execute('getent passwd sam')).toBe('sam:x:1002:1002::/home/sam:/bin/sh');
    expect(s.exists('/home/sam')).toBe(false);
    expect(s.execute('sudo useradd alex')).toBe("useradd: user 'alex' already exists");
    expect(s.lastStatus).toBe(9);
    expect(s.execute('sudo useradd -G nogroup bo')).toBe("useradd: group 'nogroup' does not exist");
    expect(s.lastStatus).toBe(6);
    expect(s.execute('sudo useradd Bad.Name')).toBe("useradd: invalid user name 'Bad.Name': use --badname to ignore");
    expect(s.lastStatus).toBe(3);
  });

  it("adduser asks the password, then the details, and adds to users; adduser ACCOUNT GROUP", () => {
    const s = shell();
    expect(s.execute('sudo adduser mei')).toBe(
      [
        "info: Adding user `mei' ...",
        'info: Selecting UID/GID from range 1000 to 59999 ...',
        "info: Adding new group `mei' (1001) ...",
        "info: Adding new user `mei' (1001) with group `mei (1001)' ...",
        "info: Creating home directory `/home/mei' ...",
        "info: Copying files from `/etc/skel' ...",
      ].join('\n'),
    );
    expect(s.prompt()).toBe('New password: ');
    s.execute('lantern-42');
    expect(s.prompt()).toBe('Retype new password: ');
    expect(s.execute('lantern-42')).toBe('passwd: password updated successfully\nChanging the user information for mei\nEnter the new value, or press ENTER for the default');
    expect(s.prompt()).toBe('\tFull Name []: ');
    s.execute('Mei Lin');
    for (let i = 0; i < 4; i++) s.execute('');
    expect(s.prompt()).toBe('Is the information correct? [Y/n] ');
    expect(s.execute('')).toBe("info: Adding new user `mei' to supplemental / extra groups `users' ...\ninfo: Adding user `mei' to group `users' ...");
    expect(s.execute('getent passwd mei')).toBe('mei:x:1001:1001:Mei Lin,,,:/home/mei:/bin/bash');
    expect(s.execute('ls -ld /home/mei')).toMatch(/^drwx------ mei/);
    expect(s.execute('id mei')).toBe('uid=1001(mei) gid=1001(mei) groups=1001(mei),100(users)');
    expect(s.execute('sudo adduser mei sudo')).toBe("info: Adding user `mei' to group `sudo' ...");
    expect(s.execute('sudo adduser mei')).toBe("fatal: The user `mei' already exists.");
    // su: mei's own password opens her account.
    s.execute('su mei');
    expect(s.execute('wrong')).toBe('su: Authentication failure');
    s.execute('su - mei');
    expect(s.execute('lantern-42')).toBe('');
    expect(s.execute('whoami')).toBe('mei');
    s.execute('exit');
    expect(s.execute('whoami')).toBe('you');
  });

  it('adduser --disabled-password --comment: no question', () => {
    const s = shell();
    const out = s.execute('sudo adduser --disabled-password --comment "Ana Diaz" ana');
    expect(out).toContain("info: Adding user `ana' to group `users' ...");
    expect(s.question).toBeNull();
    expect(s.execute('getent passwd ana')).toBe('ana:x:1001:1001:Ana Diaz:/home/ana:/bin/bash');
  });
});

describe('passwd and su', () => {
  it("one's own password: the current one first; then sudo takes the new one", () => {
    const s = shell();
    expect(s.execute('passwd')).toBe('Changing password for you.');
    expect(s.prompt()).toBe('Current password: ');
    expect(s.execute('wrong')).toBe('passwd: Authentication token manipulation error\npasswd: password unchanged');
    expect(s.lastStatus).toBe(10);
    s.execute('passwd');
    s.execute('sunflower');
    expect(s.execute('abc')).toBe('You must choose a longer password.\npasswd: Authentication token manipulation error\npasswd: password unchanged');
    s.execute('passwd');
    s.execute('sunflower');
    s.execute('tulip-2029');
    expect(s.execute('tulip-2030')).toBe('Sorry, passwords do not match.\npasswd: Authentication token manipulation error\npasswd: password unchanged');
    s.execute('passwd');
    s.execute('sunflower');
    s.execute('tulip-2029');
    expect(s.execute('tulip-2029')).toBe('passwd: password updated successfully');
    expect(s.execute('passwd -S')).toMatch(/^you P /);
    expect(s.execute('passwd -S root')).toBe('passwd: You may not view or modify password information for root.');
  });

  it('root sets, locks and unlocks; a locked password no longer opens su', () => {
    const s = shell();
    s.execute('sudo useradd -m kofi');
    expect(s.execute('sudo passwd -u kofi')).toContain('passwd: unlocking the password would result in a passwordless account.');
    expect(s.lastStatus).toBe(3);
    s.execute('sudo passwd kofi');
    s.execute('baobab-17');
    expect(s.execute('baobab-17')).toBe('passwd: password updated successfully');
    expect(s.execute('sudo passwd -S kofi')).toMatch(/^kofi P /);
    expect(s.execute('sudo passwd -l kofi')).toBe('passwd: password changed.');
    expect(s.execute('sudo passwd -S kofi')).toMatch(/^kofi L /);
    s.execute('su kofi');
    expect(s.execute('baobab-17')).toBe('su: Authentication failure');
    s.execute('sudo passwd -u kofi');
    s.execute('su -c whoami kofi');
    expect(s.execute('baobab-17')).toBe('kofi');
    // root's password is locked on Debian installed with sudo, until set.
    expect(s.execute('sudo getent shadow root')).toBe('root:*:20759:0:99999:7:::');
    expect(s.execute('getent shadow root')).toBe('');
    expect(s.lastStatus).toBe(2);
  });
});

describe('getent, w, lastlog2', () => {
  it('getent passwd, group, hosts; exit code 2 for a missing key; an unknown database', () => {
    const s = shell();
    expect(s.execute('getent passwd root')).toBe('root:x:0:0::/root:/bin/bash');
    expect(s.execute('getent passwd 1000')).toBe('you:x:1000:1000::/home/you:/bin/bash');
    expect(s.execute('getent passwd nobody-here')).toBe('');
    expect(s.lastStatus).toBe(2);
    expect(s.execute('getent hosts kneader')).toBe('127.0.1.1       kneader');
    expect(s.execute('getent services')).toBe("Unknown database: services\nTry `getent --help' or `getent --usage' for more information.");
  });

  it("w: uptime's line and the session; lastlog2; lastlog points to it", () => {
    const s = shell();
    const w = (s.execute('w') ?? '').split('\n');
    expect(w[0]).toMatch(/^ \d\d:\d\d:\d\d up 3 days, +\d+:\d\d, +1 user, +load average: /);
    expect(w[1]).toBe('USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU  WHAT');
    expect(w[2]).toMatch(/^you +pts\/0 +192\.0\.2\.2 +23:58 +0\.00s +0\.03s +0\.00s w$/);
    expect(s.execute('w -h')).toMatch(/^you /);
    const ll = s.execute('lastlog2');
    expect(ll).toMatch(/^root +\*\*Never logged in\*\*$/m);
    expect(ll).toMatch(/^you +pts\/0 +192\.0\.2\.2 +Thu Dec 31 23:58:00 \+0100 2026$/m);
    expect(s.execute('lastlog')).toBe('lastlog: command not found. (Debian 13 no longer has lastlog: try lastlog2.)');
    expect(s.lastStatus).toBe(127);
  });

  it('in French: the prompts and messages of PAM and adduser', () => {
    const s = shell('fr');
    expect(s.execute('passwd')).toBe('Changement du mot de passe pour you.');
    expect(s.prompt()).toBe('Mot de passe actuel : ');
    expect(s.execute('faux')).toBe("passwd : Erreur de manipulation du jeton d'authentification\npasswd : mot de passe inchangé");
    expect(s.execute('man adduser')).toContain('la façon Debian de créer un compte');
    expect(s.execute('sudo adduser mei')).toContain('info: Ajout de l\'utilisateur « mei » ...');
    expect(s.prompt()).toBe('Nouveau mot de passe : ');
  });
});
