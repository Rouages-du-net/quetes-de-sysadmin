// Next Door Windows: CR LF line endings, a Windows share mounted with cifs,
// and a Windows Server's PowerShell over OpenSSH. Replayed with the console,
// in every language.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { tokenize, outDefault, literal, operate } from '../src/engine/powershell';
import { CMDLETS } from '../src/engine/commands/powershell';
import { COMMANDS } from '../src/engine/commands';

const ERASER = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('mixed-fleet')])];

describe('PowerShell, the parts', () => {
  it('tokens: parameters, strings, script blocks, pipes', () => {
    const t = tokenize("Get-ChildItem D:\\ -Recurse | Where-Object { $_.Length -gt 1GB } | Select-Object Name,Length -First 5");
    expect(Array.isArray(t)).toBe(true);
    if (!Array.isArray(t)) return;
    expect(t.map((x) => x.kind)).toEqual(['word', 'word', 'param', 'pipe', 'word', 'block', 'pipe', 'word', 'word', 'param', 'word']);
    expect(tokenize("Write-Output 'oops")).toMatchObject({ error: 'The string is missing the terminator: \'.' });
  });
  it('numbers with KB/MB/GB, comparisons without case', () => {
    expect(literal('1GB')).toBe(1024 ** 3);
    expect(operate('eq', 'Running', 'running')).toBe(true);
    expect(operate('like', 'plans.zip', '*.ZIP')).toBe(true);
    expect(outDefault([{ type: 'X', props: { A: 1, B: 'b' } }], {})).toContain('A B');
  });
  it('every cmdlet has its manual page', () => {
    for (const c of CMDLETS) expect(COMMANDS[c.name]?.cmdlet, c.name).toBe(true);
  });
});

