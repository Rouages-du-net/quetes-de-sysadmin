import { it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';

it('scratch', () => {
  const all = STORIES.flatMap((s) => s.chapters.map((c) => c.id));
  const c = new Console({ language: 'en', finished: all.filter((x) => !['return-code','late-file'].includes(x)) });
  const run = (l: string) => { let o = c.execute(l) ?? ''; if (c.shell.waiting) o += '\n' + (c.execute('ledger-2029') ?? ''); console.log('$ ' + l + '\n' + o); };
  run('ssh abacus'); run('yes');
  for (const l of ['cd /opt/batch/src', 'cobc -x contrib.cob', 'cobc -x -I /opt/batch/copybooks contrib.cob', 'cobc -x -free -I ../copybooks contrib.cob', 'cobc -I ../copybooks ebc2asc.cob', 'ls', './ebc2asc.so', 'echo $?']) run(l);
  const sh = (c.shell as any);
  const n = sh.find('/opt/batch/src/contrib.cob');
  n.content = n.content.replace(/^CHECK-TOTALS\.$/m, '       CHECK-TOTALS.').replace(/^  IF/m, '           IF').replace(/^    DISPLAY/m, '               DISPLAY').replace(/^    MOVE 8/m, '               MOVE 8');
  for (const l of ['cobc -x -I ../copybooks contrib.cob', 'file contrib', './contrib /srv/batch/in/contrib.dat /srv/batch/out/contrib.rpt', 'echo $?', 'cat /srv/batch/out/contrib.rpt', './contrib /srv/batch/in/test-bad.dat /tmp/t.rpt', 'echo $?']) run(l);
});
