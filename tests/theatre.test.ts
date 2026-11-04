// The Theatre: PostgreSQL in production. Each chapter is replayed to the
// end, with another solution and false leads, in each language; the expected
// texts are checked in French. Also: the server model (settings read and
// applied on reload or restart, the connection limit, EXPLAIN's plans).

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { readDuration, setting, server } from '../src/engine/pg-server';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const MDP = 'curtain-2028';
const PG = (sql: string, base = '') => `sudo -u postgres psql ${base ? `-d ${base} ` : ''}-c "${sql}"`;

describe('The PostgreSQL server model', () => {
  it('durations like PostgreSQL, settings applied on reload or restart', () => {
    expect(readDuration('1min')).toBe(60_000);
    expect(readDuration('30s')).toBe(30_000);
    expect(readDuration('5000')).toBe(5000);
    expect(readDuration('soon')).toBeNull();
    const s = new Shell(chapter('too-many-clients'), 'en');
    const run = (l: string) => {
      const o = s.execute(l) ?? '';
      return s.waiting ? o + (s.execute(MDP) ?? '') : o;
    };
    expect(setting(s, 'max_connections')).toBe('20');
    s.execute('sudo nano /etc/postgresql/16/main/postgresql.conf');
    if (s.waiting) s.execute(MDP);
    s.saveEdition(s.edition!.text.replace('max_connections = 20', 'max_connections = 50'));
    s.quitEdition();
    run('sudo systemctl reload postgresql');
    // max_connections waits for a restart; a restart closes every connection.
    expect(setting(s, 'max_connections')).toBe('20');
    expect(server(s)!.backends.length).toBeGreaterThan(10);
    run('sudo systemctl restart postgresql');
    expect(setting(s, 'max_connections')).toBe('50');
    expect(server(s)!.backends.length).toBeLessThan(3);
  });
});

