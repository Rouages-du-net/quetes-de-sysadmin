import { describe, expect, it } from 'vitest';
import { DIGEST_SECONDS, FollowDigest, lastOutput } from '../src/engine/announce';

describe('lastOutput: what Alt+R reads again', () => {
  it('reads the blocks after the last command line', () => {
    const r = lastOutput([
      { command: true, text: 'me@box:~$ ls' },
      { command: false, text: 'a  b' },
      { command: true, text: 'me@box:~$ cat a' },
      { command: false, text: 'first\n' },
      { command: false, text: 'second' },
    ]);
    expect(r).toEqual({ text: 'first\nsecond', lines: 2, cut: 0 });
  });
  it('is empty when the last command printed nothing', () => {
    expect(lastOutput([{ command: false, text: 'welcome' }, { command: true, text: '$ cd /tmp' }]).text).toBe('');
  });
  it('reads everything before the first command (the welcome)', () => {
    expect(lastOutput([{ command: false, text: 'Welcome' }]).text).toBe('Welcome');
  });
  it('keeps only the end of a long output, and says how much is left out', () => {
    const long = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    const r = lastOutput([{ command: true, text: '$ seq 100' }, { command: false, text: long }], 10);
    expect(r.cut).toBe(90);
    expect(r.lines).toBe(100);
    expect(r.text.split('\n')).toEqual(Array.from({ length: 10 }, (_, i) => `line ${i + 91}`));
  });
});

describe('FollowDigest: tail -f without flooding the screen reader', () => {
  it('says nothing before its interval, then the count and the last line', () => {
    const d = new FollowDigest(0);
    d.add('Nov 22 10:00:01 sshd[1]: one\n');
    expect(d.tick(1)).toBeNull();
    d.add('Nov 22 10:00:02 sshd[1]: two\nNov 22 10:00:03 sshd[1]: three');
    expect(d.tick(DIGEST_SECONDS - 1)).toBeNull();
    expect(d.tick(DIGEST_SECONDS)).toEqual({ kind: 'lines', count: 3, last: 'Nov 22 10:00:03 sshd[1]: three' });
  });
  it('waits a whole interval after a digest, and stays quiet when nothing arrives', () => {
    const d = new FollowDigest(0, { every: 5 });
    d.add('a');
    expect(d.tick(5)).not.toBeNull();
    d.add('b');
    expect(d.tick(9)).toBeNull();
    expect(d.tick(10)).toEqual({ kind: 'lines', count: 1, last: 'b' });
    expect(d.tick(20)).toBeNull();
  });
  it('ignores blank lines', () => {
    const d = new FollowDigest(0, { every: 1 });
    d.add('\n  \n');
    expect(d.tick(2)).toBeNull();
  });
  it('watch: announces a changed screen, not the same one redrawn', () => {
    const d = new FollowDigest(0, { screen: true, initial: 'Every 2.0s: df\n/ 40%', every: 2 });
    d.add('Every 2.0s: df\n/ 40%');
    expect(d.tick(3)).toBeNull();
    d.add('Every 2.0s: df\n/ 41%');
    expect(d.tick(4)).toEqual({ kind: 'screen' });
    d.add('Every 2.0s: df\n/ 41%');
    expect(d.tick(8)).toBeNull();
  });
});
