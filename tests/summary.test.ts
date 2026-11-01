// The end-of-chapter summary: the commands typed (and those in error), the
// hints, and the command that passed each step, next to the reference
// solution.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { summary } from '../src/engine/summary';
import { hint } from '../src/engine/hints';
import { translator } from '../src/texts';
import { inLanguage } from './names';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const L = (text: string) => inLanguage(translator('fr'), text);

describe('End-of-chapter summary', () => {
  it('counts the commands, the errors, and records each step\'s command', () => {
    const s = new Shell(chapter('lighthouse'), 'fr');
    s.requestsHints.add(`${hint(s).step}:piste`);
    for (const l of ['lss', 'cat message.txt', 'cd Hill/SignalSchool/PracticeRoom', 'mv crab Bucket', 'cd ~/Pier', 'mv net ~/Harbour/Boathouse', 'cd ~/Harbour/Storeroom', 'mv .spare_bulb ~/Pier/Lighthouse/Stairs/Lantern/bulb'])
      s.execute(L(l));
    expect(s.finished).toBe(true);
    const b = summary(s);
    expect(b.commands).toBe(8);
    expect(b.errors).toBe(1);
    expect(b.hints).toBe(1);
    expect(b.steps.length).toBeGreaterThan(0);
    // Each step has its reference solution; the last one was passed by the final mv.
    expect(b.steps.every((e) => e.solution.length > 0)).toBe(true);
    expect(b.steps.some((e) => e.line === L('mv .spare_bulb ~/Pier/Lighthouse/Stairs/Lantern/bulb'))).toBe(true);
  });

  it('a password asked by sudo is not one more command', () => {
    const s = new Shell(chapter('root'), 'fr');
    s.execute('sudo ls');
    s.execute(chapter('root').password!);
    expect(summary(s).commands).toBe(1);
  });
});
