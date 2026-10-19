// Histoire « La Coopérative » : ce que ses chapitres ont en commun. Le
// serveur de l'épicerie coopérative du quartier (machine cooperative) : la
// caisse (un service), le dossier partagé de l'équipe caisse, un compte de
// déploiement partagé (deploy). Des bénévoles arrivent et partent : les
// comptes, les groupes, sudo.

import { d, f, fichiersComptes, type Comptes, type Dossier, type Noeud } from '../monde';
import { genererCle } from '../acces';

export const M = '/home/vous';
export const MOT_DE_PASSE = 'radis-2027';
// Mardi 19 octobre 2027, 9 h 30.
export const MAINTENANT = Date.UTC(2027, 9, 19, 9, 30, 0);
export const AUJOURDHUI = '2027-10-19';

// Les clés publiques de l'équipe (fausses, de la bonne forme).
export const CLES = {
  marc: genererCle('cooperative-marc', 'marc@portable').publique,
  lina: genererCle('cooperative-lina', 'lina@atelier').publique,
  ci: genererCle('cooperative-ci', 'deploy@ci').publique,
};

// Les comptes ; après « Le départ », celui de Marc n'existe plus.
export const comptesCooperative = (avecMarc = true): Comptes => {
  const c: Comptes = {
    utilisateurs: {
      root: { uid: 0, groupe: 'root', maison: '/root' },
      deploy: { uid: 998, groupe: 'deploy', maison: '/home/deploy' },
      caisse: { uid: 997, groupe: 'caisse', maison: '/var/lib/caisse', shell: '/usr/sbin/nologin' },
      vous: { uid: 1000, groupe: 'vous' },
      marc: { uid: 1001, groupe: 'marc' },
      lina: { uid: 1002, groupe: 'lina' },
      karim: { uid: 1003, groupe: 'karim' },
    },
    groupes: {
      root: { gid: 0, membres: [] },
      adm: { gid: 4, membres: ['vous', 'marc'] },
      sudo: { gid: 27, membres: ['vous', 'marc'] },
      caisse: { gid: 997, membres: ['marc', 'lina', 'karim'] },
      deploy: { gid: 998, membres: [] },
      vous: { gid: 1000, membres: [] },
      marc: { gid: 1001, membres: [] },
      lina: { gid: 1002, membres: [] },
      karim: { gid: 1003, membres: [] },
    },
  };
  if (!avecMarc) {
    delete c.utilisateurs.marc;
    delete c.groupes.marc;
    for (const g of Object.values(c.groupes)) g.membres = g.membres.filter((m) => m !== 'marc');
  }
  return c;
};

const racine = { proprio: 'root' };
const fichier = (contenu: string, proprio = 'root', mode?: string) => f(contenu, { lignes: true, proprio, ...(mode ? { mode } : {}) });

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
export function mondeCooperative(o: {
  maison: Record<string, Noeud>;
  maisons?: Record<string, Noeud>;
  etc?: Record<string, Noeud>;
  plus?: Record<string, Noeud>;
  // Après « Le départ » : plus de clé de Marc dans deploy.
  sansMarc?: boolean;
}): Dossier {
  return d(
    {
      etc: d(
        {
          ...fichiersComptes(),
          hostname: fichier('cooperative'),
          sudoers: fichier(SUDOERS, 'root', 'r--r-----'),
          'sudoers.d': d({ README: fichier(README_SUDOERS, 'root', 'r--r-----') }, undefined, { proprio: 'root', mode: 'rwxr-xr-x' }),
          'cron.d': d({ e2scrub_all: fichier(E2SCRUB) }, undefined, racine),
          ...(o.etc ?? {}),
        },
        undefined,
        racine,
      ),
      home: d(
        {
          vous: d(o.maison),
          deploy: d(
            {
              '.ssh': d(
                { authorized_keys: fichier((o.sansMarc ? [CLES.ci, CLES.lina] : [CLES.ci, CLES.marc, CLES.lina]).join('\n'), 'deploy', 'rw-------') },
                undefined,
                { proprio: 'deploy', mode: 'rwx------' },
              ),
            },
            undefined,
            { proprio: 'deploy', mode: 'rwxr-x---' },
          ),
          lina: d({}, undefined, { proprio: 'lina', mode: 'rwx------' }),
          karim: d({}, undefined, { proprio: 'karim', mode: 'rwx------' }),
          ...(o.maisons ?? {}),
        },
        undefined,
        racine,
      ),
      tmp: d({}, undefined, { proprio: 'root', mode: 'rwxrwxrwt' }),
      usr: d({ local: d({ bin: d({}, undefined, racine), sbin: d({}, undefined, racine) }, undefined, racine) }, undefined, racine),
      ...(o.plus ?? {}),
    },
    undefined,
    racine,
  );
}
