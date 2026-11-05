// The Photo Club: NFS and Samba. Each chapter is replayed to the end from
// the workstation (ssh nas, then ssh darkroom), with another solution and
// false leads, in each language; the expected texts are checked in French.
// Also: the exports and smb.conf models.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { effective, lookup, readExports, reload } from '../src/engine/nfs';
import { allowed, modeFor, readConfig } from '../src/engine/samba';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const PASSWORD = 'shutter-2028';
const EXPORT = '/srv/photos 192.0.2.32(rw,sync,no_subtree_check)';
const FSTAB_LINE = 'nas.internal:/srv/photos /mnt/photos nfs defaults,_netdev 0 0';
const SHARE = '[photos]\n   comment = Club photos\n   path = /srv/photos\n   read only = no\n   valid users = @club\n   create mask = 0664\n   directory mask = 2775\n   force group = club';

describe('NFS exports and Samba shares', () => {
  it('reads exports like exportfs: options, defaults, a space before the parentheses', () => {
    const s = new Shell(chapter('nfs-export'), 'en');
    s.execute('sudo nano /etc/exports');
    if (s.waiting) s.execute(PASSWORD);
    s.saveEdition(`${s.edition!.text}\n/srv/photos 192.0.2.32 (rw)\n/srv/missing 192.0.2.0/24(ro,no_subtree_check)`);
    s.quitEdition();
    const { exports, messages } = readExports(s);
    expect(messages.join('\n')).toContain("Neither 'subtree_check' or 'no_subtree_check' specified for export \"192.0.2.32:/srv/photos\"");
    expect(messages).toContain('exportfs: Failed to stat /srv/missing: No such file or directory');
    expect(exports[0].clients.map((c) => c.spec)).toEqual(['192.0.2.32', '*']);
    reload(s);
    // The darkroom computer gets ro (its own entry, the first that matches), anyone else gets rw.
    expect(lookup(s, '/srv/photos', '192.0.2.32', [])!.options).toContain('ro');
    expect(lookup(s, '/srv/photos', '198.51.100.9', [])!.options).toContain('rw');
    expect(effective(['rw', 'no_root_squash'])).toEqual(['sync', 'wdelay', 'hide', 'no_subtree_check', 'sec=sys', 'rw', 'secure', 'no_root_squash', 'no_all_squash']);
  });

  it('reads smb.conf like Samba: synonyms, valid users, masks', () => {
    const s = new Shell(chapter('samba-share'), 'en');
    s.execute('sudo nano /etc/samba/smb.conf');
    if (s.waiting) s.execute(PASSWORD);
    s.saveEdition(`${s.edition!.text}\n\n[photos]\n  Path = /srv/photos\n  writeable = yes\n  validusers = @club, tom\n  create mask = 0660`);
    s.quitEdition();
    const share = readConfig(s).shares.find((x) => x.name === 'photos')!;
    expect(share.params.path).toBe('/srv/photos');
    expect(allowed(s, share, 'nora')).toBe(true);
    expect(allowed(s, share, 'tom')).toBe(true);
    expect(allowed(s, share, 'margot')).toBe(true);
    expect(modeFor(share, false)).toBe('rw-rw----');
    expect(modeFor(share, true)).toBe('rwxr-xr-x');
  });
});

