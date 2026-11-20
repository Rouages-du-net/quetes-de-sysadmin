// Compressed files (compression.ts, commands/compress.ts): gzip and its
// cousins on a binary file with the real header, zcat/zgrep/zless reading
// rotated logs, bzip2, xz, zip/unzip after apt install, tar -j/-J/-tv,
// logrotate's compress.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';
import { packedFile, pack, unpack } from '../src/engine/compression';

const mine = { owner: 'you' };
const chapter = (): Chapter => ({
  id: 'compressed-test',
  number: 1,
  commands: ['tar', 'ls', 'cat', 'grep', 'less', 'diff', 'file', 'echo', 'sudo', 'apt', 'logrotate', 'wc'],
  home: '/home/you',
  welcome: 'a.txt',
  final: '',
  events: [],
  password: 'sunflower',
  createWorld: () =>
    d({
      tmp: d({}, undefined, { mode: 'rwxrwxrwt' }),
      var: d({
        log: d({
          'auth.log': f('Nov 4 sshd: Accepted publickey for you', { lines: true }),
          'auth.log.2.gz': packedFile('gzip', 'Nov 3 sshd: Failed password for root\nNov 3 sshd: Failed password for admin', { size: 4_100_000, mtime: Date.UTC(2027, 0, 1, 6, 25) }),
        }),
      }),
      home: d({ you: d({ 'a.txt': f('hello world\nline two', { lines: true, ...mine }), d: d({ a: f('hi', mine), b: f('yo', mine) }, undefined, mine) }, undefined, mine) }),
    }),
});
const shell = (language: 'en' | 'fr' = 'en') => {
  const s = new Shell(chapter(), language);
  s.colours = false;
  return s;
};

describe('the model', () => {
  it('reads back what it packed, with its name, date and declared size', () => {
    const bytes = pack('gzip', 'héllo', { name: 'x.txt', mtime: Date.UTC(2027, 0, 1), isize: 99 });
    expect(bytes.startsWith('\x1f\x8b\x08\x08')).toBe(true);
    expect(unpack(bytes)).toMatchObject({ format: 'gzip', name: 'x.txt', text: 'héllo', isize: 99 });
    expect(unpack(bytes.slice(0, -9) + 'x' + bytes.slice(-8))).toBeNull();
    expect(unpack(pack('xz', 'abc'))?.text).toBe('abc');
  });
});

describe('gzip, gunzip, zcat', () => {
  it('replaces the file, lists it, refuses what is already compressed, and gives it back', () => {
    const s = shell();
    expect(s.execute('gzip a.txt')).toBe('');
    expect(s.execute('ls')).toBe('a.txt.gz  d/');
    expect(s.execute('gzip -l a.txt.gz')).toBe('         compressed        uncompressed  ratio uncompressed_name\n                 46                  20 -10.0% a.txt');
    expect(s.execute('file a.txt.gz')).toMatch(/^a\.txt\.gz: gzip compressed data, was "a\.txt", last modified: .*, from Unix, original size modulo 2\^32 20$/);
    // cat shows bytes, not the text.
    expect(s.execute('cat a.txt.gz')).not.toContain('hello');
    expect(s.execute('zcat a.txt.gz')).toBe('hello world\nline two');
    expect(s.execute('zcat a.txt')).toBe('hello world\nline two');
    expect(s.execute('gzip a.txt.gz')).toBe('gzip: a.txt.gz already has .gz suffix -- unchanged');
    expect(s.lastStatus).toBe(2);
    expect(s.execute('gunzip -v a.txt.gz')).toBe('a.txt.gz:\t-10.0% -- replaced with a.txt');
    expect(s.lastStatus).toBe(0);
    expect(s.execute('cat a.txt')).toBe('hello world\nline two');
    expect(s.execute('gunzip a.txt')).toBe('gzip: a.txt: unknown suffix -- ignored');
    expect(s.execute('zcat a.txt')).toBe('gzip: a.txt: not in gzip format');
    expect(s.lastStatus).toBe(1);
  });

  it('-k keeps the original, -c goes through pipes and redirections, never to the terminal', () => {
    const s = shell();
    s.execute('gzip -k a.txt');
    expect(s.execute('ls')).toBe('a.txt  a.txt.gz  d/');
    expect(s.execute('gzip a.txt')).toBe('gzip: a.txt.gz already exists;\tnot overwritten');
    expect(s.lastStatus).toBe(2);
    expect(s.execute('gzip -c a.txt')).toBe('gzip: compressed data not written to a terminal. Use -f to force compression.\nFor help, type: gzip -h');
    expect(s.execute('gzip -c a.txt > b.gz')).toBe('');
    expect(s.execute('zcat b.gz | grep two')).toBe('line two');
    expect(s.execute('cat a.txt | gzip | gunzip')).toBe('hello world\nline two');
    expect(s.execute('cat b.gz > c.gz && zcat c.gz | wc -l')).toBe('2');
    expect(s.execute('gzip -r d && ls d')).toBe('a.gz  b.gz');
    expect(s.execute('gzip d')).toBe('gzip: d is a directory -- ignored');
    expect(s.execute('gzip nothere')).toBe('gzip: nothere: No such file or directory');
    expect(s.lastStatus).toBe(1);
    expect(s.execute('gzip -Q')).toBe("gzip: invalid option -- 'Q'\nTry `gzip --help' for more information.");
  });

  it('a rotated log: zcat, zgrep, zless, less (lesspipe) and gzip -l with its real size', () => {
    const s = shell('fr');
    expect(s.execute('zcat /var/log/auth.log.2.gz')).toBe('Nov 3 sshd: Failed password for root\nNov 3 sshd: Failed password for admin');
    expect(s.execute('zgrep -c Failed /var/log/auth.log*')).toBe('/var/log/auth.log:0\n/var/log/auth.log.2.gz:2');
    expect(s.execute('zgrep admin /var/log/auth.log.2.gz')).toBe('Nov 3 sshd: Failed password for admin');
    expect(s.execute('zless /var/log/auth.log.2.gz')).toContain('for root');
    expect(s.execute('less /var/log/auth.log.2.gz')).toContain('for root');
    expect(s.execute('gzip -l /var/log/auth.log.2.gz')).toContain('4100000  70.0% /var/log/auth.log.2');
    expect(s.execute('ls -l /var/log/auth.log.2.gz')).toContain('1230063');
  });
});

