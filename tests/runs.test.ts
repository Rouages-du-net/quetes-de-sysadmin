// Replay and compare (src/engine/runs.ts): the runs kept, the comparison
// and the diff of the commands typed.

import { describe, it, expect } from 'vitest';
import { addRun, commandNames, compare, diffLines, makeRun, readRuns, CHAPTERS_KEPT, LINES_KEPT, LINE_MAX, RUNS_KEPT, type Run } from '../src/engine/runs';

const run = (lines: string[], over: Partial<Run> = {}): Run =>
  makeRun({ chapter: 'lighthouse', date: '2026-11-23T10:00:00.000Z', time: 120_000, commands: lines.length, errors: 0, hints: 0, exam: false, lines, ...over });

describe('commandNames', () => {
  it('takes the first word of each simple command', () => {
    expect(commandNames('ls -la | grep x && cat a; echo b || true &')).toEqual(['ls', 'grep', 'cat', 'echo', 'true']);
  });
  it('looks past sudo, its options and variable assignments', () => {
    expect(commandNames('sudo systemctl restart nginx')).toEqual(['systemctl']);
    expect(commandNames('sudo -u postgres psql')).toEqual(['psql']);
    expect(commandNames('LANG=C nice -n 10 tar czf a.tgz .')).toEqual(['tar']);
  });
  it('ignores what is not a command', () => {
    expect(commandNames('   ')).toEqual([]);
    expect(commandNames('"quoted thing"')).toEqual([]);
  });
});

describe('makeRun', () => {
  it('counts distinct commands and caps the lines', () => {
    const r = run(['ls', 'ls -a', 'sudo ls /root', 'cat notes']);
    expect(r.distinct).toBe(2);
    const long = run([...Array.from({ length: LINES_KEPT + 5 }, (_, i) => `echo ${i}`), 'x'.repeat(500)]);
    expect(long.lines).toHaveLength(LINES_KEPT);
    expect(long.lines.at(-1)!.length).toBe(LINE_MAX);
    expect(long.lines.at(-1)!.endsWith('…')).toBe(true);
  });
});

describe('addRun', () => {
  it('keeps the last runs of a chapter', () => {
    let runs = {};
    for (let i = 0; i < RUNS_KEPT + 2; i++) runs = addRun(runs, run([`echo ${i}`], { date: `2026-11-2${i}T10:00:00.000Z` }));
    const kept = (runs as Record<string, Run[]>).lighthouse;
    expect(kept).toHaveLength(RUNS_KEPT);
    expect(kept.at(-1)!.lines).toEqual([`echo ${RUNS_KEPT + 1}`]);
  });
  it('keeps the chapters played last', () => {
    let runs = {};
    for (let i = 0; i < CHAPTERS_KEPT + 3; i++) runs = addRun(runs, run(['ls'], { chapter: `c${i}`, date: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString() }));
    expect(Object.keys(runs)).toHaveLength(CHAPTERS_KEPT);
    expect(Object.keys(runs)).toContain(`c${CHAPTERS_KEPT + 2}`);
    expect(Object.keys(runs)).not.toContain('c0');
  });
});

describe('readRuns', () => {
  it('drops anything odd', () => {
    const good = run(['ls']);
    expect(readRuns({ lighthouse: [good, { ...good, commands: -1 }, null], village: 'no', root: [{ ...good }] })).toEqual({ lighthouse: [good] });
    expect(readRuns('nope')).toEqual({});
  });
});

describe('diffLines', () => {
  it('keeps the common commands and marks the rest', () => {
    expect(diffLines(['ls', 'cd a', 'cat x', 'rm x'], ['ls', 'cat x', 'mv x y'])).toEqual([
      { kind: 'both', line: 'ls' },
      { kind: 'before', line: 'cd a' },
      { kind: 'both', line: 'cat x' },
      { kind: 'before', line: 'rm x' },
      { kind: 'after', line: 'mv x y' },
    ]);
  });
  it('handles empty lists', () => {
    expect(diffLines([], ['ls'])).toEqual([{ kind: 'after', line: 'ls' }]);
    expect(diffLines(['ls'], [])).toEqual([{ kind: 'before', line: 'ls' }]);
    expect(diffLines([], [])).toEqual([]);
  });
});

describe('compare', () => {
  it('has nothing to compare on a first run', () => {
    expect(compare([], run(['ls']))).toBeNull();
  });
  it('sets this run next to the earlier ones, with trends', () => {
    const first = run(['ls', 'ls -a', 'cat a', 'cat b'], { errors: 2, hints: 1, time: 300_000, date: '2026-11-20T10:00:00.000Z' });
    const second = run(['ls', 'cat a'], { errors: 0, hints: 1, time: null, date: '2026-11-23T10:00:00.000Z' });
    const c = compare([first], second)!;
    expect(c.runs).toEqual([first, second]);
    const row = (m: string) => c.rows.find((r) => r.metric === m)!;
    expect(row('commands')).toEqual({ metric: 'commands', values: [4, 2], trend: 'better' });
    expect(row('errors').trend).toBe('better');
    expect(row('hints').trend).toBe('same');
    expect(row('time')).toEqual({ metric: 'time', values: [300_000, null], trend: null });
    expect(row('distinct').trend).toBeNull();
    expect(c.diff.filter((d) => d.kind === 'before').map((d) => d.line)).toEqual(['ls -a', 'cat b']);
  });
  it('shows at most the kept runs, and diffs against the latest one', () => {
    const runs = [1, 2, 3, 4].map((i) => run([`echo ${i}`], { commands: i }));
    const c = compare(runs.slice(0, 3), runs[3])!;
    expect(c.runs).toHaveLength(RUNS_KEPT);
    expect(c.rows[0].values).toEqual([2, 3, 4]);
    expect(c.rows[0].trend).toBe('worse');
    expect(c.diff).toEqual([{ kind: 'before', line: 'echo 3' }, { kind: 'after', line: 'echo 4' }]);
  });
});
