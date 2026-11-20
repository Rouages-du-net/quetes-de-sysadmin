import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';
const chapter = (): Chapter => ({
  id: 'x', number: 1, commands: ['ls','cd','pwd','echo','cat','grep','head','wc','test','mkdir','touch','rm','sudo','nano','history','exit','seq','sort'],
  home: '/home/you', welcome: 'notes.txt', final: 'end', password: 'sunflower', events: [],
  createWorld: () => d({ tmp: d({}), home: d({ you: d({ 'notes.txt': f('alpha\nbeta\ngamma', { lines: true }), 'a.log': f('x'), 'b.log': f('y') }) }) }),
});
it('scratch', () => {
  const s = new Shell(chapter(), 'en');
  const out: string[] = [];
  const lines = (process.env.LINES ?? '').split('\n§\n');
  for (const l of lines) { const r = s.execute(l); out.push(`${s.prompt()}| ${l}\n${r}`); }
  writeFileSync('/tmp/claude-0/-home-user/8158ca95-1980-5311-a7fd-0e10f94982a4/scratchpad/out.txt', out.join('\n') + '\nHIST:' + JSON.stringify(s.history));
});
