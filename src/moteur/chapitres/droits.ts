// Histoire « La Coopérative » — chapitre « Les droits partagés » : Lina et
// Karim (groupe caisse) tiennent les relevés de la caisse dans
// /srv/caisse/releves, mais chacun·e ne peut pas modifier les fichiers de
// l'autre (créés -rw-r--r--, à son propre groupe). Et quand la caisse se
// fige, il leur faut quelqu'un qui a sudo pour la relancer.
//   - le dossier : groupe caisse, écriture pour le groupe, bit setgid (ce
//     qu'on y crée prend le groupe du dossier) ; les fichiers existants :
//     chgrp -R, chmod -R g+w ;
//   - le masque : umask 002 pour Lina et Karim (~/.profile, ou
//     /etc/profile.d) ;
//   - sudo : une règle dans /etc/sudoers.d (avec visudo) qui ne permet au
//     groupe caisse QUE de relancer la caisse.
// Pièges réels : un fichier de sudoers.d dont le nom contient un point
// (ignoré), une commande sans chemin complet (refusée par visudo), une erreur
// écrite avec nano (sudo refuse tout), une règle trop large (ALL, ou
// systemctl sans arguments).
// Objectif vérifié sur l'état : le dossier, les fichiers, le masque de Lina et
// de Karim, et la politique de sudo (ce qu'elle permet et refuse).
// Sources : https://www.sudo.ws/docs/man/sudoers.man/,
// https://man7.org/linux/man-pages/man2/umask.2.html,
// https://www.gnu.org/software/coreutils/manual/html_node/Directory-Setuid-and-Setgid.html

import { d, f, type Chapitre, type Noeud } from '../monde';
import type { Jeu, Shell } from '../shell';
import { nouveauSystemd } from '../systemd';
import { fichiersInclus, lire, permis } from '../sudoers';
import { comptesCooperative, M, MAINTENANT, mondeCooperative, MOT_DE_PASSE } from './cooperative';

const RELEVES = '/srv/caisse/releves';
const RELANCER = '/usr/bin/systemctl restart caisse';
const EQUIPE = ['lina', 'karim'];
const sh = (j: Jeu) => j as Shell;

// Le ~/.profile de Debian (/etc/skel/.profile).
const PROFILE = `# ~/.profile: executed by the command interpreter for login shells.
# This file is not read by bash(1), if ~/.bash_profile or ~/.bash_login
# exists.
# see /usr/share/doc/bash/examples/startup-files for examples.
# the files are located in the bash-doc package.

# the default umask is set in /etc/profile; for setting the umask
# for ssh logins, install and configure the libpam-umask package.
#umask 022

# if running bash
if [ -n "$BASH_VERSION" ]; then
    # include .bashrc if it exists
    if [ -f "$HOME/.bashrc" ]; then
	. "$HOME/.bashrc"
    fi
fi

# set PATH so it includes user's private bin if it exists
if [ -d "$HOME/bin" ] ; then
    PATH="$HOME/bin:$PATH"
fi`;

const ETC_PROFILE = `# /etc/profile: system-wide .profile file for the Bourne shell (sh(1))
# and Bourne compatible shells (bash(1), ksh(1), ash(1), ...).

if [ "$(id -u)" -eq 0 ]; then
  PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
else
  PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games"
fi
export PATH

if [ -d /etc/profile.d ]; then
  for i in /etc/profile.d/*.sh; do
    if [ -r $i ]; then
      . $i
    fi
  done
  unset i
fi`;

const fichier = (contenu: string, proprio: string, groupe?: string, mode?: string) =>
  f(contenu, { lignes: true, proprio, ...(groupe ? { groupe } : {}), ...(mode ? { mode } : {}) });

// Le masque d'une session de ce compte : la dernière ligne « umask NNN » lue à
// la connexion (/etc/profile, /etc/profile.d/*.sh, ~/.bashrc, ~/.profile), sinon 022.
export function masqueDe(j: Jeu, compte: string): number {
  const maison = j.comptes.utilisateurs[compte]?.maison ?? `/home/${compte}`;
  const profileD = j.trouver('/etc/profile.d');
  const sources = [
    '/etc/profile',
    ...(profileD?.type === 'dossier'
      ? Object.keys(profileD.enfants)
          .filter((n) => n.endsWith('.sh'))
          .sort()
          .map((n) => `/etc/profile.d/${n}`)
      : []),
    `${maison}/.bashrc`,
    `${maison}/.profile`,
  ];
  let masque = 0o022;
  for (const s of sources)
    for (const l of (j.lire(s) ?? '').split('\n')) {
      const m = /^\s*umask\s+([0-7]{1,4})\s*$/.exec(l);
      if (m) masque = parseInt(m[1], 8);
    }
  return masque;
}

const dossierOk = (j: Jeu) => {
  const n = j.trouver(RELEVES);
  return n?.type === 'dossier' && (n.groupe ?? n.proprio) === 'caisse' && n.mode?.[4] === 'w' && n.mode?.[5] === 's';
};
const fichiersOk = (j: Jeu) => {
  const n = j.trouver(RELEVES);
  if (n?.type !== 'dossier') return false;
  const tous = (x: Noeud): Noeud[] => (x.type === 'dossier' ? Object.values(x.enfants).flatMap(tous) : [x]);
  return tous(n).every((x) => (x.groupe ?? x.proprio) === 'caisse' && (x.mode ?? 'rw-r--r--')[4] === 'w');
};
const masqueOk = (j: Jeu) => EQUIPE.every((c) => (masqueDe(j, c) & 0o020) === 0);

