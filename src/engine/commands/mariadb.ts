// MariaDB's client programs: mariadb (mysql), mariadb-dump (mysqldump),
// mariadb-admin (mysqladmin), mariadb-check (mysqlcheck),
// mariadb-secure-installation. Only the entries live here, for the manual,
// Tab and highlighting: the programs themselves (mariadb-client.ts, with the
// server's model, mariadb.ts and mariadb-sql.ts) load with the story that has
// a MariaDB server ("The Allotments"), whose module registers them
// (setMariadbPrograms), so that the first visit doesn't carry them. A machine
// without a MariaDB model doesn't have these commands anyway (availability.ts).

import type { Command, Context } from './index';

let programs: Record<string, (c: Context) => string> | null = null;

/** Called by the story's module when it loads (stories/allotments.ts). */
export const setMariadbPrograms = (p: Record<string, (c: Context) => string>) => {
  programs = p;
};

const entry = (name: string): Command => ({
  ownOptions: true,
  launch: (c) => programs?.[name]?.(c) ?? c.game.error(`-bash: ${name}: command not found`, 127),
});

export const MARIADB: Record<string, Command> = Object.fromEntries(
  ['mariadb', 'mysql', 'mariadb-dump', 'mysqldump', 'mariadb-admin', 'mysqladmin', 'mariadb-check', 'mysqlcheck', 'mariadb-secure-installation'].map((n) => [n, entry(n)]),
);