describe('bzip2, xz, zip', () => {
  it('bzip2 and xz compress and decompress, xz -l lists', () => {
    const s = shell();
    expect(s.execute('bzip2 a.txt && ls')).toBe('a.txt.bz2  d/');
    expect(s.execute('file a.txt.bz2')).toBe('a.txt.bz2: bzip2 compressed data, block size = 900k');
    expect(s.execute('bzcat a.txt.bz2')).toBe('hello world\nline two');
    expect(s.execute('bunzip2 a.txt.bz2 && xz -k a.txt')).toBe('');
    expect(s.execute('xz -l a.txt.xz')).toMatch(/^Strms {2}Blocks {3}Compressed Uncompressed {2}Ratio {2}Check {3}Filename\n {4}1 {7}1 .* CRC64 {3}a\.txt\.xz$/);
    expect(s.execute('xzcat a.txt.xz')).toBe('hello world\nline two');
    expect(s.execute('xz a.txt')).toBe('xz: a.txt.xz: File exists');
  });

  it('zip and unzip are not installed until apt installs them', () => {
    const s = shell();
    expect(s.execute('zip -r d.zip d')).toBe('-bash: zip: command not found');
    expect(s.lastStatus).toBe(127);
    s.execute('sudo apt update');
    s.execute('sunflower');
    s.execute('sudo apt install -y zip unzip');
    expect(s.execute('zip -r d.zip d')).toBe('  adding: d/ (stored 0%)\n  adding: d/a (stored 0%)\n  adding: d/b (stored 0%)');
    expect(s.execute('unzip -l d.zip')).toMatch(/^Archive: {2}d\.zip\n {2}Length {6}Date {4}Time {4}Name\n-{9} {2}-{10} -{5} {3}-{4}\n {8}0 {2}\d{4}-\d\d-\d\d \d\d:\d\d {3}d\/\n/);
    expect(s.execute('unzip d.zip -d /tmp/u')).toBe('Archive:  d.zip\n   creating: /tmp/u/d/\n extracting: /tmp/u/d/a              \n extracting: /tmp/u/d/b              ');
    expect(s.execute('cat /tmp/u/d/b')).toBe('yo');
    // An existing file: the question.
    expect(s.execute('unzip d.zip -d /tmp/u')).toBe('Archive:  d.zip');
    expect(s.execute('N')).toBe('');
    expect(s.execute('unzip nothere.zip')).toBe('unzip:  cannot find or open nothere.zip, nothere.zip.zip or nothere.zip.ZIP.');
    expect(s.lastStatus).toBe(9);
  });
});

describe('tar', () => {
  it('-J and -j compress, reading recognises the format, -tv lists like ls -l', () => {
    const s = shell();
    s.execute('tar cJf d.txz d');
    expect(s.execute('file d.txz')).toBe('d.txz: XZ compressed data, checksum CRC64');
    expect(s.execute('tar tf d.txz')).toBe('d/\nd/a\nd/b');
    expect(s.execute('tar tvf d.txz')).toMatch(/^drwxr-xr-x you\/you {11}0 \d{4}-\d\d-\d\d \d\d:\d\d d\/\n-rw-r--r-- you\/you {11}2 .* d\/a\n/);
    expect(s.execute('tar tzf d.txz')).toBe('\ngzip: stdin: not in gzip format\ntar: Child returned status 1\ntar: Error is not recoverable: exiting now');
    expect(s.lastStatus).toBe(2);
    s.execute('tar caf d.tar.bz2 d');
    expect(s.execute('file d.tar.bz2')).toBe('d.tar.bz2: bzip2 compressed data, block size = 900k');
    expect(s.execute('tar xjf d.tar.bz2 -C /tmp && cat /tmp/d/a')).toBe('hi');
    // gzip on a tar archive: a .tar.gz that tar still reads.
    s.execute('tar cf e.tar d');
    expect(s.execute('gzip e.tar && tar tzf e.tar.gz')).toBe('d/\nd/a\nd/b');
  });
});

describe('logrotate', () => {
  it('compress writes a .gz that zcat reads', () => {
    const s = shell();
    s.execute('sudo true');
    s.execute('sunflower');
    s.execute('echo "/var/log/auth.log {\n  rotate 3\n  compress\n}" > /tmp/lr.conf');
    s.execute('sudo logrotate -f /tmp/lr.conf');
    expect(s.execute('zcat /var/log/auth.log.1.gz')).toBe('Nov 4 sshd: Accepted publickey for you');
  });
});
