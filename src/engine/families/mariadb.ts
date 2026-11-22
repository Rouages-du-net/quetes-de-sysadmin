// The mariadb family (see families.ts): MariaDB's client programs ("The
// Allotments"): mariadb (mysql), mariadb-dump (mysqldump), mariadb-admin
// (mysqladmin), mariadb-check (mysqlcheck), mariadb-secure-installation, with
// the server's model (mariadb.ts, mariadb-sql.ts).

import type { Command } from '../commands/index';
import { MARIADB_PROGRAMS } from '../mariadb-client';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('mariadb', Object.fromEntries(Object.entries(MARIADB_PROGRAMS).map(([name, launch]) => [name, { ownOptions: true, launch } satisfies Command])), HOOKS);
