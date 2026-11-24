// The postgres family (see families.ts): PostgreSQL's tools (the stories
// with a database: "The Game Library", "The Audit", "The Theatre", "The Old
// Sun", "The Choir", "The Shelter"…): psql, pg_dump, pg_restore, createdb,
// dropdb, pg_ctl, pg_lsclusters, pg_ctlcluster, pg_isready, with the
// server's model (postgres.ts, pg-server.ts, pg-roles.ts, sql-where.ts).

import { POSTGRES } from '../commands/postgres';
import { PG_CLUSTER } from '../commands/pg-cluster';
import { registerFamily } from '../families';

export const HOOKS = {};

registerFamily('postgres', { ...POSTGRES, ...PG_CLUSTER }, HOOKS);
