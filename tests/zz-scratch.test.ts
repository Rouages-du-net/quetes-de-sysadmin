import { it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { writeFileSync } from 'fs';

it('scratch', () => {
  const script = (process.env.SCRIPT ?? '').split(' ;; ');
  const c = new Console({ language: (process.env.LANG2 ?? 'en') as 'en', finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('blood-drive'), ...(process.env.DONE ?? '').split(',').filter(Boolean)] });
  let log = '';
  for (const l of script) {
    if (l.startsWith('@file ')) {
      const [path, src] = l.slice(6).split(' ');
      (c.shell.find(path) as any).content = require('fs').readFileSync('/tmp/claude-0/-home-user/8158ca95-1980-5311-a7fd-0e10f94982a4/scratchpad/' + src, 'utf8').replace(/\n$/, '');
      log += `\n@file ${path}`;
      continue;
    }
    if (l.startsWith('@set ')) {
      const [path, ...rest] = l.slice(5).split('<<');
      const n = c.shell.find(path) as any;
      const text = rest.join('<<').replace(/\\n/g, '\n');
      const m = /^s\/(.*?)\/(.*?)\/$/s.exec(text);
      n.content = m ? n.content.replace(new RegExp(m[1]), m[2].replace(/\\N/g, '\n')) : text;
      log += `\n@set ${path}`;
      continue;
    }
    let o = c.execute(l);
    log += `\n$ ${l}\n${typeof o === 'string' ? o : ''}`;
    if (c.shell.waiting) { const p = c.execute('donor-chair-12'); log += typeof p === 'string' ? p : ''; }
    if (c.shell.question) { const p = c.execute('yes'); log += typeof p === 'string' ? p : ''; }
  }
  writeFileSync('/tmp/claude-0/-home-user/8158ca95-1980-5311-a7fd-0e10f94982a4/scratchpad/out.txt', log);
});
