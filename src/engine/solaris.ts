// A Solaris 10 machine (state.os = 'solaris'), after Oracle's Solaris 10
// documentation (https://docs.oracle.com/cd/E26505_01/): what a Debian admin
// meets there.
//   - SMF, the Service Management Facility: services named by FMRI
//     (svc:/application/database/postgresql_84:default_64bit), in a state
//     (online, disabled, maintenance, legacy_run), driven by svcadm and read
//     by svcs and svcprop — state.smf;
//   - ZFS: pools (zpool) and datasets (zfs), and snapshots taken in an
//     instant (zfs snapshot pool/dataset@name) — state.zfs;
//   - zones (the global zone is the machine itself), SVR4 packages (pkginfo),
//     prstat rather than top;
//   - the old tools of /usr/bin (grep without -q nor -E, sed without -i, tar
//     without z, find without -maxdepth), with POSIX versions in /usr/xpg4/bin
//     and BSD ones in /usr/ucb (ps aux).
// Simplifications (see docs/SCENARIOS.md): a single global zone, one SMF
// restarter, no milestones nor dependencies between services, ZFS sizes that
// don't change with the files.

import type { Game } from './shell';

export const isSolaris = (game: Game) => game.state.os === 'solaris';

// Commands a Solaris 10 machine doesn't have (Linux's and FreeBSD's).
export const NOT_ON_SOLARIS = [
  'systemctl', 'journalctl', 'apt', 'apt-get', 'dpkg', 'ss', 'ip', 'ufw', 'iptables', 'iptables-save', 'nft', 'top', 'free', 'stat',
  'service', 'sysrc', 'pkg', 'sockstat', 'pfctl', 'freebsd-version', 'update-rc.d', 'pgrep', 'watch',
];

// ——— SMF ———

export interface SmfService {
  state: 'online' | 'disabled' | 'maintenance' | 'legacy_run' | 'offline';
  stime: string;
  description: string;
  // Its properties (svcprop): group/name → value.
  props?: Record<string, string>;
  // The processes it runs (svcs -p).
  pids?: number[];
  contract?: number;
  // Why it's in maintenance (svcs -x).
  reason?: string;
  // svcadm disable -t: disabled until the next boot only.
  temporary?: boolean;
  // What happens when it's enabled or disabled (the database stops, the app reads its configuration…).
  onEnable?: (game: Game) => void;
  onDisable?: (game: Game) => void;
}

export interface SmfState {
  services: Record<string, SmfService>;
}

export const smf = (game: Game): SmfState => (game.state.smf ??= { services: {} });

/**
 * The FMRIs a pattern names, like svcadm and svcs: the whole FMRI, or its end
 * from a "/" or a ":" (postgresql_84, seed-catalogue:default, site/seed-catalogue).
 */
export function matchFmri(game: Game, pattern: string): string[] {
  const all = Object.keys(smf(game).services);
  if (all.includes(pattern)) return [pattern];
  const p = pattern.replace(/^svc:\//, '').replace(/^\//, '');
  return all.filter((f) => {
    const body = f.replace(/^(svc|lrc):\//, '');
    const service = body.split(':')[0];
    return body === p || body.endsWith(`/${p}`) || service === p || service.endsWith(`/${p}`) || body.endsWith(`:${p}`);
  });
}

export const online = (game: Game, pattern: string) => matchFmri(game, pattern).some((f) => smf(game).services[f].state === 'online');

// ——— ZFS ———

export interface Dataset {
  used: string;
  avail: string;
  refer: string;
  mountpoint: string;
}

export interface ZfsState {
  datasets: Record<string, Dataset>;
  // name@snapshot → its creation (a date as zfs shows it) and its size.
  snapshots: Record<string, { used: string; refer: string; creation: string }>;
  pools: Record<string, { size: string; alloc: string; free: string; health: string; devices: string[] }>;
}

export const zfs = (game: Game): ZfsState => (game.state.zfs ??= { datasets: {}, snapshots: {}, pools: {} });
