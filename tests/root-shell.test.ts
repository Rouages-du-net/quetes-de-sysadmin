// Becoming root, like on Debian: sudo -i (a login shell in /root), sudo -s
// and sudo su (a shell here), sudo su -, su (root has no password on a
// Debian installed with sudo: "Authentication failure"), the # prompt,
// root's HOME and PATH, the environment reset, exit and Ctrl-D back to your
// own shell, sudo's policy, sudo !!, and a chapter solved from a root shell.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { d, f, type Chapter } from '../src/engine/world';
import { withoutColours } from '../src/engine/colours';

const chapter = (sudoers?: string): Chapter => ({
  id: 'root-shell-test',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'echo', 'cat', 'whoami', 'id', 'touch', 'sudo', 'history', 'exit'],
  home: '/home/you',
  welcome: 'notes.txt',
  final: 'end',
  password: 'sunflower',
  events: [{ id: 'end', condition: (j) => j.who === 'root' && j.exists('/etc/flag'), message: 'EVENT end' }],
  createWorld: () =>
    d({
      tmp: d({}),
      etc: d({ shadow: f('secret', { owner: 'root', mode: 'rw-------' }), ...(sudoers ? { sudoers: f(sudoers, { owner: 'root', mode: 'r--r-----' }) } : {}) }, undefined, { owner: 'root' }),
      home: d({ you: d({ 'notes.txt': f('alpha') }) }),
    }),
});

const shell = (language: 'en' | 'fr' = 'en', sudoers?: string) => new Shell(chapter(sudoers), language);

describe('A root shell', () => {
  it('sudo -i: the password, a login shell in /root with #, root everywhere, then logout', () => {
    const s = shell();
    s.execute('X=1; cd /tmp');
    s.execute('sudo -i');
    expect(s.prompt()).toContain('password');
    expect(s.execute('sunflower')).toBe('');
    expect(s.prompt()).toBe('root@sysadmin:~#');
    expect(s.execute('pwd; whoami; echo $HOME $USER $UID "[$X]"')).toBe('/root\nroot\n/root root 0 []');
    expect(s.execute('echo $PATH')).toBe('/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin');
    expect(s.execute('cat /etc/shadow')).toBe('secret');
    // root needs no password for sudo, nor sudo for cd.
    expect(s.execute('sudo whoami')).toBe('root');
    s.execute('cd /etc; cd');
    expect(s.cwd).toBe('/root');
    expect(s.find('/root')).toMatchObject({ owner: 'root', mode: 'rwx------' });
    expect(s.execute('exit')).toBe('logout');
    expect(s.prompt()).toBe('you@sysadmin:/tmp$');
    expect(s.execute('whoami; echo $X')).toBe('you\n1');
    expect(s.output).toBe(false);
  });

  it('sudo -s and sudo su keep the place; exit says exit; Ctrl-D leaves too', () => {
    const s = shell();
    s.execute('cd /tmp');
    s.execute('sudo -s');
    s.execute('sunflower');
    expect(s.prompt()).toBe('root@sysadmin:/tmp#');
    expect(s.execute('echo $HOME')).toBe('/root');
    expect(s.execute('exit')).toBe('exit');
    s.execute('sudo su');
    expect(s.prompt()).toBe('root@sysadmin:/tmp#');
    expect(s.execute('\u0004')).toBe('exit');
    s.execute('sudo su -');
    expect(s.prompt()).toBe('root@sysadmin:~#');
    // From root, su - to an account asks nothing.
    s.execute('su - you');
    expect(s.prompt()).toBe('you@sysadmin:~$');
    expect(s.execute('exit')).toBe('logout');
    expect(s.execute('exit')).toBe('logout');
    expect(s.prompt()).toBe('you@sysadmin:/tmp$');
  });

  it("su asks root's password, which Debian locks: Authentication failure (in the language)", () => {
    const s = shell('fr');
    s.execute('su -');
    expect(s.prompt()).toBe('Mot de passe :');
    expect(s.maskedInput()).toBe(true);
    expect(s.execute('sunflower')).toBe('su: Authentication failure');
    expect(s.execute('echo $?')).toBe('1');
    expect(s.execute('whoami')).toBe('you');
  });

  it("sudo's policy decides; sudo !! runs the last command again with sudo", () => {
    const s = shell('en', 'you ALL=(root) /usr/bin/systemctl\n');
    s.execute('sudo -i');
    expect(s.execute('sunflower')).toBe("Sorry, user you is not allowed to execute '/bin/bash' as root on sysadmin.");
    expect(s.prompt()).toBe('you@sysadmin:~$');
    const t = shell();
    expect(t.execute('cat /etc/shadow')).toContain('Permission denied');
    expect(t.execute('sudo !!')).toContain('sudo cat /etc/shadow');
    expect(t.execute('sunflower')).toBe('secret');
    expect(t.history.at(-1)).toBe('sudo cat /etc/shadow');
  });

  it('events see what is typed in a root shell as root', () => {
    const s = shell();
    s.execute('sudo -i');
    expect(s.execute('sunflower')).toBe('');
    expect(s.execute('touch /etc/flag')).toContain('EVENT end');
    expect(s.find('/etc/flag')?.owner).toBe('root');
  });
});

describe('A chapter solved from a root shell', () => {
  it('The concert night: sudo -i, then the same commands without sudo', () => {
    const c = STORIES.flatMap((h) => h.chapters).find((x) => x.id === 'concert')!;
    const s = new Shell(c, 'en');
    const run = (line: string) => withoutColours(s.execute(line) ?? '');
    run('sudo -i');
    run('ants-2026');
    expect(s.prompt()).toMatch(/^root@.*~#$/);
    expect(run("awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c")).toMatch(/\d+ 504/);
    const site = '/etc/nginx/sites-available/letters';
    const edit = (change: (t: string) => string) => {
      run(`nano ${site}`);
      s.saveEdition(change(s.edition!.text));
      s.quitEdition();
    };
    edit((t) => 'limit_req_zone $binary_remote_addr zone=agenda:10m rate=2r/s;\n\n' + t.replace('proxy_pass http://127.0.0.1:3000/;', 'limit_req zone=agenda burst=10 nodelay;\n        limit_req_status 429;\n        proxy_pass http://127.0.0.1:3000/;'));
    run('nginx -t && systemctl reload nginx');
    expect(s.finished).toBe(true);
  });
});
