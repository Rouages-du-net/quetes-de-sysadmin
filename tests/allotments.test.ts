// The Allotments: running a MariaDB database. Each chapter is replayed to the
// end from the workstation (ssh trowel), with another solution and false
// leads, in each language; the expected texts are checked in French. Also:
// the engine (mariadb.ts, mariadb-sql.ts, the client programs) and the error
// explainer on MariaDB's errors.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { Shell } from '../src/engine/shell';
import { explain } from '../src/engine/explainer';
import { maria, hostMatches, nativeHash, sortedAccounts, newServer, socketAuth, passwordAuth, fileValue, startErrors } from '../src/engine/mariadb';
import { statements, readValues } from '../src/engine/mariadb-sql';

const PASSWORD = 'compost-heap-17';
const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const SERVER_CNF = '/etc/mysql/mariadb.conf.d/50-server.cnf';

describe('The Allotments: the engine', () => {
  it('hashes passwords like mysql_native_password, matches hosts, orders accounts like MariaDB', () => {
    expect(nativeHash('password')).toBe('*2470C0C06DEE42FD1618BB99005ADCA2EC9D1E19');
    expect(nativeHash('')).toBe('');
    expect(hostMatches('%', '203.0.113.77')).toBe(true);
    expect(hostMatches('198.51.100.%', '198.51.100.134')).toBe(true);
    expect(hostMatches('198.51.100.%', '203.0.113.77')).toBe(false);
    expect(hostMatches('198.51.100.0/255.255.255.0', '198.51.100.9')).toBe(true);
    expect(hostMatches('localhost', 'localhost')).toBe(true);
    expect(hostMatches('%', 'localhost')).toBe(false);
    // The classic trap: the anonymous ''@'localhost' is more specific than 'app'@'%'.
    const s = newServer({
      databases: {},
      accounts: [
        { user: 'app', host: '%', auth: passwordAuth('x'), global: [] },
        { user: '', host: 'localhost', auth: [{ plugin: 'mysql_native_password', hash: '' }], global: [] },
        { user: 'root', host: 'localhost', auth: socketAuth(), global: [] },
      ],
    });
    expect(sortedAccounts(s).map((a) => `${a.user}@${a.host}`)).toEqual(['root@localhost', '@localhost', 'app@%']);
  });

  it('splits scripts into statements and reads values', () => {
    expect(statements("SELECT 1;\n-- a comment\nINSERT INTO t VALUES ('a;b', 'it\\'s');\nSELECT 2").map((x) => [x.sql, x.line])).toEqual([
      ['SELECT 1', 1],
      ["INSERT INTO t VALUES ('a;b', 'it\\'s')", 3],
      ['SELECT 2', 4],
    ]);
    expect(readValues("12, 'O''Brien', NULL, 'x\\'y'", 0)).toEqual(['12', "O'Brien", null, "x'y"]);
  });

  it('reads my.cnf and its directories like the server; an unknown variable stops it', () => {
    const sh = new Shell(chapter('sleeping-connections'), 'en');
    expect(fileValue(sh, 'bind-address')).toBe('198.51.100.131');
    expect(fileValue(sh, 'skip_name_resolve')).toBe('1');
    expect(startErrors(sh)).toBeNull();
    const n = sh.find(SERVER_CNF) as { content: string };
    n.content = n.content.replace('[embedded]', 'max_conections = 500\n[embedded]');
    expect(startErrors(sh)).toEqual(["[ERROR] /usr/sbin/mariadbd: unknown variable 'max_conections=500'", '[ERROR] Aborting']);
    n.content = n.content.replace('max_conections = 500', 'loose_max_conections = 500').replace('bind-address            = 198.51.100.131', 'bind-address            = 192.0.2.99');
    expect(startErrors(sh)?.[0]).toContain('Cannot assign requested address');
  });
});

