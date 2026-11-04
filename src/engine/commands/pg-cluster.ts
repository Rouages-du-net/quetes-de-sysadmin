// Debian's PostgreSQL cluster tools (postgresql-common) and pg_isready:
// pg_lsclusters (the clusters and their state), pg_ctlcluster VERSION NAME
// start|stop|restart|reload|status|promote, pg_isready [-h host] [-p port].
// After https://manpages.debian.org/bookworm/postgresql-common/pg_lsclusters.1.en.html,
// https://manpages.debian.org/bookworm/postgresql-common/pg_ctlcluster.1.en.html,
// https://www.postgresql.org/docs/16/app-pg-isready.html
// Differences: one cluster (16/main); pg_ctlcluster goes through systemd for
// start/stop/restart/reload, as on Debian; pg_isready only knows the local
// server and the standby's primary.

import type { Shell } from '../shell';
import type { Command } from './index';
import { systemd, start, stop, reload } from '../systemd';
import { postgres } from '../postgres';
import { promote, server } from '../pg-server';

const running = (game: Shell) => systemd(game)?.services.postgresql?.state === 'active';

export const PG_CLUSTER: Record<string, Command> = {
  pg_lsclusters: {
    launch: ({ game }) => {
      if (!postgres(game)) return game.error('Error: no clusters found');
      const status = running(game) ? (server(game)?.recovery ? 'online,recovery' : 'online') : 'down';
      return [
        'Ver Cluster Port Status          Owner    Data directory              Log file',
        `16  main    5432 ${status.padEnd(15)} postgres /var/lib/postgresql/16/main /var/log/postgresql/postgresql-16-main.log`,
      ].join('\n');
    },
  },
  pg_ctlcluster: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const [version, cluster, action] = args.filter((a) => !a.startsWith('-'));
      if (!version || !cluster || !action) return game.error('Usage: /usr/bin/pg_ctlcluster <version> <cluster> <action> [-- <pg_ctl options>]', 1);
      if (version !== '16' || cluster !== 'main') return game.error(`Error: specified cluster '${version} ${cluster}' does not exist`, 1);
      if (game.who !== 'root' && game.who !== 'postgres') return game.error('Error: You must run this program as the cluster owner (postgres) or root', 1);
      const sd = systemd(game)!;
      switch (action) {
        case 'status':
          return running(game)
            ? `pg_ctl: server is running (PID: 702)\n/usr/lib/postgresql/16/bin/postgres "-D" "/var/lib/postgresql/16/main" "-c" "config_file=/etc/postgresql/16/main/postgresql.conf"`
            : (game.status = 3, 'pg_ctl: no server running');
        case 'start':
          if (running(game)) return game.error('Cluster is already running.', 2);
          start(game, sd, 'postgresql');
          return '';
        case 'stop':
          if (!running(game)) return game.error('Cluster is not running.', 2);
          stop(game, sd, 'postgresql');
          return '';
        case 'restart':
          if (running(game)) stop(game, sd, 'postgresql');
          start(game, sd, 'postgresql');
          return '';
        case 'reload':
          reload(game, sd, 'postgresql');
          return '';
        case 'promote':
          if (!running(game)) return game.error('pg_ctl: PID file "/var/lib/postgresql/16/main/postmaster.pid" does not exist\nIs server running?', 1);
          if (!promote(game)) return game.error('pg_ctl: cannot promote server; server is not in standby mode', 1);
          return 'waiting for server to promote.... done\nserver promoted';
        default:
          return game.error(`Error: unknown action '${action}'`, 1);
      }
    },
  },
  pg_isready: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const ih = args.findIndex((a) => a === '-h' || a === '--host');
      const host = ih >= 0 ? args[ih + 1] : undefined;
      const ip = args.findIndex((a) => a === '-p' || a === '--port');
      const port = ip >= 0 ? args[ip + 1] : '5432';
      const local = !host || ['localhost', '127.0.0.1', '/var/run/postgresql'].includes(host);
      const name = host ?? '/var/run/postgresql';
      if (local) {
        if (running(game) && port === '5432') return `${name}:${port} - accepting connections`;
        game.status = 2;
        return `${name}:${port} - no response`;
      }
      const standby = server(game)?.standby;
      if (standby && (host === standby.primary || host === standby.address) && standby.reachable) return `${host}:${port} - accepting connections`;
      game.status = 2;
      return `${host}:${port} - no response`;
    },
  },
};