const politiqueValide = (j: Jeu) => !lire(sh(j)).erreur;
const relancent = (j: Jeu) => politiqueValide(j) && EQUIPE.every((c) => permis(sh(j), c, RELANCER));
// Ce que l'équipe caisse ne doit PAS pouvoir faire.
const tropLarge = (j: Jeu) => politiqueValide(j) && EQUIPE.some((c) => permis(sh(j), c, '/usr/bin/bash') || permis(sh(j), c, '/usr/bin/su'));
const systemctlEntier = (j: Jeu) =>
  politiqueValide(j) && EQUIPE.some((c) => permis(sh(j), c, '/usr/bin/systemctl stop ssh') || permis(sh(j), c, '/usr/bin/systemctl restart ssh'));
const sudoOk = (j: Jeu) => relancent(j) && !tropLarge(j) && !systemctlEntier(j) && permis(sh(j), 'vous', '/usr/bin/bash');

// Un fichier de /etc/sudoers.d qui parle de la caisse, mais que sudo ne lit pas (un point, ou ~ à la fin).
const fichierIgnore = (j: Jeu) => {
  const dossier = j.trouver('/etc/sudoers.d');
  if (dossier?.type !== 'dossier') return null;
  const lus = fichiersInclus(sh(j), '/etc/sudoers.d');
  return (
    Object.keys(dossier.enfants)
      .map((n) => `/etc/sudoers.d/${n}`)
      .find((c) => !lus.includes(c) && /caisse/.test(j.lire(c) ?? '') && !c.endsWith('.tmp')) ?? null
  );
};

export const droits: Chapitre = {
  id: 'droits',
  numero: 2,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'find',
    'touch',
    'cp',
    'mv',
    'mkdir',
    'rm',
    'nano',
    'sudo',
    'id',
    'groups',
    'whoami',
    'chmod',
    'chgrp',
    'chown',
    'umask',
    'which',
    'visudo',
    'systemctl',
    'journalctl',
  ],
  maison: M,
  accueil: 'courriel_awa.txt',
  noms: true,
  final: 'fin',
  motDePasse: MOT_DE_PASSE,
  comptes: () => comptesCooperative(false),
  etat: () => ({
    systemd: nouveauSystemd('cooperative', MAINTENANT - 6 * 86_400_000, MAINTENANT, {
      caisse: {
        description: 'Cooperative till (caisse)',
        active: true,
        executable: 'node',
        processus: [{ pid: 731, utilisateur: 'caisse', cpu: 1.2, mem: 3.4, commande: '/usr/bin/node /srv/caisse/app/server.js' }],
      },
    }),
  }),
  creerMonde: (t) =>
    mondeCooperative({
      sansMarc: true,
      maison: { 'courriel_awa.txt': f(t('droits-courriel-awa')) },
      maisons: {
        lina: d({ '.profile': fichier(PROFILE, 'lina') }, undefined, { proprio: 'lina', mode: 'rwxr-x---' }),
        karim: d({ '.profile': fichier(PROFILE, 'karim') }, undefined, { proprio: 'karim', mode: 'rwxr-x---' }),
      },
      etc: {
        profile: fichier(ETC_PROFILE, 'root'),
        'profile.d': d({}, undefined, { proprio: 'root' }),
        'login.defs': fichier('# excerpt\nUMASK\t\t022\nUSERGROUPS_ENAB no', 'root'),
      },
      plus: {
        srv: d(
          {
            caisse: d(
              {
                releves: d(
                  {
                    '2027-10-17.txt': fichier(t('droits-releve-17'), 'lina', 'lina'),
                    '2027-10-18.txt': fichier(t('droits-releve-18'), 'karim', 'karim'),
                  },
                  undefined,
                  { proprio: 'root', groupe: 'root', mode: 'rwxr-xr-x' },
                ),
              },
              undefined,
              { proprio: 'caisse', groupe: 'caisse' },
            ),
          },
          undefined,
          { proprio: 'root' },
        ),
      },
    }),
  evenements: [
    { id: 'sudoers-casse', condition: (j) => !politiqueValide(j), message: (j) => j.t('droits-evenement-sudoers-casse') },
    {
      id: 'fichier-ignore',
      condition: (j) => !!fichierIgnore(j) && !relancent(j),
      message: (j) => j.t('droits-evenement-fichier-ignore', { fichier: fichierIgnore(j) ?? '' }),
    },
    { id: 'trop-large', condition: tropLarge, message: (j) => j.t('droits-evenement-trop-large') },
    { id: 'systemctl-entier', condition: (j) => systemctlEntier(j) && !tropLarge(j), message: (j) => j.t('droits-evenement-systemctl-entier') },
    { id: 'sudo', condition: sudoOk, message: (j) => j.t('droits-evenement-sudo') },
    { id: 'dossier', condition: dossierOk, message: (j) => j.t('droits-evenement-dossier', { dossier: RELEVES }) },
    { id: 'masque', condition: masqueOk, message: (j) => j.t('droits-evenement-masque') },
    { id: 'fin', condition: (j) => dossierOk(j) && fichiersOk(j) && masqueOk(j) && sudoOk(j), message: (j) => j.t('droits-evenement-fin') },
  ],
};