for (const language of LANGUAGES)
  describe(`The Allotments — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    // SQL between double quotes keeps its English table names.
    const L = (line: string) =>
      line
        .split(/("[^"]*")/)
        .map((part) => (part.startsWith('"') ? part : inLanguage(t, machinesInLanguage(t, part))))
        .join('');
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    function play(finished: string[]) {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('allotments'), ...finished] });
      const one = (l: string) => {
        const o = c.execute(L(l));
        let out = typeof o === 'string' ? o : '';
        if (c.shell.waiting) {
          const p = c.execute(machinesInLanguage(t, inLanguage(t, PASSWORD)));
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        if (c.shell.question && /continue connecting/.test(c.shell.question.prompt)) {
          const p = c.execute('yes');
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        return out;
      };
      const log: string[] = [];
      const run = (...lines: string[]) => {
        const out = lines.map(one).join('\n');
        log.push(out);
        return out;
      };
      const edit = (command: string, change: (text: string) => string) => {
        const before = one(command);
        c.shell.saveEdition(change(c.shell.edition!.text));
        const out = `${before}\n${c.shell.quitEdition() ?? ''}`;
        log.push(out);
        return out;
      };
      run('ssh trowel');
      return { c, run, edit, everything: () => log.join('\n'), finished: () => c.remote!.shell.finished };
    }

    // ——— Chapter 1: Sleeping Connections ———

    const timeout300 = (x: string) => x.replace('innodb_buffer_pool_size = 2G', 'innodb_buffer_pool_size = 2G\nwait_timeout = 300');

    it('chapter 1 — solution: the sleeping connections, wait_timeout now and in the file, the old sessions killed, the slow query and its index', () => {
      const { run, edit, finished, everything } = play([]);
      let all = run('cat message_from_halima.txt', 'cat note_from_lwazi.txt', 'sudo mariadb -e "SHOW PROCESSLIST" | head -5');
      expect(all).toMatch(/^Id\tUser\tHost\tdb\tCommand\tTime\tState\tInfo\tProgress$/m);
      expect(all).toMatch(/plotline\t198\.51\.100\.133:\d+\tplots\tSleep\t\d+/);
      contains(all, 'presque toutes les connexions sont en');
      all = run('sudo mariadb -e "SHOW VARIABLES LIKE \'%timeout%\'"', 'sudo mariadb -e "SET GLOBAL wait_timeout = 300"', 'sudo mariadb -e "SHOW PROCESSLIST" | grep -c Sleep');
      expect(all).toContain('| wait_timeout        | 28800 |');
      contains(all, 'chaque session existante garde le wait_timeout');
      all = run('sudo mariadb -N -e "SELECT id FROM information_schema.PROCESSLIST WHERE command = \'Sleep\' AND user = \'plotline\'" | sudo xargs -n1 mariadb-admin kill', 'sudo mariadb-admin status');
      expect(all).toMatch(/^Uptime: \d+  Threads: \d  Questions: \d+  Slow queries: \d+  Opens: 33/m);
      contains(all, 'Les vieilles connexions endormies sont parties');
      all = edit(`sudo nano ${SERVER_CNF}`, timeout300);
      contains(all, 'le serveur le lira à chaque démarrage');
      all = run('sudo mariadb -e "SET GLOBAL slow_query_log = ON; SET GLOBAL long_query_time = 1"', 'sudo mariadb -e "SHOW VARIABLES LIKE \'slow_query_log_file\'"', 'sudo tail -n 8 /var/lib/mysql/*-slow.log');
      expect(all).toMatch(/# Query_time: 38\.\d+  Lock_time: 0\.000087  Rows_sent: 412  Rows_examined: 1834212/);
      expect(all).toContain('# User@Host: plotline[plotline] @  [198.51.100.133]');
      all = run('sudo mariadb plots -e "EXPLAIN SELECT * FROM bookings WHERE plot_id = 17 ORDER BY starts_on DESC"');
      expect(all).toContain('|  1 | SIMPLE      | bookings | ALL  | NULL          | NULL | NULL    | NULL | 1834212 | Using where; Using filesort |');
      contains(all, 'type ALL, key NULL, rows 1834212');
      all = run('sudo mariadb plots -e "CREATE INDEX idx_plot ON bookings (plot_id)"', 'sudo mariadb plots -e "EXPLAIN SELECT * FROM bookings WHERE plot_id = 17 ORDER BY starts_on DESC"');
      expect(all).toContain('| ref  | idx_plot      | idx_plot | 4       | const |  412 | Using filesort |');
      expect(finished()).toBe(true);
      contains(everything(), 'Vous avez terminé Connexions endormies.');
    });

    it('chapter 1 — false leads: a restart alone, max_connections at 10000, an index on the wrong column; another solution: the monitor, the file, a restart', () => {
      const { run, edit, finished } = play([]);
      let all = run('sudo systemctl restart mariadb', 'sudo mariadb -e "SHOW PROCESSLIST" | wc -l');
      contains(all, 'Le redémarrage a fermé toutes les connexions');
      all = run('sudo mariadb -e "SET GLOBAL max_connections = 10000"');
      contains(all, 'ne fait que reculer le mur');
      all = run('sudo mariadb plots -e "CREATE INDEX idx_start ON bookings (starts_on)"');
      contains(all, 'Cet index commence par une autre colonne');
      // The interactive monitor: USE, a composite index over two lines, \G, exit.
      all = run('sudo mariadb', 'USE plots', 'ALTER TABLE bookings', 'ADD INDEX idx_plot_start (plot_id, starts_on);', 'SHOW INDEX FROM bookings\\G', 'exit');
      expect(all).toContain('Welcome to the MariaDB monitor.  Commands end with ; or \\g.');
      expect(all).toContain('Database changed');
      expect(all).toMatch(/Query OK, 0 rows affected \(\d+\.\d{3} sec\)\nRecords: 0  Duplicates: 0  Warnings: 0/);
      expect(all).toContain('     Key_name: idx_plot_start');
      expect(all).toContain('Bye');
      expect(finished()).toBe(false);
      // The file, then a restart (through the mysql alias): the old sessions go, max_connections back to 151, the new sessions get 300 s.
      edit(`sudo nano ${SERVER_CNF}`, timeout300);
      all = run('sudo systemctl restart mysql', 'sudo journalctl -u mariadb -n 5');
      expect(all).toContain('[Note] /usr/sbin/mariadbd: ready for connections.');
      expect(finished()).toBe(true);
    });

    // ——— Chapter 2: Least Privilege ———

    const APP = "'app'@'198.51.100.134'";
    const appEnv = (password: string) => (x: string) => x.replace('DB_USER=root', 'DB_USER=app').replace(/DB_PASSWORD=.*/, `DB_PASSWORD=${password}`);

    it('chapter 2 — solution: an account for the app, the app switched, root local, the leftovers removed, bind-address', () => {
      const { run, edit, finished, everything } = play(['sleeping-connections']);
      let all = run('cat scan_from_selin.txt', 'sudo ss -tlnp');
      expect(all).toContain('0.0.0.0:3306');
      contains(all, 'MariaDB répond à tout internet');
      all = run('sudo mariadb -e "SELECT user, host, plugin FROM mysql.user"', 'sudo mariadb -e "SHOW GRANTS FOR \'root\'@\'%\'"', 'mariadb -e "SHOW DATABASES"');
      expect(all).toContain("GRANT ALL PRIVILEGES ON *.* TO `root`@`%` IDENTIFIED BY PASSWORD '*");
      // As you, the client connects as the anonymous ''@'localhost', which sees test.
      expect(all).toMatch(/\| test\s+\|/);
      contains(all, 'un compte, c\'est un nom ET');
      all = run(`sudo mariadb -e "CREATE USER ${APP} IDENTIFIED BY 'Tr0wel-app-2031'; GRANT SELECT, INSERT, UPDATE, DELETE ON plots.* TO ${APP}"`, `sudo mariadb -e "SHOW GRANTS FOR ${APP}"`);
      expect(all).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON `plots`.* TO `app`@`198.51.100.134`');
      contains(all, 'Ce compte va à l\'appli');
      run('ssh barrow', 'cat /srv/plotline/.env');
      edit('sudo nano /srv/plotline/.env', appEnv('Tr0wel-app-2031'));
      all = run('sudo systemctl restart plotline', 'sudo tail -n 2 /var/log/plotline/app.log', 'mariadb -h 198.51.100.131 -u app -pTr0wel-app-2031 plots -e "SELECT count(*) FROM members"', 'exit');
      expect(all).toMatch(/INFO plotline\.db: connected to 198\.51\.100\.131:3306 as app/);
      expect(all).toMatch(/\|\s+140 \|/);
      contains(all, 'Plotline se connecte maintenant avec son propre compte');
      all = run('sudo mariadb -e "DROP USER \'root\'@\'%\'"');
      contains(all, 'root ne sert plus qu\'à cette machine');
      all = run('sudo mariadb-secure-installation', '', 'n', 'n', 'y', 'y', 'y', 'y');
      expect(all).toContain(' - Dropping test database...');
      expect(all).toContain('Thanks for using MariaDB!');
      expect(finished()).toBe(false);
      all = run('sudo mariadb -e "DROP USER \'plotline\'@\'198.51.100.133\'"');
      contains(all, 'Plus de compte anonyme');
      edit(`sudo nano ${SERVER_CNF}`, (x) => x.replace('bind-address            = 0.0.0.0', 'bind-address            = 198.51.100.131'));
      all = run('sudo systemctl restart mariadb', 'sudo ss -tlnp');
      expect(all).toContain('198.51.100.131:3306');
      expect(finished()).toBe(true);
      contains(everything(), 'Vous avez terminé Le moindre privilège.');
    });

    it('chapter 2 — false leads: ALL ON *.* from anywhere, the .env not reloaded, a wrong password, 127.0.0.1, root dropped; another solution: ufw and the cleanup by hand', () => {
      const { run, edit, finished } = play(['sleeping-connections']);
      let all = run('sudo mariadb -e "GRANT ALL ON *.* TO \'app\'@\'%\' IDENTIFIED BY \'Tr0wel-app-2031\'"');
      contains(all, 'ON *.* donne à ce compte des droits');
      contains(all, "'%' comme hôte veut dire");
      run('sudo mariadb -e "DROP USER \'app\'@\'%\'"', `sudo mariadb -e "CREATE USER 'app'@'198.51.100.%' IDENTIFIED BY 'Tr0wel-app-2031'"`, `sudo mariadb -e "GRANT SELECT, INSERT, UPDATE, DELETE ON plots.* TO 'app'@'198.51.100.%'"`);
      run('ssh barrow');
      all = edit('sudo nano /srv/plotline/.env', appEnv('wrong-password'));
      all += run('ls /srv/plotline');
      contains(all, 'elle a lu ses réglages à son démarrage');
      all = run('sudo systemctl restart plotline', 'sudo tail -n 1 /var/log/plotline/app.log');
      expect(all).toContain("ERROR plotline.db: (1045, \"Access denied for user 'app'@'198.51.100.134' (using password: YES)\")");
      contains(all, 'L\'appli ne peut pas travailler avec ses nouveaux réglages');
      edit('sudo nano /srv/plotline/.env', (x) => x.replace('DB_PASSWORD=wrong-password', 'DB_PASSWORD=Tr0wel-app-2031'));
      run('sudo systemctl restart plotline', 'exit');
      // 127.0.0.1: barrow is cut off.
      edit(`sudo nano ${SERVER_CNF}`, (x) => x.replace('bind-address            = 0.0.0.0', 'bind-address            = 127.0.0.1'));
      all = run('sudo systemctl restart mariadb', 'ls');
      contains(all, 'L\'appli ne joint plus le serveur');
      edit(`sudo nano ${SERVER_CNF}`, (x) => x.replace('bind-address            = 127.0.0.1', 'bind-address            = 0.0.0.0'));
      all = run('sudo systemctl restart mariadb', 'ls');
      contains(all, 'il écoute toujours sur toutes les adresses');
      // root@localhost dropped: mysql@localhost (Debian) lets you back in.
      // The anonymous ''@'localhost' still lets the client in, as nobody: CURRENT_USER() says so.
      all = run('sudo mariadb -e "DROP USER \'root\'@\'localhost\'"', 'sudo mariadb -N -e "SELECT CURRENT_USER()"');
      expect(all).toContain("| @localhost |");
      contains(all, 'Debian garde une deuxième porte');
      run('sudo -u mysql mariadb -e "CREATE USER \'root\'@\'localhost\' IDENTIFIED VIA unix_socket; GRANT ALL PRIVILEGES ON *.* TO \'root\'@\'localhost\' WITH GRANT OPTION"');
      all = run('sudo mariadb -e "SELECT CURRENT_USER()"');
      expect(all).toContain('root@localhost');
      // The firewall in front, MariaDB still on every address.
      run('sudo ufw allow 22/tcp', 'sudo ufw allow from 198.51.100.0/24 to any port 3306 proto tcp', 'sudo ufw enable', 'y');
      // The cleanup by hand: mysql.user is a view, mysql.db can be cleaned.
      all = run('sudo mariadb -e "DELETE FROM mysql.user WHERE user = \'\'"');
      expect(all).toContain('ERROR 1288 (HY000) at line 1: The target table user of the DELETE is not updatable');
      run("sudo mariadb -e \"DROP USER 'root'@'%', ''@'localhost', ''@'trowel', 'plotline'@'198.51.100.133'\"", 'sudo mariadb -e "DROP DATABASE test"');
      expect(finished()).toBe(false);
      run('sudo mariadb -e "DELETE FROM mysql.db WHERE Db LIKE \'test%\'; FLUSH PRIVILEGES"');
      expect(finished()).toBe(true);
    });

    // ——— Chapter 3: Broken Replica ———

    const CHECKSUMS = 'sudo mariadb -e "CHECKSUM TABLE plots.members, plots.plots, plots.waitlist, plots.bookings"';
    const ESI = "INSERT INTO waitlist (name, email, wants, added_on) VALUES ('Esi Boateng', 'esi.boateng@mail.example', 'half', '2031-05-31')";
    const readOnlyFile = (x: string) => x.replace('#read_only               = ON', 'read_only               = ON');
    const restore = "sudo sh -c 'mariadb restore_check < /var/backups/mariadb/plots-2031-06-02.sql'";

    it('chapter 3 — solution: the replica status, read_only, the stray row, replication restarted, compared, Esi on trowel, a consistent backup restored', () => {
      const { run, edit, finished, everything } = play(['sleeping-connections', 'least-privilege']);
      let all = run('cat message_from_moana.txt', 'ssh rake', 'sudo mariadb -e "SHOW REPLICA STATUS\\G"');
      expect(all).toContain('             Slave_SQL_Running: No');
      expect(all).toContain("Last_SQL_Error: Could not execute Write_rows_v1 event on table plots.waitlist; Duplicate entry '1043' for key 'PRIMARY', Error_code: 1062");
      expect(all).toContain('         Seconds_Behind_Master: NULL');
      contains(all, 'le thread SQL, qui l\'applique');
      all = run('sudo mariadb plots -e "SELECT * FROM waitlist WHERE id = 1043"', 'sudo journalctl -u mariadb -n 5');
      expect(all).toContain('| 1043 | Esi Boateng | esi.boateng@mail.example | half  | 2031-05-31 |');
      expect(all).toContain('[ERROR] Slave SQL: Could not execute Write_rows_v1 event');
      contains(all, 'une seule écriture faite dessus suffit');
      all = run('sudo mariadb -e "SET GLOBAL read_only = ON"');
      contains(all, 'read_only est actif');
      all = edit(`sudo nano ${SERVER_CNF}`, readOnlyFile);
      all += run(`grep read_only ${SERVER_CNF}`);
      contains(all, 'toujours actif après un redémarrage');
      all = run('sudo mariadb plots -e "DELETE FROM waitlist WHERE id = 1043"', 'sudo mariadb -e "START REPLICA"', 'sudo mariadb -e "SHOW REPLICA STATUS\\G" | grep -E "Running|Behind"');
      expect(all).toContain('             Slave_SQL_Running: Yes');
      expect(all).toContain('         Seconds_Behind_Master: 0');
      contains(all, 'rake a rattrapé les deux jours');
      all = run(CHECKSUMS, 'exit', CHECKSUMS);
      const sums = [...all.matchAll(/\| plots\.waitlist \| +(\d+) \|/g)].map((m) => m[1]);
      expect(sums.length).toBe(2);
      expect(sums[0]).toBe(sums[1]);
      contains(everything(), 'rake est de nouveau une copie exacte');
      all = run(`sudo mariadb plots -e "${ESI}"`, 'ssh rake');
      contains(all, 'Esi est sur la liste d\'attente, sur truelle');
      all = edit('sudo nano /usr/local/sbin/plots-backup', (x) => x.replace('mariadb-dump --skip-lock-tables plots', 'mariadb-dump --single-transaction plots'));
      all += run('grep mariadb-dump /usr/local/sbin/plots-backup');
      contains(all, 'Le script de la nuit fait maintenant son dump');
      all = run('sudo /usr/local/sbin/plots-backup', 'sudo head -n 3 /var/backups/mariadb/plots-2031-06-02.sql');
      expect(all).toContain('-- MariaDB dump 10.19-11.8.9-MariaDB, for debian-linux-gnu (x86_64)');
      contains(all, 'Un dump cohérent de rake');
      all = run('sudo mariadb -e "CREATE DATABASE restore_check"', restore, 'sudo mariadb -e "CHECKSUM TABLE restore_check.waitlist, plots.waitlist"');
      contains(all, 'cette sauvegarde est prouvée');
      expect(finished()).toBe(true);
      contains(everything(), 'Vous avez terminé Le réplica en panne.');
    });

    it('chapter 3 — false leads: the skip counter (twice), the servers differ, a locking dump, a dump without lock nor snapshot; another solution: the stray row replaced by hand', () => {
      const { c, run, edit, finished } = play(['sleeping-connections', 'least-privilege']);
      run('ssh rake');
      // The SQL thread stopped on its error: the counter can be set.
      let all = run('sudo mariadb -e "SET GLOBAL sql_slave_skip_counter = 1; START SLAVE"');
      contains(all, 'la ligne de Wairimu a été sautée');
      all = run('sudo mariadb -e "SET GLOBAL sql_slave_skip_counter = 1"');
      expect(all).toContain("ERROR 1198 (HY000) at line 1: This operation cannot be performed as you have a running slave ''; run STOP SLAVE '' first");
      all = run('sudo mariadb -e "STOP SLAVE; SET GLOBAL sql_slave_skip_counter = 1; START SLAVE"');
      contains(all, 'événements sautés maintenant');
      all = run(CHECKSUMS);
      contains(all, 'les sommes de contrôle diffèrent');
      // A dump with the default locks: the SQL thread waits behind it.
      all = run('sudo mariadb-dump plots > /tmp/locked.sql', 'sudo mariadb -e "SHOW SLAVE STATUS\\G" | grep Behind');
      contains(all, 'mariadb-dump a verrouillé les tables');
      all = run('sudo mysqldump --skip-lock-tables plots > /tmp/loose.sql');
      contains(all, 'Ce dump a lu chaque table à un moment différent');
      // Repair by hand: Esi's row out, Wairimu's in (read_only lets root write), the lost booking back.
      run('sudo mariadb -e "SET GLOBAL read_only = 1"');
      edit(`sudo nano ${SERVER_CNF}`, readOnlyFile);
      run('exit');
      all = run('sudo mariadb plots -B -N -e "SELECT * FROM waitlist WHERE id = 1043"', 'sudo mariadb -e "SHOW MASTER STATUS"');
      expect(all).toContain('1043\tWairimu Njoroge\twairimu.njoroge@mail.example\tfull\t2031-05-31');
      expect(all).toMatch(/mariadb-bin\.000127 +\| +\d+/);
      // The booking the second skip threw away (the event after the first skip's).
      const trowel = c.remote!.shell;
      const seq = maria(trowel.internals.get('rake')!).skipped[1];
      const id = String(maria(trowel).events.find((e) => e.seq === seq)!.row[0]);
      const lost = run(`sudo mariadb plots -B -N -e "SELECT * FROM bookings WHERE id = ${id}"`).trim().split('\t');
      expect(lost.length).toBe(5);
      run(`sudo mariadb plots -e "${ESI}"`, 'ssh rake');
      run(
        "sudo mariadb plots -e \"DELETE FROM waitlist WHERE id = 1043; INSERT INTO waitlist VALUES (1043, 'Wairimu Njoroge', 'wairimu.njoroge@mail.example', 'full', '2031-05-31')\"",
        `sudo mariadb plots -e "INSERT INTO bookings VALUES (${lost[0]}, ${lost[1]}, ${lost[2]}, '${lost[3]}', '${lost[4]}')"`,
      );
      all = run(CHECKSUMS);
      expect(finished()).toBe(false);
      edit('sudo nano /usr/local/sbin/plots-backup', (x) => x.replace('mariadb-dump --skip-lock-tables', 'mariadb-dump --single-transaction --skip-lock-tables'));
      run('sudo mariadb-dump --single-transaction -r /var/backups/mariadb/plots-check.sql plots', 'sudo mariadb-admin create restore_check', "sudo sh -c 'mysql restore_check < /var/backups/mariadb/plots-check.sql'");
      expect(finished()).toBe(true);
    });

    it('chapter 3 — a write refused once read_only is on, the replica caught up after a restart', () => {
      const { run } = play(['sleeping-connections', 'least-privilege']);
      run('ssh rake', 'sudo mariadb -e "SET GLOBAL read_only = ON"');
      // Moana's account, from the office, writes on rake no more.
      const all = run('sudo systemctl restart mariadb', 'sudo mariadb -e "SHOW REPLICA STATUS\\G" | grep -E "SQL_Running:|Last_SQL_Errno"', 'sudo mariadb -e "SELECT @@read_only"');
      // The restart reads the file (read_only still commented): off again; the SQL thread hits the same row.
      expect(all).toContain('Slave_SQL_Running: No');
      expect(all).toContain('Last_SQL_Errno: 1062');
      expect(all).toMatch(/\|\s+0 \|/);
    });
  });

describe('The Allotments: the error explainer', () => {
  function session(language: string) {
    const sh = new Shell(chapter('sleeping-connections'), language);
    const t = translator(language);
    const run = (line: string, who = 'you') => {
      sh.who = who;
      const before = sh.commandsInError;
      const last = sh.last;
      const output = sh.execute(inLanguage(t, line)) ?? '';
      const failed = sh.commandsInError > before;
      const errors = sh.last !== last ? sh.last.errors.filter((e) => e && output.includes(e)) : null;
      return explain({ failed, output, errors }, t);
    };
    return run;
  }

  for (const language of LANGUAGES)
    it(`${language}: reading the server explains nothing; MariaDB's errors are explained`, () => {
      const run = session(language);
      for (const line of ['mariadb -e "SHOW PROCESSLIST"', 'cat /etc/mysql/mariadb.conf.d/50-server.cnf', 'mariadb-admin status', 'journalctl -u mariadb'])
        expect(run(line, 'root'), line).toBeNull();
      expect(run('mariadb -u root -e "SELECT 1"')).toBe('db-access-denied');
      expect(run('mariadb -u plotline -pnope -h 198.51.100.131 -e "SELECT 1"')).toBe('db-access-denied');
      expect(run('mariadb -e "SELEC 1"', 'root')).toBe('db-syntax');
      run("mariadb -e \"CREATE USER 'probe'@'localhost' IDENTIFIED BY 'p'; GRANT INSERT ON plots.* TO 'probe'@'localhost'\"", 'root');
      run('mariadb -e "SET GLOBAL max_connections = 10"', 'root');
      expect(run('mariadb -u probe -pp -e "SELECT 1"')).toBe('db-too-many');
      // Even root's extra slot is taken now: a restart (max_connections back to the file's 151) frees the server.
      run('systemctl restart mariadb', 'root');
      run('mariadb -e "SET GLOBAL read_only = ON"', 'root');
      expect(run("mariadb -u probe -pp plots -e \"INSERT INTO waitlist (name, email, wants, added_on) VALUES ('x', 'x@mail.example', 'half', '2031-05-10')\"")).toBe('db-read-only');
      run('systemctl stop mariadb', 'root');
      expect(run('mariadb -e "SELECT 1"', 'root')).toBe('db-unreachable');
      expect(run('mariadb-admin ping', 'root')).toBe('db-unreachable');
    });
});
