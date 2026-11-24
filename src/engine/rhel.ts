// A Red Hat family machine (state.os = 'rhel'): Rocky Linux 10, a rebuild of
// Red Hat Enterprise Linux 10 (https://docs.rockylinux.org/releases/release_notes/10_0/).
// What the core needs to know of it; the tools themselves (dnf, rpm,
// firewall-cmd, SELinux's commands, httpd's model) are the `rhel` family's
// (families/rhel.ts), loaded with its stories.
//   - the same GNU userland, systemd and bash as Debian, but no apt, dpkg,
//     ufw or Debian's helpers (a2ensite…): bash answers "command not found";
//   - bash's prompt is Fedora's `[\u@\h \W]\$` (/etc/bashrc): [you@kettle ~]$;
//   - SELinux is enforcing: every file and process has a context, which
//     `ls -l` marks with a dot after the mode (GNU ls: a file with a security
//     context and no other ACL), and which `ls -Z`, `ps -Z` and `id` show.
// Sources: Rocky Linux 10.3's packages (dl.rockylinux.org/pub/rocky/10/),
// bash's /etc/bashrc in the setup package, coreutils' ls.c (the '.' after
// the mode), id.c ("context=").

import type { Game } from './shell';
import type { Node } from './world';

export const isRhel = (game: Game) => game.state.os === 'rhel';

// Debian's own tools: Rocky Linux has none of them.
export const DEBIAN_ONLY = [
  'apt', 'apt-get', 'apt-cache', 'apt-config', 'dpkg', 'dpkg-reconfigure', 'ufw', 'a2ensite', 'a2dissite', 'a2enmod', 'a2dismod', 'a2enconf', 'a2disconf',
  'apache2ctl', 'update-rc.d', 'unattended-upgrade', 'lsb_release', 'ifup', 'ifdown', 'needrestart',
];

// The context of the player's login (unconfined_u, the targeted policy's default for a user).
export const LOGIN_CONTEXT = 'unconfined_u:unconfined_r:unconfined_t:s0-s0:c0.c1023';
// A service started by systemd that the policy doesn't confine.
export const SERVICE_CONTEXT = 'system_u:system_r:unconfined_service_t:s0';

/** A node's SELinux context, as ls -Z shows it ('?' without SELinux). */
export function contextOf(game: Game, n: Node): string {
  if (!isRhel(game)) return '?';
  return n.context ?? 'system_u:object_r:unlabeled_t:s0';
}

/** A context's type (its third field). */
export const typeOf = (context: string | undefined) => context?.split(':')[2] ?? 'unlabeled_t';

/**
 * A new file takes its label from the place it is created in (the policy's
 * type transitions aside: a file made in a home directory is user_home_t,
 * one made in /tmp user_tmp_t); a moved file keeps its own (mv renames,
 * it doesn't relabel). Children without a label get one the same way.
 */
export function labelNew(parent: Node, n: Node, user = 'unconfined_u'): void {
  const p = typeOf(parent.context);
  const type = p === 'user_home_dir_t' ? 'user_home_t' : p === 'tmp_t' ? 'user_tmp_t' : p;
  if (!n.context) n.context = `${user}:object_r:${type}:s0`;
  if (n.type === 'directory') for (const c of Object.values(n.children)) labelNew(n, c, user);
}