for (const language of LANGUAGES)
  describe(`The Theatre — ${language}`, () => {
    const fr = language === 'fr';
    const L = (line: string) => inLanguage(translator(language), machinesInLanguage(translator(language), line));
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    function part(id: string) {
      const s = new Shell(chapter(id), language);
      const one = (l: string) => {
        let output = s.execute(L(l)) ?? '';
        if (s.waiting) output += '\n' + (s.execute(machinesInLanguage(s.t, MDP)) ?? '');
        const errors = s.recoverErrors();
        return [output, ...errors].filter(Boolean).join('\n');
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        one(command);
        s.saveEdition(change(s.edition!.text));
        return s.quitEdition();
      };
      return { s, play, edit };
    }

    it('the machine is reached from the workstation', () => {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('theatre')] });
      c.execute(L('ssh theatre'));
      c.execute('yes');
      expect(c.remote?.shell.chapter.id).toBe('too-many-clients');
    });

    it('chapter 1 — solution: the refusal, pg_stat_activity, ALTER SYSTEM and pg_reload_conf', () => {
      const { s, play } = part('too-many-clients');
      let all = play(['cat message_from_camille.txt', 'curl -i http://localhost:3000/', 'journalctl -u boxoffice.service']);
      expect(all).toContain('HTTP/1.1 500 Internal Server Error');
      expect(all).toContain('error: remaining connection slots are reserved for roles with the SUPERUSER attribute');
      contains(all, 'sudo -u postgres psql');
      all = play([PG('SELECT pid, usename, state, state_change, query FROM pg_stat_activity'), PG('SHOW max_connections')]);
      expect(all).toMatch(/30140 \| boxoffice \| idle in transaction \| 2028-02-21 10:00:12/);
      expect(all).toMatch(/max_connections \n-+\n +20 /);
      contains(all, 'sans COMMIT ni ROLLBACK');
      expect(s.finished).toBe(false);
      all = play([PG("ALTER SYSTEM SET idle_in_transaction_session_timeout = '1min'"), PG('SELECT pg_reload_conf()'), PG('SHOW idle_in_transaction_session_timeout'), 'curl -i http://localhost:3000/']);
      expect(all).toContain('ALTER SYSTEM');
      expect(all).toContain(' 1min ');
      expect(all).toContain('HTTP/1.1 200 OK');
      contains(all, 'Tu as terminé le chapitre');
      contains(all, 'LES OUTILS');
      expect(s.finished).toBe(true);
    });

    it('chapter 1 — another way: postgresql.conf and systemctl reload', () => {
      const { s, play, edit } = part('too-many-clients');
      let all = edit('sudo nano /etc/postgresql/16/main/postgresql.conf', (t) => t.replace(/#idle_in_transaction_session_timeout = 0.*$/m, "idle_in_transaction_session_timeout = '2min'"));
      all += play(['ls']);
      contains(all, "ne l'a pas encore lu");
      expect(s.finished).toBe(false);
      play(['sudo systemctl reload postgresql']);
      expect(s.finished).toBe(true);
    });

    it('chapter 1 — false leads: psql as yourself, terminate by hand, more connections', () => {
      const { s, play, edit } = part('too-many-clients');
      let all = play(['psql -d boxoffice -c "SELECT 1"']);
      expect(all).toContain('FATAL:  role');
      all = play([PG("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction'"), PG("SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction'")]);
      expect(all).toMatch(/pg_terminate_backend \n-+\n t /);
      contains(all, 'premiers secours');
      expect(s.finished).toBe(false);
      all = edit('sudo nano /etc/postgresql/16/main/postgresql.conf', (t) => t.replace('max_connections = 20', 'max_connections = 60'));
      all += play(['sudo systemctl reload postgresql', PG('SHOW max_connections')]);
      contains(all, 'redémarrage');
      all = play(['sudo systemctl restart postgresql', 'curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/']);
      expect(all).toContain('200');
      contains(all, 'la fuite est toujours là');
      expect(s.finished).toBe(false);
      all = play([PG("ALTER SYSTEM SET idle_in_transaction_session_timeout = '1h'"), PG('SELECT pg_reload_conf()')]);
      contains(all, 'Quelques minutes au plus');
      play([PG("ALTER SYSTEM SET idle_in_transaction_session_timeout = '30s'"), PG('SELECT pg_reload_conf()')]);
      expect(s.finished).toBe(true);
    });

    it('chapter 2 — solution: the slow query, EXPLAIN ANALYZE, CREATE INDEX', () => {
      const { s, play } = part('slow-query');
      let all = play(['cat message_from_camille.txt', "curl -s -o /dev/null -w '%{time_total}\\n' http://localhost:3000/shows/42/seats", 'journalctl -u boxoffice.service', 'sudo tail -n 2 /var/log/postgresql/postgresql-16-main.log']);
      expect(all).toContain('4.812000');
      expect(all).toContain('slow query (4812 ms): SELECT seat, status FROM bookings WHERE show_id = 42');
      expect(all).toContain('LOG:  duration: 4812.331 ms  statement: SELECT seat, status FROM bookings WHERE show_id = 42');
      contains(all, 'log_min_duration_statement');
      all = play([PG('EXPLAIN ANALYZE SELECT seat, status FROM bookings WHERE show_id = 42', 'boxoffice'), PG('SELECT count(*) FROM bookings', 'boxoffice')]);
      expect(all).toContain('->  Parallel Seq Scan on bookings');
      expect(all).toContain('Rows Removed by Filter: 159873');
      expect(all).toContain(' 480000 ');
      contains(all, 'lit toute la table');
      expect(s.finished).toBe(false);
      all = play([PG('CREATE INDEX ON bookings (show_id)', 'boxoffice'), PG('EXPLAIN SELECT seat, status FROM bookings WHERE show_id = 42', 'boxoffice'), PG('\\d bookings', 'boxoffice'), "curl -s -o /dev/null -w '%{time_total}\\n' http://localhost:3000/shows/42/seats"]);
      expect(all).toContain('CREATE INDEX');
      expect(all).toContain('Index Scan using bookings_show_id_idx on bookings');
      expect(all).toContain('"bookings_show_id_idx" btree (show_id)');
      expect(all).toContain('0.012000');
      contains(all, "L'INDEX");
      expect(s.finished).toBe(true);
    });

    it('chapter 2 — false leads: VACUUM ANALYZE, an index on the wrong column; another way: a named index', () => {
      const { s, play } = part('slow-query');
      let all = play([PG('VACUUM ANALYZE bookings', 'boxoffice')]);
      expect(all).toContain('VACUUM');
      contains(all, 'statistiques');
      all = play([PG('CREATE INDEX bookings_seat_idx ON bookings (seat)', 'boxoffice'), PG('EXPLAIN SELECT seat, status FROM bookings WHERE show_id = 42', 'boxoffice')]);
      expect(all).toContain('Parallel Seq Scan on bookings');
      contains(all, 'pas sur la colonne de la condition');
      expect(s.finished).toBe(false);
      all = play([PG('CREATE INDEX CONCURRENTLY seats_by_show ON bookings (show_id)', 'boxoffice'), PG('\\di', 'boxoffice')]);
      expect(all).toContain('seats_by_show');
      expect(s.finished).toBe(true);
    });

    it('chapter 3 — solution: a read-only role, the migration, default privileges, the tool', () => {
      const { s, play, edit } = part('read-only');
      let all = play(['cat message_from_camille.txt', 'sudo cat /etc/ticket-stats/config.env', PG('\\du', 'boxoffice'), PG('\\dp', 'boxoffice')]);
      expect(all).toContain('DATABASE_URL=postgres://boxoffice:Kh7-pR2v-boxoffice@localhost/boxoffice');
      expect(all).toContain(' public | bookings | table |');
      contains(all, 'propriétaire de\ntoutes les tables'.replace('\n', ' ').slice(0, 14));
      all = play([PG("CREATE ROLE stats LOGIN PASSWORD 'r3ad-only'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO stats", 'boxoffice')]);
      expect(all).toContain('CREATE ROLE\nGRANT');
      contains(all, 'table donations');
      all = play([PG('SET ROLE stats; SELECT count(*) FROM bookings', 'boxoffice'), PG("SET ROLE stats; UPDATE seats SET status = 'sold'", 'boxoffice'), PG('SET ROLE stats; SELECT count(*) FROM donations', 'boxoffice')]);
      expect(all).toMatch(/count \n-+\n +12 /);
      expect(all).toContain('ERROR:  permission denied for table seats');
      expect(all).toContain('ERROR:  permission denied for table donations');
      all = play([PG('ALTER DEFAULT PRIVILEGES FOR ROLE boxoffice IN SCHEMA public GRANT SELECT ON TABLES TO stats; GRANT SELECT ON donations TO stats', 'boxoffice'), PG('\\ddp', 'boxoffice'), PG('\\dp donations', 'boxoffice')]);
      expect(all).toContain('stats=r/boxoffice');
      expect(all).toContain('boxoffice=arwdDxt/boxoffice+');
      contains(all, 'DATABASE_URL');
      expect(s.finished).toBe(false);
      all = edit('sudo nano /etc/ticket-stats/config.env', (t) => t.replace('boxoffice:Kh7-pR2v-boxoffice', 'stats:r3ad-only'));
      all += play(['sudo systemctl restart ticket-stats', 'systemctl status ticket-stats']);
      expect(all).toContain('Active: active (running)');
      contains(all, 'RÔLES ET PRIVILÈGES');
      expect(s.finished).toBe(true);
    });

    it('chapter 3 — false leads: GRANT ALL, superuser, a member of boxoffice, defaults without FOR ROLE, a wrong password', () => {
      const { s, play, edit } = part('read-only');
      let all = play([PG("CREATE USER stats PASSWORD 'x'; GRANT ALL ON ALL TABLES IN SCHEMA public TO stats", 'boxoffice')]);
      contains(all, 'peut aussi modifier');
      all = play([PG('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM stats; ALTER ROLE stats SUPERUSER', 'boxoffice')]);
      contains(all, 'passe outre');
      all = play([PG('ALTER ROLE stats NOSUPERUSER; GRANT boxoffice TO stats', 'boxoffice')]);
      contains(all, 'hérite de tous les droits');
      all = play([PG('REVOKE boxoffice FROM stats; GRANT SELECT ON ALL TABLES IN SCHEMA public TO stats; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO stats', 'boxoffice')]);
      contains(all, 'sans FOR ROLE');
      all = edit('sudo nano /etc/ticket-stats/config.env', (t) => t.replace('boxoffice:Kh7-pR2v-boxoffice', 'stats:wrong'));
      all += play(['sudo systemctl restart ticket-stats', 'journalctl -u ticket-stats.service']);
      expect(all).toContain('FATAL:  password authentication failed for user "stats"');
      contains(all, 'ticket-stats n');
      expect(s.finished).toBe(false);
      play([PG("ALTER ROLE stats PASSWORD 'wrong'; ALTER DEFAULT PRIVILEGES FOR ROLE boxoffice IN SCHEMA public GRANT SELECT ON TABLES TO stats", 'boxoffice'), 'sudo systemctl restart ticket-stats']);
      expect(s.finished).toBe(true);
    });

    it('chapter 4 — solution: the dead primary, the standby, pg_ctlcluster promote, the app moved', () => {
      const { s, play, edit } = part('failover');
      let all = play(['cat message_from_camille.txt', 'curl -i http://localhost:3000/', 'journalctl -u boxoffice.service', 'pg_isready -h stage.internal', 'pg_lsclusters']);
      expect(all).toContain('Error: connect EHOSTUNREACH 192.0.2.29:5432');
      expect(all).toContain('stage.internal:5432 - no response');
      expect(all).toContain('16  main    5432 online,recovery postgres');
      contains(all, 'réplica (standby)');
      all = play([PG('SELECT pg_is_in_recovery()'), PG('SELECT pg_last_xact_replay_timestamp()'), 'sudo tail -n 2 /var/log/postgresql/postgresql-16-main.log']);
      expect(all).toMatch(/pg_is_in_recovery \n-+\n t /);
      expect(all).toContain('2028-04-02 06:47:14.382412+00');
      expect(all).toContain('could not connect to the primary server');
      contains(all, 'presque rien n');
      all = play(['sudo pg_ctlcluster 16 main promote', 'pg_lsclusters']);
      expect(all).toContain('server promoted');
      expect(all).toContain('16  main    5432 online          postgres');
      contains(all, 'Reste à y amener');
      expect(s.finished).toBe(false);
      all = edit('sudo nano /srv/boxoffice/.env', (t) => t.replace('@stage.internal/', '@localhost/'));
      all += play(['ls']);
      contains(all, 'le lit à');
      all = play(['sudo systemctl restart boxoffice', 'curl -i http://localhost:3000/']);
      expect(all).toContain('HTTP/1.1 200 OK');
      contains(all, 'LES ÉTAPES D');
      expect(s.finished).toBe(true);
    });

    it('chapter 4 — false leads: a restart, the app on the standby; another way: pg_promote() and 127.0.0.1', () => {
      const { s, play, edit } = part('failover');
      let all = play(['sudo systemctl restart postgresql', 'pg_lsclusters']);
      expect(all).toContain('online,recovery');
      contains(all, 'toujours réplica');
      edit('sudo nano /srv/boxoffice/.env', (t) => t.replace('@stage.internal/', '@127.0.0.1/'));
      all = play(['sudo systemctl restart boxoffice', 'curl -s http://localhost:3000/ > /dev/null', 'journalctl -u boxoffice.service']);
      expect(all).toContain('error: cannot execute INSERT in a read-only transaction');
      contains(all, 'Promeus-le');
      all = play([PG("CREATE INDEX ON seats (seat)", 'boxoffice')]);
      expect(all).toContain('ERROR:  cannot execute CREATE INDEX in a read-only transaction');
      expect(s.finished).toBe(false);
      all = play([PG('SELECT pg_promote()')]);
      expect(all).toMatch(/pg_promote \n-+\n t /);
      expect(s.finished).toBe(true);
    });
  });
