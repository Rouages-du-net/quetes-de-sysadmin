// The Community Centre: the keys, the jump, the tunnel, the transfers.
// Replayed with the console (everything starts from the workstation), in each language.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';

const ERASER = STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id);
const CONFIG = '/etc/ssh/sshd_config';

for (const language of LANGUAGES)
  describe(`The Community Centre — ${language}`, () => {
    const fr = language === 'fr';
    // A line written with the English names, in the game's language.
    const L = (line: string) => inLanguage(translator(language), line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...ERASER, ...finished] });
      const play = (lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');
      const modify = (file: string, change: (text: string) => string, mdp = 'lilac-2027') => {
        c.execute(`sudo nano ${file}`);
        if (c.shell.waiting) c.execute(machinesInLanguage(c.t, mdp));
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      return { c, jouer: play, modifier: modify };
    };

    it('chapter 1 — solution: ssh-keygen, ssh-copy-id, then no more passwords', () => {
      const { c, jouer: play, modifier: modify } = part();
      let all = play(['ssh community', 'yes']);
      expect(c.prompt()).toBe(L("you@community.internal's password:"));
      all += play(['lilac-2027']);
      contains(all, 'Bienvenue dans l');
      expect(c.prompt()).toBe(L('you@community:~$'));
      all += play(['exit', 'ssh-keygen', '', '', '', 'ssh-copy-id community', 'lilac-2027']);
      expect(all).toContain(L('Your public key has been saved in /home/you/.ssh/id_ed25519.pub'));
      expect(all).toContain('Number of key(s) added: 1');
      all += play(['ssh community']);
      expect(c.prompt()).toBe(L('you@community:~$'));
      contains(all, 'Entré·e par ta clé, sans mot de passe');
      all += modify(CONFIG, (t) => t.replace('#PasswordAuthentication yes', 'PasswordAuthentication no'));
      all += play(['sudo sshd -t', 'sudo systemctl reload ssh']);
      contains(all, "sshd n'accepte plus que les clés");
      expect(c.finished).not.toContain('keys');
      all += play(['exit', 'ssh community']);
      contains(all, 'https://man.openbsd.org/ssh-keygen');
      expect(c.finished).toContain('keys');
    });

    it('chapter 1 — other solution: the public key copied by hand, with a passphrase', () => {
      const { c, jouer: play, modifier: modify } = part();
      play([L('ssh-keygen -t ed25519 -C you@desk'), '', 'une longue phrase', 'une longue phrase']);
      const isPublic = c.workstation.read('~/.ssh/id_ed25519.pub')!;
      play(['ssh community', 'yes', 'lilac-2027', 'mkdir .ssh']);
      c.execute('nano .ssh/authorized_keys');
      c.save(isPublic + '\n');
      c.quitEdition();
      play(['chmod 600 .ssh/authorized_keys', 'exit', 'ssh community']);
      expect(c.prompt()).toBe(L("Enter passphrase for key '/home/you/.ssh/id_ed25519':"));
      play(['une longue phrase']);
      expect(c.prompt()).toBe(L('you@community:~$'));
      modify('/etc/ssh/sshd_config.d/00-cles.conf', () => 'PasswordAuthentication no\n');
      play(['sudo systemctl restart ssh', 'exit', 'ssh community', 'une longue phrase']);
      expect(c.finished).toContain('keys');
    });

    it('chapter 1 — false leads: ssh-copy-id without a key, shutting the door before installing the key', () => {
      const { c, jouer: play, modifier: modify } = part();
      // Without a key of your own, ssh-copy-id takes the most recent one in ~/.ssh: the kingdom's.
      let all = play(['ssh-copy-id community', 'yes', 'lilac-2027', 'ssh community']);
      expect(all).toContain(L('Source of key(s) to be installed: "/home/you/.ssh/id_kingdom.pub"'));
      expect(c.prompt()).toBe(L("you@community.internal's password:"));
      all = play(['lilac-2027']);
      contains(all, "jeu t'a donnée pour une autre machine");
      all = modify(CONFIG, (t) => t.replace('#PasswordAuthentication yes', 'PasswordAuthentication no'));
      all += play(['sudo systemctl reload ssh']);
      contains(all, 'aucune clé n');
      all = play(['exit', 'ssh community']);
      expect(all).toContain(L('you@community.internal: Permission denied (publickey).'));
      expect(c.prompt()).toBe(L('you@desk:~$'));
      // The menu: the hosting provider's rescue console.
      c.connect('community');
      modify(CONFIG, (t) => t.replace('PasswordAuthentication no', 'PasswordAuthentication yes'));
      play(['sudo systemctl reload ssh', 'exit', 'ssh-keygen -N "" -f ~/.ssh/id_ed25519', 'ssh-copy-id community', 'lilac-2027']);
      expect(c.finished).not.toContain('keys');
    });

    // The workstation already has its key (chapter 1), without a passphrase.
    const withKey = (finished: string[]) => {
      const p = part(finished);
      p.jouer(['ssh-keygen -N "" -f ~/.ssh/id_ed25519']);
      return p;
    };
    const CONFIG_WIKI = L('\nHost wiki\n    HostName wiki\n    User you\n    ProxyJump community\n');
    const writeWorkstation = (c: Console, file: string, add: string) => {
      c.execute(`nano ${file}`);
      c.save(c.edition!.text + add);
      return c.quitEdition();
    };

    it('chapter 2 — solution: ssh -J, then ProxyJump in ~/.ssh/config', () => {
      const { c, jouer: play } = withKey(['keys']);
      let all = play(['ssh -J community wiki', 'yes', 'yes']);
      contains(all, 'Le wiki');
      expect(c.prompt()).toBe(L('you@wiki:~$'));
      contains(all, 'Te voilà sur le wiki');
      all += play(['hostname', 'cat note_gaspard.txt', 'exit']);
      expect(c.prompt()).toBe(L('you@desk:~$'));
      // The chapter watches the workstation: the written shortcut is enough (already been to the wiki).
      all = writeWorkstation(c, '~/.ssh/config', CONFIG_WIKI);
      contains(all, 'https://man.openbsd.org/ssh_config#ProxyJump');
      expect(c.finished).toContain('jump');
      all = play(['ssh -G wiki']);
      expect(all).toContain(machinesInLanguage(translator(language), 'proxyjump community'));
      all = play(['ssh wiki']);
      expect(c.prompt()).toBe(L('you@wiki:~$'));
      // A jump does not show the gateway's banner.
      expect(all).not.toContain('Linux community');
      all = play(['exit']);
      expect(c.prompt()).toBe(L('you@desk:~$'));
    });

    it('chapter 2 — false leads: ssh wiki from the workstation, from community, the private key copied over', () => {
      const { c, jouer: play } = withKey(['keys']);
      let all = play(['ssh wiki']);
      expect(all).toContain('ssh: Could not resolve hostname wiki: Name or service not known');
      all = play(['ssh community', 'yes', 'ssh wiki', 'yes']);
      expect(all).toContain(L('you@wiki: Permission denied (publickey).'));
      expect(c.prompt()).toBe(L('you@community:~$'));
      all = play(['exit', 'scp ~/.ssh/id_ed25519 community:.ssh/']);
      contains(all, 'il y a une clé privée dans ~/.ssh sur maison');
      play(['ssh community']);
      // With the private key copied over, the second ssh works… but the chapter does not end.
      play(['chmod 600 .ssh/id_ed25519', 'ssh wiki']);
      expect(c.prompt()).toBe(L('you@wiki:~$'));
      play(['exit', 'exit']);
      writeWorkstation(c, '~/.ssh/config', CONFIG_WIKI);
      play(['ssh wiki', 'yes']);
      expect(c.prompt()).toBe(L('you@wiki:~$'));
      expect(c.finished).not.toContain('jump');
      play(['exit', 'ssh community', 'rm .ssh/id_ed25519', 'exit', 'ssh wiki']);
      expect(c.finished).toContain('jump');
    });

    // Key and shortcut already in place (chapters 1 and 2), hosts already known.
    const team = (finished: string[]) => {
      const p = withKey(finished);
      writeWorkstation(p.c, '~/.ssh/config', CONFIG_WIKI);
      p.jouer(['ssh wiki', 'yes', 'yes', 'exit']);
      return p;
    };
    const pidTunnel = (c: Console) => /(\d+)\s+\S+\s+\S+\s+ssh /.exec(c.execute('ps') ?? '')![1];

    it('chapter 3 — solution: ssh -f -N -L, curl, then kill', () => {
      const { c, jouer: play } = team(['keys', 'jump']);
      let all = play(['ssh wiki', 'curl localhost:8080', 'ss -tln', 'exit']);
      expect(all).toContain('-bash: curl: command not found');
      expect(all).toContain('127.0.0.1:8080');
      all = play(['ssh -f -N -L 8080:localhost:8080 wiki', 'curl localhost:8080/admin']);
      contains(all, 'promo-casino : en attente');
      all = play(['curl localhost:8080/admin/valider/samir', 'curl http://127.0.0.1:8080/admin/valider/lea']);
      contains(all, 'Inscription de lea validée.');
      contains(all, 'Reste à refermer le tunnel');
      expect(c.finished).not.toContain('tunnel');
      all = play([`kill ${pidTunnel(c)}`]);
      contains(all, 'https://man.openbsd.org/ssh#L');
      expect(c.finished).toContain('tunnel');
      all = play(['curl localhost:8080/admin']);
      expect(all).toContain('curl: (7) Failed to connect to localhost port 8080');
    });

    it('chapter 3 — other solution: -J without a shortcut, and the advert refused afterwards', () => {
      const { c, jouer: play } = withKey(['keys', 'jump']);
      play(['ssh -f -N -J community -L 8080:localhost:8080 wiki', 'yes', 'yes']);
      let all = play(['curl localhost:8080/admin/valider/promo-casino']);
      contains(all, 'Oups');
      play(['curl localhost:8080/admin/valider/samir', 'curl localhost:8080/admin/valider/lea', `kill ${pidTunnel(c)}`]);
      expect(c.finished).not.toContain('tunnel');
      play(['ssh -fN -L 8080:localhost:8080 -J community wiki', 'curl localhost:8080/admin/refuser/promo-casino']);
      play([`kill ${pidTunnel(c)}`]);
      expect(c.finished).toContain('tunnel');
    });

    it('chapter 3 — false leads: localhost as seen from community, the wiki by its address', () => {
      const { c, jouer: play } = team(['keys', 'jump']);
      let all = play(['ssh -f -N -L 8080:localhost:8080 community', 'curl localhost:8080/admin']);
      expect(all).toContain('channel 2: open failed: connect failed: Connection refused');
      expect(all).toContain('curl: (52) Empty reply from server');
      play([`kill ${pidTunnel(c)}`, 'ssh -f -N -L 8080:wiki:8080 community']);
      all = play(['curl localhost:8080/admin']);
      expect(all).toContain('curl: (52) Empty reply from server');
      // Without -f, ssh reminds you that it keeps the terminal.
      play([`kill ${pidTunnel(c)}`]);
      all = play(['ssh -N -L 8080:localhost:8080 wiki']);
      contains(all, '-f');
      expect(c.finished).not.toContain('tunnel');
    });

    const REPORT = L('scp wiki:/srv/wiki/exports/report-2027.pdf .');
    const SAVE = L('rsync -av /srv/share/ archives:/srv/backups/share/');

    it('chapter 4 — solution: scp to the workstation, rsync from community to archives', () => {
      const { c, jouer: play } = team(['keys', 'jump', 'tunnel']);
      let all = play([REPORT, 'ls']);
      expect(all).toContain(L('report-2027.pdf'));
      contains(all, 'Le rapport d');
      play(['ssh community']);
      all = play([SAVE.replace('-av', '-avn'), 'yes']);
      expect(all).toContain('(DRY RUN)');
      all = play([SAVE]);
      expect(all).toContain(L('minutes/board-2027-09.txt'));
      expect(all).not.toContain(L('minutes/agm-2026.txt'));
      contains(all, 'https://download.samba.org/pub/rsync/rsync.1');
      expect(c.finished).toContain('transfers');
    });

    it('chapter 4 — false lead: the forgotten trailing slash, repaired with --delete', () => {
      const { c, jouer: play } = team(['keys', 'jump', 'tunnel']);
      let all = play(['ssh community', L('rsync -av /srv/share archives:/srv/backups/share'), 'yes']);
      expect(all).toContain(L('share/room-bookings.txt'));
      contains(all, 'barre oblique finale');
      all = play([SAVE, 'exit', REPORT]);
      expect(c.finished).not.toContain('transfers');
      all = play(['ssh community', SAVE.replace('-av', '-av --delete')]);
      expect(all).toContain(L('deleting share/minutes/'));
      expect(c.finished).toContain('transfers');
    });

    const LFTP = 'lftp -u maisonasso ftp.hosting.example';
    const MDP_FTP = 'Kp7-hebergement-2028';

    it('chapter 5 — solution: sftp from the wiki, then lftp over FTPS, mirror -R --delete', () => {
      const { c, jouer: play } = team(['keys', 'jump', 'tunnel', 'transfers']);
      let all = play(['ssh community', L('cat email_hosting.txt'), 'exit']);
      if (fr) expect(all).toContain('Serveur : ftp.hosting.example');
      all = play(['sftp wiki', 'pwd', 'cd /srv/wiki', 'ls', 'get -r site', 'lls', 'bye', 'ls site']);
      expect(all).toContain('Connected to wiki.');
      expect(all).toContain(L('Remote working directory: /home/you'));
      expect(all).toContain('Fetching /srv/wiki/site/ to site');
      expect(all).toContain('adhesion.html');
      all = play([
        LFTP,
        MDP_FTP,
        'ls',
        'mirror -R --delete --dry-run site public_html',
        'mirror -R --delete site public_html',
        'ls public_html',
        'bye',
      ]);
      expect(all).toContain('tarifs-2025.html');
      expect(all).toContain('rm /public_html/tarifs-2025.html');
      expect(all).toContain('Removed: 1 file, 0 directories, 0 symlinks');
      contains(all, 'https://lftp.yar.ru/lftp-man.html');
      expect(c.finished).toContain('web-host');
    });

    it('chapter 5 — false leads: in clear text, Gaspard\'s name, without verification, backwards, without a target, without --delete', () => {
      const { c, jouer: play } = team(['keys', 'jump', 'tunnel', 'transfers']);
      play(['ssh community', 'exit']);
      let all = play(['lftp -u maisonasso -e "set ftp:ssl-allow no; ls" ftp.community.example', MDP_FTP]);
      expect(all).toContain('ls: Login failed: 421 Sorry, cleartext sessions and weak ciphers are not accepted on this server.');
      contains(all, 'plus de FTP en clair');
      all = play(['set ftp:ssl-allow yes', 'ls']);
      expect(all).toContain(
        "ls: Fatal error: Certificate verification: certificate common name doesn't match requested host name ‘ftp.community.example’",
      );
      contains(all, 'le nom que son\ncertificat porte'.replace('\n', ' '));
      all = play(['set ssl:verify-certificate no', 'ls public_html', 'mirror public_html site']);
      expect(all).toContain('tarifs-2025.html');
      contains(all, 'la vérification du certificat est coupée');
      contains(all, 'mirror sans -R');
      all = play(['bye', 'rm site/tarifs-2025.html', 'sftp wiki', 'get -r /srv/wiki/site', 'bye', LFTP, MDP_FTP, 'mirror -R site']);
      contains(all, 'pas dans public_html');
      all = play(['rm -r site', 'mirror -R site public_html']);
      contains(all, '--delete');
      expect(c.finished).not.toContain('web-host');
      play(['mirror -R --delete site public_html', 'bye']);
      expect(c.finished).toContain('web-host');
    });
  });
