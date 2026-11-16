// The Old Sun: moving the seed library's catalogue off a Solaris 10 box.
// Replayed with the console, in every language.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';

const ERASER = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('old-sun')])];
const MDP = 'seed-2029';

for (const language of LANGUAGES)
  describe(`The Old Sun — ${language}`, () => {
    const fr = language === 'fr';
    const L = (line: string) => inLanguage(translator(language), line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...ERASER, ...finished] });
      const one = (l: string) => {
        let output = c.execute(machinesInLanguage(c.t, L(l))) ?? '';
        if (c.shell.waiting) output += '\n' + (c.execute(machinesInLanguage(c.t, MDP)) ?? '');
        return output;
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        one(command);
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      play(['ssh herbarium', 'yes']);
      // The chapter's events are the main machine's, even while on greenhouse.
      return { c, play, edit, flag: (id: string) => ((c.shell as unknown as { principal: typeof c.shell }).principal ?? c.shell).flags.has(id) };
    };

    // ——— Chapter 1: "Read Before Touching" ———
    const NOTES = `# Migration
svc:/application/database/postgresql_84:default_64bit
/var/postgres/8.4/data_64 on data/postgres
seeds, PostgreSQL 8.4, LATIN1
data/postgres@before-migration`;

    it('chapter 1 — solution: SMF, ZFS, the database, a snapshot, the notes', () => {
      const { c, play, edit, flag } = part();
      expect(play(['uname -a'])).toContain('SunOS');
      expect(play(['top'])).toContain('top: not found');
      expect(play(['svcs'])).toContain('postgresql_84');
      expect(play(['svcs -x'])).toContain('sendmail');
      expect(play(['svcprop -p postgresql_84/data postgresql_84:default_64bit'])).toContain('/var/postgres/8.4/data_64');
      expect(play(['zfs list'])).toContain('data/postgres');
      expect(play(['sudo -u postgres psql -l'])).toContain('LATIN1');
      expect(flag('encoding')).toBe(true);
      play(['sudo zfs snapshot data/postgres@before-migration']);
      expect(flag('snapshot')).toBe(true);
      expect(c.finished).not.toContain('read-first');
      const end = edit('nano migration.md', () => NOTES);
      contains(end, 'Bravo');
      expect(c.finished).toContain('read-first');
    });

    it('chapter 1 — false leads: the old grep, ps aux, the notes without a snapshot', () => {
      const { c, play, edit } = part();
      expect(play(['svcs | grep -q postgres'])).toContain('grep: illegal option -- q');
      expect(play(['svcs | /usr/xpg4/bin/grep -c postgres'])).toContain('1');
      expect(play(['ps aux'])).toContain('usage: ps');
      expect(play(['/usr/ucb/ps aux'])).toContain('postgres');
      edit('nano migration.md', () => NOTES);
      expect(c.finished).not.toContain('read-first');
    });

    // ——— Chapter 2: "Bytes in the Wrong Order" ———
    it('chapter 2 — solution: the tar won\'t start, a dump does, accents intact', () => {
      const { c, play, flag } = part(['read-first']);
      // Odette's way: the data files.
      play(['scp /export/backup/pgdata-weekly.tar greenhouse:', 'yes', 'ssh greenhouse', 'tar -xf pgdata-weekly.tar']);
      expect(play(['/usr/lib/postgresql/16/bin/pg_ctl -D data_64 start'])).toContain('database files are incompatible with server');
      expect(flag('incompatible')).toBe(true);
      play(['exit', 'sudo svcadm disable seed-catalogue']);
      expect(flag('stopped')).toBe(true);
      play(['sudo -u postgres pg_dump seeds > seeds.sql']);
      expect(play(['file seeds.sql'])).toContain('ISO-8859 text');
      play(['scp seeds.sql greenhouse:', 'ssh greenhouse']);
      expect(play(['grep Crim seeds.sql'])).toContain('�');
      play(['sudo -u postgres createdb -O catalogue seeds', 'sudo -u postgres psql -d seeds -f seeds.sql']);
      const names = play(['sudo -u postgres psql -d seeds -c "SELECT name FROM varieties"']);
      expect(names).toContain('Noire de Crimée');
      expect(c.finished).toContain('byte-order');
    });

    it('chapter 2 — false lead: iconv but the dump still says LATIN1 (double conversion)', () => {
      const { c, play, flag } = part(['read-first']);
      play(['sudo svcadm disable seed-catalogue', 'sudo -u postgres pg_dump seeds > seeds.sql', 'scp seeds.sql greenhouse:', 'yes', 'ssh greenhouse']);
      play(['iconv -f LATIN1 -t UTF-8 seeds.sql > seeds-utf8.sql']);
      expect(play(['file seeds-utf8.sql'])).toContain('UTF-8');
      play(['sudo -u postgres createdb -O catalogue seeds', 'sudo -u postgres psql -d seeds -f seeds-utf8.sql']);
      expect(flag('mojibake')).toBe(true);
      expect(c.finished).not.toContain('byte-order');
      // Start again with the original dump, untouched.
      play(['sudo -u postgres dropdb seeds', 'sudo -u postgres createdb -O catalogue seeds', 'sudo -u postgres psql -d seeds -f seeds.sql']);
      expect(c.finished).toContain('byte-order');
    });

    it('chapter 2 — false lead: dumped while the catalogue still writes', () => {
      const { c, play, flag } = part(['read-first']);
      play(['sudo -u postgres pg_dump seeds > seeds.sql', 'scp seeds.sql greenhouse:', 'yes', 'ls', 'pwd']);
      play(['ssh greenhouse', 'sudo -u postgres createdb -O catalogue seeds', 'sudo -u postgres psql -d seeds -f seeds.sql']);
      expect(flag('missing-rows')).toBe(true);
      expect(c.finished).not.toContain('byte-order');
    });

    // ——— Chapter 3: "Trust, Then Switch" ———
    it('chapter 3 — solution: counted, pointed at greenhouse, the old base frozen', () => {
      const { c, play, edit, flag } = part(['read-first', 'byte-order']);
      play(['ssh greenhouse', 'yes']);
      expect(play(['sudo -u postgres psql -d seeds -c "SELECT count(*) FROM lendings"'])).toContain('14');
      expect(flag('counted')).toBe(true);
      play(['exit']);
      expect(play(['sudo -u postgres psql -d seeds -c "SELECT count(*) FROM lendings"'])).toContain('14');
      edit('sudo nano /etc/opt/seed-catalogue/catalogue.ini', (t) => t.replace('db_host = localhost', 'db_host = greenhouse.internal'));
      play(['sudo svcadm enable seed-catalogue']);
      expect(flag('online')).toBe(true);
      expect(c.finished).not.toContain('switch-over');
      play(['sudo -u postgres psql -c "ALTER DATABASE seeds SET default_transaction_read_only = on"']);
      expect(c.finished).toContain('switch-over');
      // New lendings go to greenhouse; the old base refuses writes.
      expect(play(['sudo -u postgres psql -d seeds -c "DELETE FROM lendings WHERE id = 1"'])).toContain('read-only transaction');
    });

    it('chapter 3 — false lead: restarted without changing the configuration', () => {
      const { c, play, flag } = part(['read-first', 'byte-order']);
      play(['sudo svcadm enable seed-catalogue']);
      expect(flag('still-old')).toBe(true);
      play(['sudo svcadm disable postgresql_84:default_64bit']);
      expect(c.finished).not.toContain('switch-over');
    });
  });
