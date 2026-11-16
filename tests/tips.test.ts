// Tips: one-time advice earned by what the player types (silence means
// success, cd ../.., cd -, cd ~, Tab), each with its text in every language.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { TIPS, newMemory, newTips, type Tip } from '../src/engine/tips';
import { LANGUAGES, translator } from '../src/texts';

const lighthouse = STORIES[0].chapters[0];

function session() {
  const sh = new Shell(lighthouse, 'en');
  const memory = newMemory();
  const shown: Tip[] = [];
  // Runs a line and returns the tip it earns (null: none); `tab`: Tab was pressed.
  const run = (line: string, tab = false): Tip | null => {
    const before = sh.cwd;
    const said = !!sh.execute(line);
    const [tip] = newTips({ sh, before, tab, said }, memory, shown);
    if (tip) shown.push(tip);
    return tip ?? null;
  };
  return { sh, run, shown };
}

describe('Tips', () => {
  it('have a text in every language', () => {
    for (const language of LANGUAGES) for (const tip of TIPS) expect(translator(language).exists(`tip-${tip}`), `${language}: ${tip}`).toBe(true);
  });

  it('silence: a mv that succeeds says nothing, once', () => {
    const { run } = session();
    expect(run('ls')).toBe(null);
    expect(run('cd Pier')).toBe(null);
    // The story reacts to this one ("The net is put away"): no tip.
    expect(run('mv net ..')).toBe(null);
    expect(run('mv ../net .')).toBe('silence');
    expect(run('mv net ..')).toBe(null); // only once
  });

  it('silence: not when the command fails', () => {
    const { run } = session();
    expect(run('mv nothing-here elsewhere')).toBe(null);
  });

  it('up-twice: cd .. then cd .. again', () => {
    const { run } = session();
    run('cd Hill/SignalSchool/PracticeRoom');
    expect(run('cd ..')).toBe(null);
    expect(run('cd ..')).toBe('up-twice');
  });

  it('cd-back: back to the previous directory by its path', () => {
    const { run } = session();
    run('cd Hill/SignalSchool');
    expect(run('cd /Hut/Beach')).toBe(null);
    expect(run('cd /Hut/Hill/SignalSchool')).toBe('cd-back');
  });

  it('cd-back: not with cd -', () => {
    const { run } = session();
    run('cd Hill/SignalSchool');
    run('cd /Hut/Beach');
    expect(run('cd -')).toBe(null);
  });

  it('cd-home: home by its full path, not with ~ or ..', () => {
    const { run, sh } = session();
    run('cd Hill/SignalSchool');
    expect(run('cd ~')).toBe(null);
    run('cd Pier');
    expect(run('cd ..')).toBe(null);
    run('cd Hill/SignalSchool');
    expect(run(`cd ${sh.resolve('~')}`)).toBe('cd-home');
  });

  it('tab: long names typed in full three times, not when Tab was used', () => {
    const { run } = session();
    expect(run('cd Hill/SignalSchool', true)).toBe(null);
    expect(run('ls /Hut/Hill/SignalSchool', true)).toBe(null);
    expect(run('ls /Hut/Hill/SignalSchool')).toBe(null);
    expect(run('ls /Hut/Hill/SignalSchool')).toBe(null);
    expect(run('ls /Hut/Hill/SignalSchool')).toBe('tab');
  });
});
