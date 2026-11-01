// Histoire « La Coopérative » : ce que ses chapitres ont en commun. Le
// serveur de l'épicerie coopérative du quartier (machine cooperative) : la
// till (un service), le dossier partagé de l'équipe caisse, un compte de
// déploiement partagé (deploy). Des bénévoles arrivent et partent : les
// comptes, les groupes, sudo.

import { d, f, accountsFiles, type Accounts, type Directory, type Node } from '../world';
import { generateKey } from '../access';

export const M = '/home/you';
export const PASSWORD = 'radish-2027';
// Mardi 19 octobre 2027, 9 h 30.
export const NOW = Date.UTC(2027, 9, 19, 9, 30, 0);
export const TODAY = '2027-10-19';

// Les clés publiques de l'équipe (fausses, de la bonne forme).
export const KEYS = {
  marc: generateKey('cooperative-marc', 'marc@portable').isPublic,
  lina: generateKey('cooperative-lina', 'lina@atelier').isPublic,
  ci: generateKey('cooperative-ci', 'deploy@ci').isPublic,
};

// Les comptes ; après « Le départ », celui de Marc n'existe plus.
export const cooperativeAccounts = (withMarc = true): Accounts => {
  const c: Accounts = {
    users: {
      root: { uid: 0, group: 'root', home: '/root' },
      deploy: { uid: 998, group: 'deploy', home: '/home/deploy' },
      till: { uid: 997, group: 'till', home: '/var/lib/till', shell: '/usr/sbin/nologin' },
      you: { uid: 1000, group: 'you' },
      marc: { uid: 1001, group: 'marc' },
      lina: { uid: 1002, group: 'lina' },
      karim: { uid: 1003, group: 'karim' },
    },
    groups: {
      root: { gid: 0, members: [] },
      adm: { gid: 4, members: ['you', 'marc'] },
      sudo: { gid: 27, members: ['you', 'marc'] },
      till: { gid: 997, members: ['marc', 'lina', 'karim'] },
      deploy: { gid: 998, members: [] },
      you: { gid: 1000, members: [] },
      marc: { gid: 1001, members: [] },
      lina: { gid: 1002, members: [] },
      karim: { gid: 1003, members: [] },
    },
  };
  if (!withMarc) {
    delete c.users.marc;
    delete c.groups.marc;
    for (const g of Object.values(c.groups)) g.members = g.members.filter((m) => m !== 'marc');
  }
  return c;
};

const root = { owner: 'root' };
const file = (content: string, owner = 'root', mode?: string) => f(content, { lines: true, owner, ...(mode ? { mode } : {}) });

// sudoers de Debian : le groupe sudo a tous les droits ; @includedir lit /etc/sudoers.d.
export const SUDOERS = `#
# This file MUST be edited with the 'visudo' command as root.
#
# Please consider adding local content in /etc/sudoers.d/ instead of
# directly modifying this file.
#
# See the man page for details on how to write a sudoers file.
#
Defaults	env_reset
Defaults	mail_badpass
Defaults	secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Defaults	use_pty

# User privilege specification
root	ALL=(ALL:ALL) ALL

# Allow members of group sudo to execute any command
%sudo	ALL=(ALL:ALL) ALL

# See sudoers(5) for more information on "@include" directives:

@includedir /etc/sudoers.d`;

// /etc/cron.d de Debian : une tâche par ligne, avec le compte qui la lance (6e colonne).
const E2SCRUB = `30 3 * * 0 root test -e /run/systemd/system || SERVICE_MODE=1 /usr/lib/x86_64-linux-gnu/e2fsprogs/e2scrub_all_cron
10 3 * * * root test -e /run/systemd/system || SERVICE_MODE=1 /sbin/e2scrub_all -A -r`;

const README_SUDOERS = `#
# The default /etc/sudoers file created on installation of the
# sudo  package now includes the directive:
#
# 	@includedir /etc/sudoers.d
#
# This will cause sudo to read and parse any files in the /etc/sudoers.d
# directory that do not end in '~' or contain a '.' character.
#
# Note that there must be at least one file in the sudoers.d directory (this
# one will do).
#
# Note also, that because sudoers contents can vary widely, no attempt is
# made to add this directive to existing sudoers files on upgrade.  Feel free
# to add the above directive to the end of your /etc/sudoers file to enable
# this functionality for existing installations if you wish! Sudo
# versions older than the one in Debian 11 (bullseye) require the
# directive will only support the old syntax #includedir, and the current
# sudo will happily accept both @includedir and #includedir
#
# Finally, please note that using the visudo command is the recommended way
# to update sudoers content, since it protects against many failure modes.
# See the man page for visudo and sudoers for more information.
#`;

/** Le monde commun : /etc (comptes, sudoers), les maisons, et ce que le chapitre ajoute. */
export function cooperativeWorld(o: {
  home: Record<string, Node>;
  homes?: Record<string, Node>;
  etc?: Record<string, Node>;
  more?: Record<string, Node>;
  // Après « Le départ » : plus de clé de Marc dans deploy.
  withoutMarc?: boolean;
  // Les programmes installés dans /usr/sbin (ex. nginx).
  sbin?: Record<string, Node>;
}): Directory {
  return d(
    {
      etc: d(
        {
          ...accountsFiles(),
          hostname: file('coop'),
          sudoers: file(SUDOERS, 'root', 'r--r-----'),
          'sudoers.d': d({ README: file(README_SUDOERS, 'root', 'r--r-----') }, undefined, { owner: 'root', mode: 'rwxr-xr-x' }),
          'cron.d': d({ e2scrub_all: file(E2SCRUB) }, undefined, root),
          ...(o.etc ?? {}),
        },
        undefined,
        root,
      ),
      home: d(
        {
          you: d(o.home),
          deploy: d(
            {
              '.ssh': d(
                { authorized_keys: file((o.withoutMarc ? [KEYS.ci, KEYS.lina] : [KEYS.ci, KEYS.marc, KEYS.lina]).join('\n'), 'deploy', 'rw-------') },
                undefined,
                { owner: 'deploy', mode: 'rwx------' },
              ),
            },
            undefined,
            { owner: 'deploy', mode: 'rwxr-x---' },
          ),
          lina: d({}, undefined, { owner: 'lina', mode: 'rwx------' }),
          karim: d({}, undefined, { owner: 'karim', mode: 'rwx------' }),
          ...(o.homes ?? {}),
        },
        undefined,
        root,
      ),
      tmp: d({}, undefined, { owner: 'root', mode: 'rwxrwxrwt' }),
      usr: d(
        { local: d({ bin: d({}, undefined, root), sbin: d({}, undefined, root) }, undefined, root), sbin: d(o.sbin ?? {}, undefined, root) },
        undefined,
        root,
      ),
      ...(o.more ?? {}),
    },
    undefined,
    root,
  );
}