for (const language of LANGUAGES)
  describe(`The Photo Club — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => inLanguage(t, machinesInLanguage(t, line));
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    function play(finished: string[]) {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('photo-club'), ...finished] });
      const one = (l: string) => {
        const o = c.execute(L(l));
        let out = typeof o === 'string' ? o : '';
        if (c.shell.waiting) {
          const p = c.execute(machinesInLanguage(t, PASSWORD));
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        return out;
      };
      const run = (...lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        const before = one(command);
        c.shell.saveEdition(change(c.shell.edition!.text));
        return `${before}\n${c.shell.quitEdition() ?? ''}`;
      };
      // Answers a question (a Samba password) with a translated value.
      const answer = (value: string) => {
        const o = c.execute(machinesInLanguage(t, value));
        return typeof o === 'string' ? o : '';
      };
      run('ssh nas', 'yes');
      return { c, run, edit, answer, nas: () => c.remote!.shell, finished: () => c.remote!.shell.finished };
    }

    it('chapter 1 — solution: the export, the firewall, mount, fstab', () => {
      const { run, edit, finished } = play([]);
      let all = run('cat message_from_margot.txt', 'cat /etc/exports');
      contains(all, 'sans espace avant');
      all = edit('sudo nano /etc/exports', (x) => `${x}\n${EXPORT}`) + run('ls');
      contains(all, 'sert toujours son ancienne');
      all = run('sudo exportfs -ra', 'sudo exportfs -v');
      expect(all).toContain('/srv/photos   \t192.0.2.32(sync,wdelay,hide,no_subtree_check,sec=sys,rw,secure,root_squash,no_all_squash)');
      contains(all, 'Côté client');
      all = run('ssh darkroom', 'yes', 'sudo mount -t nfs nas.internal:/srv/photos /mnt/photos');
      expect(all).toContain('mount.nfs: mount point /mnt/photos does not exist');
      contains(all, 'répertoire existant');
      all = run('sudo mkdir /mnt/photos', 'sudo mount -t nfs nas.internal:/srv/photos /mnt/photos');
      expect(all).toContain('mount.nfs: Connection timed out');
      contains(all, 'port 2049');
      run('exit', 'sudo ufw allow from 192.0.2.32 to any port 2049 proto tcp', 'ssh darkroom');
      all = run('sudo mount -t nfs nas.internal:/srv/photos /mnt/photos', 'df -h', 'mount', 'ls -l /mnt/photos');
      expect(all).toMatch(/nas\.internal:\/srv\/photos +2000G .* \/mnt\/photos/);
      expect(all).toContain('nas.internal:/srv/photos on /mnt/photos type nfs4 (rw,relatime,vers=4.2,');
      expect(all).toMatch(/drwxrwsr-x 1002 +club .* 2028-outings\//);
      contains(all, 'prochain redémarrage');
      expect(finished()).toBe(false);
      edit('sudo nano /etc/fstab', (x) => `${x}\n${FSTAB_LINE}`);
      all = run('sudo umount /mnt/photos', 'sudo mount -a', 'ls /mnt/photos');
      expect(all).toContain('2028-outings/');
      contains(all, 'NFS EN BREF');
      expect(finished()).toBe(true);
    });

    it('chapter 1 — another way: the club network, a restart, fstab first, ufw allow 2049', () => {
      const { run, edit, finished } = play([]);
      edit('sudo nano /etc/exports', (x) => `${x}\n/srv/photos 192.0.2.32/32(rw,sync,no_subtree_check)`);
      run('sudo systemctl restart nfs-server', 'sudo ufw allow 2049/tcp', 'ssh darkroom', 'yes', 'sudo mkdir /mnt/photos');
      edit('sudo nano /etc/fstab', (x) => `${x}\n${FSTAB_LINE}`);
      expect(finished()).toBe(false);
      run('sudo mount /mnt/photos');
      expect(finished()).toBe(true);
    });

    it('chapter 1 — false leads: everyone, a space before the options, read-only', () => {
      const { run, edit, finished } = play([]);
      let all = edit('sudo nano /etc/exports', (x) => `${x}\n/srv/photos *(rw,sync,no_subtree_check)`) + run('sudo exportfs -ra');
      contains(all, 'pour tout le monde');
      edit('sudo nano /etc/exports', (x) => x.replace('/srv/photos *(rw,sync,no_subtree_check)', '/srv/photos 192.0.2.32 (rw,sync,no_subtree_check)'));
      all = run('sudo exportfs -ra', 'sudo exportfs -v');
      expect(all).toContain('/srv/photos   \t*(sync,wdelay,hide,no_subtree_check,sec=sys,rw,secure,root_squash,no_all_squash)');
      edit('sudo nano /etc/exports', (x) => x.replace('/srv/photos 192.0.2.32 (rw,sync,no_subtree_check)', '/srv/photos 192.0.2.32(sync,no_subtree_check)'));
      run('sudo exportfs -ra', 'sudo ufw allow from 192.0.2.32 to any port 2049', 'ssh darkroom', 'yes', 'sudo mkdir /mnt/photos');
      edit('sudo nano /etc/fstab', (x) => `${x}\n${FSTAB_LINE}`);
      all = run('sudo mount -a', 'sudo touch /mnt/photos/test');
      contains(all, 'lecture seule');
      expect(finished()).toBe(false);
      run('exit');
      edit('sudo nano /etc/exports', (x) => x.replace('192.0.2.32(sync,', '192.0.2.32(rw,sync,'));
      run('sudo exportfs -ra');
      expect(finished()).toBe(true);
    });

    it('chapter 2 — solution: the numbers, root_squash, usermod -u, chown', () => {
      const { run, finished } = play(['nfs-export']);
      let all = run('cat message_from_margot.txt', 'ls -l /srv/photos/2028-film-scans', 'id sam');
      expect(all).toMatch(/-rw-r--r-- nora +nora +48000000 roll-01\.tif/);
      expect(all).toContain('uid=1002(sam)');
      contains(all, 'le client\n    envoie des numéros'.replace('\n    ', ' '));
      all = run('ssh darkroom', 'yes', 'id sam', 'ls -n /mnt/photos/2028-outings', 'sudo cp /home/sam/scans/roll-04.tif /mnt/photos/2028-film-scans/');
      expect(all).toContain('uid=1001(sam)');
      expect(all).toMatch(/-rw-r--r-- 1002 +1500 +3570000 heron\.jpg/);
      if (!fr) expect(all).toMatch(/cp: cannot create .*roll-04\.tif.*Permission denied/);
      contains(all, 'devient nobody');
      all = run('sudo chown sam /mnt/photos/2028-outings/heron.jpg', 'sudo usermod -u 1002 sam');
      expect(all).toContain(t('chown-not-allowed', { target: '/mnt/photos/2028-outings/heron.jpg' }));
      contains(all, 'pkill -u sam');
      all = run('ps -u sam', 'sudo pkill -u sam', 'sudo usermod -u 1002 sam', 'ls -l /mnt/photos/2028-outings');
      expect(all).toMatch(/-rw-r--r-- sam +club +3570000 heron\.jpg/);
      contains(all, 'propriétaire:groupe');
      expect(finished()).toBe(false);
      all = run('exit', 'sudo chown -R sam:club /srv/photos/2028-film-scans');
      contains(all, 'LES MÊMES NUMÉROS PARTOUT');
      expect(finished()).toBe(true);
    });

    it('chapter 2 — false leads: usermod on the NAS, no_root_squash', () => {
      const { run, edit, finished } = play(['nfs-export']);
      let all = run('sudo usermod -u 1001 sam');
      expect(all).toContain(t('usermod-uid-exists', { uid: '1001' }));
      contains(all, 'collision');
      all = edit('sudo nano /etc/exports', (x) => x.replace('192.0.2.32(rw,sync,no_subtree_check)', '192.0.2.32(rw,sync,no_subtree_check,no_root_squash)')) + run('sudo exportfs -ra');
      contains(all, 'tous les droits');
      run('sudo chown -R sam:club /srv/photos/2028-film-scans', 'ssh darkroom', 'yes', 'sudo pkill -u sam', 'sudo usermod -u 1002 sam', 'exit');
      expect(finished()).toBe(false);
      edit('sudo nano /etc/exports', (x) => x.replace(',no_root_squash', ''));
      run('sudo exportfs -ra');
      expect(finished()).toBe(true);
    });

    it('chapter 3 — solution: the share, Samba passwords, masks, the firewall', () => {
      const { run, edit, answer, finished } = play(['nfs-export', 'nfs-owners']);
      let all = run('cat message_from_margot.txt', 'smbclient -L localhost -N');
      expect(all).toContain('\tprint$          Disk      Printer Drivers');
      all = edit('sudo nano /etc/samba/smb.conf', (x) => `${x}\n\n${SHARE.replace('valid users', 'valid user')}`) + run('sudo testparm -s');
      expect(all).toContain('Ignoring unknown parameter "valid user"');
      contains(all, 'orthographe');
      edit('sudo nano /etc/samba/smb.conf', (x) => x.replace('valid user =', 'valid users ='));
      all = run('smbclient //localhost/photos -U sam -c "ls"') + answer('negative-2028');
      expect(all).toContain('session setup failed: NT_STATUS_LOGON_FAILURE');
      contains(all, 'smbpasswd -a sam');
      all = run('sudo smbpasswd -a sam') + answer('negative-2028') + answer('negative-2028');
      expect(all).toContain('Added user sam.');
      run('sudo smbpasswd -a nora');
      answer('slide-2028');
      all = answer('slide-2028') + run('sudo pdbedit -L');
      expect(all).toContain('nora:1001:');
      contains(all, 'pare-feu du NAS');
      all = run(`smbclient //localhost/photos -U sam%${machinesInLanguage(t, 'negative-2028')} -c "put /tmp/contact-sheet.jpg sheet.jpg; ls"`, 'ls -l /srv/photos/sheet.jpg');
      expect(all).toContain('putting file /tmp/contact-sheet.jpg as \\sheet.jpg');
      expect(all).toMatch(/-rw-rw-r-- sam +club +820000 \/srv\/photos\/sheet\.jpg/);
      expect(finished()).toBe(false);
      all = run('sudo ufw allow from 192.0.2.0/24 to any app Samba', 'sudo ufw status');
      expect(all).toMatch(/Samba +ALLOW +192\.0\.2\.0\/24/);
      contains(all, 'UN PARTAGE SAMBA');
      expect(finished()).toBe(true);
    });

    it('chapter 3 — false leads: guests, everyone, the default masks; another way: the setgid and force create mode', () => {
      const { run, edit, answer, finished } = play(['nfs-export', 'nfs-owners']);
      run('sudo ufw allow 445/tcp');
      let all = edit('sudo nano /etc/samba/smb.conf', (x) => `${x}\n\n[photos]\n   path = /srv/photos\n   guest ok = yes`) + run('ls');
      contains(all, "n'importe qui");
      all = run('smbclient //localhost/photos -N -c "put /tmp/contact-sheet.jpg x.jpg"');
      expect(all).toContain('NT_STATUS_ACCESS_DENIED opening remote file \\x.jpg');
      contains(all, 'lecture seule');
      edit('sudo nano /etc/samba/smb.conf', (x) => x.replace('guest ok = yes', 'writable = yes'));
      all = '';
      for (const [u, p] of [['sam', 'negative-2028'], ['nora', 'slide-2028']]) all += run(`sudo smbpasswd -a ${u}`) + answer(p) + answer(p);
      contains(all, 'Tom compris');
      edit('sudo nano /etc/samba/smb.conf', (x) => x.replace('writable = yes', 'writable = yes\n   valid users = sam nora margot'));
      all = run(`smbclient //localhost/photos -U nora%${machinesInLanguage(t, 'slide-2028')} -c "put /tmp/contact-sheet.jpg n.jpg"`, 'ls -l /srv/photos/n.jpg');
      expect(all).toMatch(/-rw-r--r-- nora +club/);
      contains(all, 'create mask = 0744');
      expect(finished()).toBe(false);
      edit('sudo nano /etc/samba/smb.conf', (x) => x.replace('valid users = sam nora margot', 'valid users = sam nora margot\n   force create mode = 0664\n   create mask = 0775\n   force directory mode = 0775'));
      run('ls');
      expect(finished()).toBe(true);
    });

    it('the NAS is reached from the workstation', () => {
      const { c } = play([]);
      expect(c.remote?.shell.chapter.id).toBe('nfs-export');
    });
  });
