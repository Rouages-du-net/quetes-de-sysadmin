// The Night Batch: a mainframe's COBOL batch moved to Linux (EBCDIC, COMP-3,
// cobc, return codes, a file that arrives late). Replayed with the console,
// in every language.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';

const BEFORE = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('night-batch')])];
const MDP = 'ledger-2029';

const GOOD_WRAPPER = `#!/bin/sh
set -e
test -f /srv/drop/contrib.ebc.done || exit 0
rm /srv/drop/contrib.ebc.done
/opt/batch/bin/ebc2asc /srv/drop/contrib.ebc /srv/batch/in/contrib.dat
/opt/batch/bin/contrib /srv/batch/in/contrib.dat /srv/batch/out/contrib.rpt`;

for (const language of LANGUAGES)
  describe(`The Night Batch — ${language}`, () => {
    const fr = language === 'fr';
    const L = (line: string) => inLanguage(translator(language), line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...BEFORE, ...finished] });
      const one = (l: string) => {
        let output = c.execute(machinesInLanguage(c.t, L(l))) ?? '';
        if (c.shell.waiting) output += '\n' + (c.execute(machinesInLanguage(c.t, MDP)) ?? '');
        return output;
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        const before = one(command);
        c.save(change(c.edition!.text));
        return before + '\n' + c.quitEdition();
      };
      play(['ssh abacus', 'yes']);
      return { c, play, edit, flag: (id: string) => c.shell.flags.has(id) };
    };

    // ——— Chapter 1: "Fixed Width" ———
    it('chapter 1 — solution: the bytes, the records, the field-by-field converter, the checks', () => {
      const { c, play, edit, flag } = part();
      expect(play(['file /srv/drop/contrib.ebc'])).toContain('contrib.ebc: data');
      expect(play(['wc -c /srv/drop/contrib.ebc'])).toContain('560');
      expect(flag('records')).toBe(true);
      const hex = play(['xxd /srv/drop/contrib.ebc | head -5']);
      expect(hex).toContain('00000040: 4040 40f2 f0f2 f9f1 f100 0004 250c 4040');
      expect(flag('bytes')).toBe(true);
      expect(play(['/opt/batch/bin/ebc2asc /srv/drop/contrib.ebc /srv/batch/in/contrib.dat'])).toContain('EBC2ASC: 14 RECORDS CONVERTED');
      expect(play(['tail -1 /srv/batch/in/contrib.dat'])).toContain('T000012END OF FILE         291121+000051520');
      expect(flag('converted')).toBe(true);
      expect(c.finished).not.toContain('copybook');
      const end = edit('nano check.txt', (t) => t.replace(/:\n/, ': 560\n').concat('\n14 records, 12 contributions, 515.20'));
      contains(end, 'Bravo');
      expect(c.finished).toContain('copybook');
    });

    it('chapter 1 — false leads: iconv stops in an amount, IBM037 and dd damage them', () => {
      const { c, play, flag } = part();
      expect(play(['iconv -f EBCDIC-US -t ASCII /srv/drop/contrib.ebc'])).toContain('iconv: illegal input sequence at position 75');
      expect(flag('illegal')).toBe(true);
      play(['iconv -f IBM037 -t UTF-8 /srv/drop/contrib.ebc > /tmp/u.txt']);
      expect(flag('text-converted')).toBe(true);
      expect(play(['wc -l /tmp/u.txt'])).not.toMatch(/^14 /);
      expect(play(['dd if=/srv/drop/contrib.ebc of=/tmp/a.txt conv=ascii'])).toContain('560 bytes copied');
      expect(play(['/opt/batch/bin/ebc2asc /tmp/a.txt /srv/batch/in/contrib.dat'])).toContain('INVALID PACKED AMOUNT IN RECORD 2');
      expect(play(['echo $?'])).toBe('8');
      expect(flag('wrong-dat')).toBe(true);
      expect(c.finished).not.toContain('copybook');
    });

    // ——— Chapter 2: "Return Code" ———
    const fixLines = (t: string) =>
      t
        .replace(/^CHECK-TOTALS\.$/m, '       CHECK-TOTALS.')
        .replace(/^ {2}IF /m, '           IF ')
        .replace(/^ {4}DISPLAY /m, '               DISPLAY ')
        .replace(/^ {4}MOVE 8 /m, '               MOVE 8 ');

    it('chapter 2 — solution: copybooks, columns, -x, return codes 0 and 8', () => {
      const { c, play, edit, flag } = part(['copybook']);
      play(['cd /opt/batch/src']);
      const first = play(['cobc -x contrib.cob']);
      expect(first).toContain('contrib.cob:20: error: CONTRIBA: No such file or directory');
      expect(first).toContain("contrib.cob:97: error: invalid indicator 'T' at column 7");
      edit('nano contrib.cob', fixLines);
      expect(play(['cobc -x -I /opt/batch/copybooks contrib.cob'])).not.toContain('error');
      expect(flag('compiled')).toBe(true);
      expect(play(['./contrib /srv/batch/in/contrib.dat /srv/batch/out/contrib.rpt'])).toContain('12 CONTRIBUTIONS, TOTAL 515.20');
      expect(play(['echo $?'])).toBe('0');
      expect(c.finished).not.toContain('return-code');
      const end = play(['./contrib /srv/batch/in/test-bad.dat /tmp/test.rpt']);
      expect(end).toContain('CONTRIB: CONTROL TOTALS DO NOT MATCH');
      contains(end, 'Bravo');
      expect(play(['echo $?'])).toBe('8');
      expect(c.finished).toContain('return-code');
    });

    it('chapter 2 — false leads: -free, a module, the check commented out', () => {
      const { c, play, edit, flag } = part(['copybook']);
      play(['cd /opt/batch/src']);
      expect(play(['cobc -x -free -I ../copybooks contrib.cob'])).toContain('syntax error');
      expect(flag('free')).toBe(true);
      play(['cobc -I ../copybooks ebc2asc.cob']);
      expect(play(['./ebc2asc.so'])).toContain('Segmentation fault');
      expect(play(['echo $?'])).toBe('139');
      // Comment out Ayesha's lines (an * in column 7) and her PERFORM: it compiles, without the check.
      edit('nano contrib.cob', (t) => fixLines(t).replace(/^ {6} (CHECK-TOTALS|    IF|        DISPLAY "CONTRIB: CONTROL|        MOVE 8)/gm, '      *$1'));
      expect(play(['cobc -x -I ../copybooks contrib.cob'])).toContain("'CHECK-TOTALS' is not defined");
      edit('nano contrib.cob', (t) => t.replace('005250     PERFORM CHECK-TOTALS', '005250*    PERFORM CHECK-TOTALS'));
      play(['cobc -x -I ../copybooks contrib.cob']);
      expect(flag('unchecked')).toBe(true);
      play(['./contrib /srv/batch/in/test-bad.dat /tmp/test.rpt']);
      expect(play(['echo $?'])).toBe('0');
      expect(flag('passed-bad')).toBe(true);
      expect(c.finished).not.toContain('return-code');
    });

    // ——— Chapter 3: "The Late File" ———
    it('chapter 3 — solution: wait for the .done, take it away, try again, fail visibly', () => {
      const { c, play, edit, flag } = part(['copybook', 'return-code']);
      expect(play(['journalctl -u night-batch'])).toContain('RUN DATE 291122');
      expect(flag('diagnosed')).toBe(true);
      edit('sudo nano /etc/systemd/system/night-batch.timer', (t) => t.replace('OnCalendar=*-*-* 02:00:00', 'OnCalendar=*-*-* 02..06:00/10'));
      play(['sudo systemctl daemon-reload']);
      expect(c.finished).not.toContain('late-file');
      const end = edit('nano /opt/batch/run-night.sh', () => GOOD_WRAPPER);
      expect(end).toContain('02:50');
      contains(end, 'Bravo');
      expect(c.finished).toContain('late-file');
      expect(play(['systemctl --failed'])).toBeDefined();
    });

    it('chapter 3 — other solution: a cron job and a mail', () => {
      const { c, play, edit } = part(['copybook', 'return-code']);
      play(['sudo systemctl disable --now night-batch.timer']);
      edit(
        'nano /opt/batch/run-night.sh',
        () => `#!/bin/sh
test -f /srv/drop/contrib.ebc.done || exit 0
mv /srv/drop/contrib.ebc.done /srv/batch/archive/
/opt/batch/bin/ebc2asc /srv/drop/contrib.ebc /srv/batch/in/contrib.dat
/opt/batch/bin/contrib /srv/batch/in/contrib.dat /srv/batch/out/contrib.rpt || echo "contrib failed" | mail -s "night batch" you`,
      );
      expect(c.finished).not.toContain('late-file');
      const end = edit('crontab -e', (t) => `${t}*/15 2-6 * * * /opt/batch/run-night.sh\n`);
      expect(c.finished).toContain('late-file');
      expect(end).toContain('03:30');
    });

    it('chapter 3 — false leads: a later fixed time, a flag never taken away, a silent failure', () => {
      const { c, play, edit, flag } = part(['copybook', 'return-code']);
      // 03:00 only: the first night works by luck, the second processes the old file again.
      let r = edit('sudo nano /etc/systemd/system/night-batch.timer', (t) => t.replace('02:00:00', '03:00:00'));
      r = play(['sudo systemctl daemon-reload']);
      expect(flag('first-night')).toBe(true);
      expect(flag('second-night')).toBe(false);
      expect(r).toMatch(/03:00[\s\u202f]*:/);
      // The flag checked but never taken away: processed several times.
      r = edit('nano /opt/batch/run-night.sh', (t) => t.replace('#!/bin/sh', '#!/bin/sh\ntest -f /srv/drop/contrib.ebc.done || exit 0'));
      edit('sudo nano /etc/systemd/system/night-batch.timer', (t) => t.replace('*-*-* 03:00:00', '*-*-* 02..06:00/10'));
      r = play(['sudo systemctl daemon-reload']);
      expect(r.match(/, (return code|code retour) 0\./g)!.length).toBeGreaterThan(2);
      // Taken away, but the final echo hides the return code 8.
      r = edit('nano /opt/batch/run-night.sh', (t) => t.replace('test -f /srv/drop/contrib.ebc.done || exit 0', 'test -f /srv/drop/contrib.ebc.done || exit 0\nrm /srv/drop/contrib.ebc.done'));
      expect(r).toContain('03:30');
      expect(flag('second-night')).toBe(false);
      expect(c.finished).not.toContain('late-file');
    });
  });