for (const language of LANGUAGES)
  describe(`Next Door Windows — ${language}`, () => {
    const fr = language === 'fr';
    const CABINET = fr ? 'armoire' : 'cabinet';
    const L = (line: string) => inLanguage(translator(language), line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const first = (out: string) => out.split('\n')[0];
    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...ERASER, ...finished] });
      const one = (l: string) => c.execute(machinesInLanguage(c.t, L(l)).replace(/\bcabinet\b/g, CABINET)) ?? '';
      const play = (lines: string[]) => lines.map(one).join('\n');
      const flag = (id: string) => ((c.shell as unknown as { principal: typeof c.shell }).principal ?? c.shell).flags.has(id);
      play(['ssh compass', 'yes']);
      return { c, play, flag };
    };

    // ——— Chapter 1: "Invisible Characters" ———
    it('chapter 1 — solution: bad interpreter, cat -A, dos2unix, run, .gitattributes', () => {
      const { c, play, flag } = part();
      play(['cd ops']);
      expect(play(['./nightly-copy.sh'])).toContain('-bash: ./nightly-copy.sh: /bin/bash^M: bad interpreter: No such file or directory');
      expect(flag('bad-interpreter')).toBe(true);
      const run = play(['bash nightly-copy.sh']);
      expect(run).toContain("nightly-copy.sh: line 5: $'\\r': command not found");
      expect(run).toContain(fr ? "nightly-copy.sh: line 6: cd : $'/srv/projects\\r' : aucun fichier ou dossier de ce nom" : "nightly-copy.sh: line 6: cd: $'/srv/projects\\r': No such file or directory");
      expect(first(play(['file nightly-copy.sh']))).toBe('nightly-copy.sh: Bourne-Again shell script, ASCII text executable, with CRLF line terminators');
      expect(play(['cat -A nightly-copy.sh'])).toContain('#!/bin/bash^M$');
      expect(flag('crlf')).toBe(true);
      expect(first(play(['dos2unix -i nightly-copy.sh']))).toBe('       6       0       0  no_bom    text    nightly-copy.sh');
      // dos2unix 7.5 (checked): an unknown option prints only the usage, exit code 1.
      expect(play(['dos2unix -Z nightly-copy.sh'])).toMatch(fr ? /^Utilisation : dos2unix / : /^Usage: dos2unix \[options\] \[file \.\.\.\] \[-n infile outfile \.\.\.\]\n/);
      expect(c.shell.lastStatus).toBe(1);
      expect(first(play(['dos2unix nightly-copy.sh']))).toBe('dos2unix: converting file nightly-copy.sh to Unix format...');
      expect(first(play(['file nightly-copy.sh']))).toBe('nightly-copy.sh: Bourne-Again shell script, ASCII text executable');
      expect(first(play(['./nightly-copy.sh']))).toBe('Backup finished');
      expect(flag('ran')).toBe(true);
      expect(play(['git status'])).toContain('nightly-copy.sh');
      play(["echo '*.sh text eol=lf' > .gitattributes", 'git add .gitattributes nightly-copy.sh']);
      expect(c.finished).not.toContain('line-endings');
      const end = play(['git commit -m "Scripts in LF"']);
      contains(end, 'Bravo');
      expect(c.finished).toContain('line-endings');
    });

    it('chapter 1 — another way: sed, and git warns about CRLF; chmod as a false lead', () => {
      const { c, play, flag } = part();
      play(['cd ops', 'chmod +x nightly-copy.sh']);
      expect(flag('chmod')).toBe(true);
      play(["echo '* text=auto eol=lf' > .gitattributes"]);
      // git normalises a CRLF working copy on add, and says so.
      expect(first(play(['git add nightly-copy.sh']))).toBe("warning: in the working copy of 'nightly-copy.sh', CRLF will be replaced by LF the next time Git touches it");
      play(['git add .gitattributes', 'git commit -m "Line endings"']);
      expect(c.finished).not.toContain('line-endings');
      play(["sed -i 's/\\r$//' nightly-copy.sh"]);
      expect(flag('converted')).toBe(true);
      expect(play(['cat nightly-copy.sh | tr -d x'])).toContain('SRC=/srv/projects');
      expect(play(['tr -d r nightly-copy.sh'])).toContain("tr: extra operand 'nightly-copy.sh'");
      play(['./nightly-copy.sh']);
      expect(c.finished).toContain('line-endings');
    });

    // ——— Chapter 2: "The Share Next Door" ———
    const CREDS = '/root/.smbcredentials';
    it('chapter 2 — solution: smbclient, cifs-utils, credentials file, uid/gid, fstab', () => {
      const { c, play, flag } = part(['line-endings']);
      const list = play(['smbclient -L //cabinet -U compass-svc', 'Ruler-2029-cab']);
      expect(list).toContain('plans           Disk      Drawings and plans');
      expect(list).toContain('SMB1 disabled -- no workgroup available');
      expect(flag('listed')).toBe(true);
      play(['sudo mount -t cifs //cabinet/plans /mnt/plans', fr ? 'calque-2029' : 'drafting-2029']);
      expect(flag('helper-missing')).toBe(true);
      play(['sudo apt install cifs-utils', 'Y']);
      // cifs-utils 7.0's mount.cifs.c: EHOSTDOWN is explained first, then the error and exit code 32.
      expect(play(['sudo mount -t cifs //cabinet/plans /mnt/plans -o username=compass-svc,vers=1.0', 'Ruler-2029-cab'])).toContain(
        'mount error: Server abruptly closed the connection.\nThis can happen if the server does not support the SMB version you are trying to use.\nThe default SMB version recently changed from SMB1 to SMB2.1 and above. Try mounting with vers=1.0.\nmount error(112): Host is down\nRefer to the mount.cifs(8) manual page',
      );
      expect(c.shell.lastStatus).toBe(32);
      expect(play(['sudo mount -t cifs cabinet/plans /mnt/plans'])).toMatch(/^mount.cifs: bad UNC \(\w+\/plans\)$/);
      expect(c.shell.lastStatus).toBe(1);
      expect(play(['sudo mount -t cifs //cabinet/plans /mnt/plans -o username=compass-svc', 'nope'])).toContain('mount error(13): Permission denied');
      expect(play([`sudo mount -t cifs //cabinet/plans /mnt/plans -o credentials=${CREDS}`])).toBe(`error 2 (No such file or directory) opening credential file ${CREDS}`);
      expect(c.shell.lastStatus).toBe(2);
      play([`echo username=compass-svc | sudo tee ${CREDS}`, `echo password=Ruler-2029-cab | sudo tee -a ${CREDS}`]);
      expect(flag('world-readable')).toBe(true);
      play([`sudo chmod 600 ${CREDS}`]);
      expect(play([`sudo mount -t cifs //cabinet/plans /mnt/plans -o credentials=${CREDS}`])).not.toContain('error');
      expect(flag('mounted')).toBe(true);
      expect(play(['ls -l /mnt/plans'])).toMatch(/drwxr-xr-x \d+ root +root .* exports/);
      expect(flag('root-owned')).toBe(true);
      play(['sudo chown -R plotter: /mnt/plans']);
      expect(flag('chown')).toBe(true);
      play(['sudo umount /mnt/plans', `sudo mount -t cifs //cabinet/plans /mnt/plans -o credentials=${CREDS},uid=plotter,gid=plotter`]);
      expect(flag('writable')).toBe(true);
      expect(play(['mount'])).toContain('type cifs (rw,relatime,vers=3.1.1,cache=strict,username=compass-svc,uid=1001,forceuid,gid=1001,forcegid');
      expect(play(['sudo -u plotter touch /mnt/plans/exports/test.pdf', 'ls /mnt/plans/exports'])).toContain('test.pdf');
      expect(play(['df -h /mnt/plans'])).toContain('/mnt/plans');
      play([`echo '//cabinet/plans /mnt/plans cifs credentials=${CREDS},uid=plotter,gid=plotter,_netdev 0 0' | sudo tee -a /etc/fstab`]);
      expect(flag('no-nofail')).toBe(true);
      expect(c.finished).not.toContain('smb-mount');
      const end = play(['sudo sed -i s/_netdev/_netdev,nofail/ /etc/fstab', 'sudo umount /mnt/plans', 'sudo mount -a']);
      contains(end, 'Bravo');
      expect(c.finished).toContain('smb-mount');
      expect(play(['findmnt /mnt/plans'])).toContain('cifs');
    });

    it('chapter 2 — false lead: the password on the command line', () => {
      const { play, flag } = part(['line-endings']);
      play(['sudo apt install -y cifs-utils', fr ? 'calque-2029' : 'drafting-2029', 'sudo mount -t cifs //cabinet/plans /mnt/plans -o username=compass-svc,password=Ruler-2029-cab,uid=plotter']);
      expect(flag('password-visible')).toBe(true);
      expect(flag('writable')).toBe(true);
      expect(play(['mount'])).not.toContain('Ruler-2029-cab');
    });

    // ——— Chapter 3: "The Other Side" ———
    it('chapter 3 — solution: df and du, ssh into PowerShell, Get-Volume, the zip, the report', () => {
      const { c, play, flag } = part(['line-endings', 'smb-mount']);
      expect(play(['tail -2 /var/log/plotter/export.log'])).toContain('No space left on device');
      expect(play(['df -h /mnt/plans'])).toMatch(/500G .*100% \/mnt\/plans/);
      expect(flag('full')).toBe(true);
      play(['du -sh /mnt/plans']);
      expect(flag('outside')).toBe(true);
      const banner = play(['ssh cabinet', 'yes']);
      expect(banner).toContain('Windows PowerShell');
      expect(c.shell.prompt()).toBe(`PS C:\\Users\\${fr ? 'vous' : 'you'}>`);
      const grep = play(['grep zip']);
      expect(flag('powershell')).toBe(true);
      expect(grep).toContain("grep : The term 'grep' is not recognized as the name of a cmdlet, function, script file, or operable program.");
      expect(grep).toContain('    + FullyQualifiedErrorId : CommandNotFoundException');
      expect(flag('linux-habit')).toBe(true);
      expect(play(['ls -la'])).toContain("ls : A parameter cannot be found that matches parameter name 'la'.");
      expect(flag('parameter')).toBe(true);
      expect(play(['hostname'])).toBe(CABINET.toUpperCase());
      expect(play(['whoami'])).toBe(`${CABINET}\\${fr ? 'vous' : 'you'}`);
      expect(play(['Get-Service LanmanServer'])).toMatch(/Running +LanmanServer +Server/);
      const vol = play(['Get-Volume']);
      expect(vol).toMatch(/D +Data +NTFS +Fixed +Healthy +OK +11\.\d+ MB +500 GB/);
      expect(flag('volume')).toBe(true);
      expect(play(['get-psdrive d'])).toMatch(/D +499\.99 +0\.01 FileSystem D:\\/);
      const top = play(['Get-ChildItem D:\\ -Recurse -File | Sort-Object Length -Descending | Select-Object -First 3']);
      expect(top).toContain('    Directory: D:\\Backup');
      expect(top).toContain('plans-full-2029-11-03.zip');
      expect(flag('culprit')).toBe(true);
      expect(play(['Get-WinEvent -LogName System -MaxEvents 5'])).toContain('The D: disk is at or near capacity');
      expect(flag('event-log')).toBe(true);
      expect(play(['Remove-Item D:\\Backup\\plans-full-2029-11-03.zip'])).toContain('Remove-Item');
      expect(flag('read-only')).toBe(true);
      expect(play(['Get-Help Get-Volume'])).toContain('Get-Volume [[-DriveLetter] <Char[]>]');
      expect(play(['cd D:\\shares', 'pwd'])).toContain('D:\\Shares');
      play(['exit']);
      expect(c.shell.prompt()).toContain('compass'.replace('compass', fr ? 'compas' : 'compass'));
      play(["echo 'D: (Data) is full: D:\\Backup\\plans-full-2029-11-03.zip since 3 November' > cabinet-report.txt"]);
      expect(c.finished).toContain('full-volume');
      expect(play(['df -h /mnt/plans'])).not.toContain('100%');
    });

    it('chapter 3 — false lead: deleting drawings from Linux', () => {
      const { c, play, flag } = part(['line-endings', 'smb-mount']);
      play(['sudo rm /mnt/plans/exports/school-canteen-A1.pdf', fr ? 'calque-2029' : 'drafting-2029']);
      expect(flag('deleted-drawings')).toBe(true);
      expect(play(['df -h /mnt/plans'])).toContain('100%');
      expect(c.finished).not.toContain('full-volume');
      expect(play(['man Get-ChildItem'])).toMatch(/^GET-CHILDITEM\(PS\)/);
    });
  });
