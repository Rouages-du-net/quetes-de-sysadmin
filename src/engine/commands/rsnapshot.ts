// rsnapshot : des instantanés d'un dossier, à intervalles réguliers, qui ne
// coûtent presque rien en place : d'un instantané au suivant, les fichiers
// qui n'ont pas changé sont des liens physiques (le même fichier sous deux
// noms). D'après https://rsnapshot.org/rsnapshot/docs/docs.html et
// rsnapshot(1) :
//   - /etc/rsnapshot.conf, champs séparés par des TABULATIONS ;
//   - « rsnapshot daily » (le plus petit intervalle) : on fait tourner
//     daily.0 → daily.1 → …, on supprime le plus vieux, on recopie daily.1
//     en daily.0 par liens physiques (cp -al), puis rsync met daily.0 à jour ;
//   - un intervalle plus grand (weekly) reprend le plus vieux daily.
// Écarts : une partie des directives ; pas de backup_script, de link_dest,
// de sync_first ni de sauvegarde distante (user@host:) ; messages d'erreur
// proches de ceux de rsnapshot 1.4.

import type { Dossier, Fichier, Noeud } from '../world';
import type { Shell } from '../shell';
import { contenu, lisible } from '../tools';
import type { Commande } from './index';

export const CONF = '/etc/rsnapshot.conf';

// La configuration livrée par Debian (rsnapshot 1.4.5), abrégée ; tabulations comprises.
export const CONF_DEBIAN = `#################################################
# rsnapshot.conf - rsnapshot configuration file #
#################################################
#                                               #
# PLEASE BE AWARE OF THE FOLLOWING RULE:        #
#                                               #
# This file requires tabs between elements      #
#                                               #
#################################################

#######################
# CONFIG FILE VERSION #
#######################

config_version\t1.2

###########################
# SNAPSHOT ROOT DIRECTORY #
###########################

# All snapshots will be stored under this root directory.
#
snapshot_root\t/var/cache/rsnapshot/

# If no_create_root is enabled, rsnapshot will not automatically create the
# snapshot_root directory. This is particularly useful if you are backing
# up to removable media, such as a FireWire or USB drive.
#
#no_create_root\t1

#################################
# EXTERNAL PROGRAM DEPENDENCIES #
#################################

cmd_cp\t\t/bin/cp
cmd_rm\t\t/bin/rm
cmd_rsync\t/usr/bin/rsync
cmd_logger\t/usr/bin/logger

#########################################
#     BACKUP LEVELS / INTERVALS         #
# Must be unique and in ascending order #
# e.g. alpha, beta, gamma, etc.         #
#########################################

retain\talpha\t6
retain\tbeta\t7
retain\tgamma\t4
#retain\tdelta\t3

############################################
#              GLOBAL OPTIONS              #
# All are optional, with sensible defaults #
############################################

# Verbose level, 1 through 5.
# 1     Quiet           Print fatal errors only
# 2     Default         Print errors and warnings only
# 3     Verbose         Show equivalent shell commands being executed
verbose\t\t2

loglevel\t3
lockfile\t/var/run/rsnapshot.pid

###############################
### BACKUP POINTS / SCRIPTS ###
###############################

# LOCALHOST
backup\t/home/\t\tlocalhost/
backup\t/etc/\t\tlocalhost/
backup\t/usr/local/\tlocalhost/`;

const CONNUES = [
  'config_version',
  'snapshot_root',
  'no_create_root',
  'cmd_cp',
  'cmd_rm',
  'cmd_rsync',
  'cmd_ssh',
  'cmd_logger',
  'cmd_du',
  'retain',
  'interval',
  'verbose',
  'loglevel',
  'logfile',
  'lockfile',
  'rsync_short_args',
  'rsync_long_args',
  'exclude',
  'include',
  'one_fs',
  'link_dest',
  'sync_first',
  'use_lazy_deletes',
  'backup',
];

export interface ConfRsnapshot {
  racine: string;
  niveaux: { nom: string; nombre: number }[];
  sauvegardes: { source: string; destination: string }[];
  sansCreerRacine: boolean;
}

/** Lit la configuration ; renvoie les erreurs au format de rsnapshot. */
export function lireConf(texte: string, fichier = CONF): { conf: ConfRsnapshot; erreurs: string[] } {
  const conf: ConfRsnapshot = { racine: '', niveaux: [], sauvegardes: [], sansCreerRacine: false };
  const erreurs: string[] = [];
  const erreur = (numero: number, ligne: string, raison: string) =>
    erreurs.push(`ERROR: ${fichier} on line ${numero}:`, `ERROR: ${ligne} - ${raison}`);
  texte.split('\n').forEach((ligne, i) => {
    if (!ligne.trim() || ligne.trimStart().startsWith('#')) return;
    const [cle, ...valeurs] = ligne.replace(/\s+$/, '').split(/\t+/);
    if (!CONNUES.includes(cle)) return erreur(i + 1, ligne.trim(), 'Unknown config directive');
    if (cle === 'snapshot_root') {
      if (!valeurs[0]?.startsWith('/')) return erreur(i + 1, ligne.trim(), 'snapshot_root must be a full path');
      conf.racine = valeurs[0].replace(/\/?$/, '/');
    } else if (cle === 'retain' || cle === 'interval') {
      const [nom, nombre] = valeurs;
      if (!nom || !/^[a-zA-Z0-9_]+$/.test(nom)) return erreur(i + 1, ligne.trim(), 'Interval must be alphanumeric');
      if (!/^\d+$/.test(nombre ?? '') || Number(nombre) < 1)
        return erreur(i + 1, ligne.trim(), `"${nombre ?? ''}" is not a legal value for a retention count`);
      conf.niveaux.push({ nom, nombre: Number(nombre) });
    } else if (cle === 'backup') {
      const [source, destination] = valeurs;
      if (!source || !destination) return erreur(i + 1, ligne.trim(), 'backup point needs a source and a destination');
      if (!source.startsWith('/')) return erreur(i + 1, ligne.trim(), `Source directory "${source}" doesn't exist`);
      if (destination.startsWith('/')) return erreur(i + 1, ligne.trim(), `Backup destination ${destination} must be a local, relative path`);
      conf.sauvegardes.push({ source: source.replace(/\/?$/, '/'), destination: destination.replace(/\/?$/, '/') });
    } else if (cle === 'no_create_root') conf.sansCreerRacine = valeurs[0] === '1';
  });
  if (!erreurs.length) {
    if (!conf.racine) erreurs.push('ERROR: snapshot_root was not defined. rsnapshot can not continue.');
    if (!conf.niveaux.length) erreurs.push('ERROR: At least one backup level must be set. rsnapshot can not continue.');
    if (!conf.sauvegardes.length) erreurs.push('ERROR: At least one backup point must be set. rsnapshot can not continue.');
  }
  return { conf, erreurs };
}

const BANNIERE = (args: string[]) =>
  [
    '----------------------------------------------------------------------------',
    'rsnapshot encountered an error! The program was invoked with these options:',
    `/usr/bin/rsnapshot ${args.join(' ')} `,
    '----------------------------------------------------------------------------',
  ].join('\n');

// Une copie par liens physiques (cp -al) : de nouveaux lieux, les mêmes fichiers.
const copieLiee = (n: Dossier): Dossier => ({
  ...n,
  enfants: Object.fromEntries(Object.entries(n.enfants).map(([k, e]) => [k, e.type === 'dossier' ? copieLiee(e) : e])),
});

// rsync -a --delete de `source` vers `cible` : un fichier inchangé garde son
// nœud (il reste lié aux instantanés précédents), un fichier changé est remplacé.
function synchroniser(jeu: Shell, source: Dossier, cible: Dossier) {
  for (const nom of Object.keys(cible.enfants)) if (!(nom in source.enfants)) delete cible.enfants[nom];
  for (const [nom, e] of Object.entries(source.enfants)) {
    const ici = cible.enfants[nom];
    if (e.type === 'dossier') {
      const lieu =
        ici?.type === 'dossier' ? ici : (cible.enfants[nom] = { type: 'dossier', enfants: {}, proprio: e.proprio, groupe: e.groupe, mode: e.mode });
      synchroniser(jeu, e, lieu);
    } else if (!(ici?.type === 'fichier' && contenu(ici, jeu) === contenu(e, jeu) && ici.taille === e.taille)) {
      cible.enfants[nom] = { ...(e as Fichier), contenu: contenu(e, jeu) };
    }
  }
}

// Le lieu `chemin` (absolu), créé au besoin.
function lieu(jeu: Shell, chemin: string): Dossier {
  let n = jeu.trouver('/') as Dossier;
  for (const part of chemin.split('/').filter(Boolean)) {
    const e = n.enfants[part];
    n = e?.type === 'dossier' ? e : (n.enfants[part] = { type: 'dossier', enfants: {}, proprio: 'root', mode: 'rwxr-xr-x' });
  }
  return n;
}

/** Fait tourner un niveau (rsnapshot daily) ; renvoie les commandes équivalentes. */
export function tourner(jeu: Shell, conf: ConfRsnapshot, niveau: string, essai: boolean): { commandes: string[]; erreur?: string } {
  const i = conf.niveaux.findIndex((n) => n.nom === niveau);
  const { nombre } = conf.niveaux[i];
  const r = conf.racine;
  const commandes = ['echo 4242 > /var/run/rsnapshot.pid'];
  const existe = (k: number, nom = niveau) => jeu.trouver(`${r}${nom}.${k}`)?.type === 'dossier';
  if (!jeu.existe(r.replace(/\/$/, '') || '/')) {
    if (conf.sansCreerRacine) return { commandes, erreur: 'rsnapshot refuses to create snapshot_root when no_create_root is enabled' };
    commandes.push(`mkdir -m 0700 -p ${r}`);
    if (!essai) {
      const n = lieu(jeu, r);
      n.mode = 'rwx------';
    }
  }
  const racine = () => lieu(jeu, r);
  // Un niveau plus grand : il lui faut le plus vieux instantané du niveau d'avant.
  if (i > 0) {
    const avant = conf.niveaux[i - 1];
    const plusVieux = `${avant.nom}.${avant.nombre - 1}`;
    if (!existe(avant.nombre - 1, avant.nom)) return { commandes: [...commandes, `${r}${plusVieux} not present (yet), nothing to copy`] };
  }
  if (existe(nombre - 1)) {
    commandes.push(`/bin/rm -rf ${r}${niveau}.${nombre - 1}/`);
    if (!essai) delete racine().enfants[`${niveau}.${nombre - 1}`];
  }
  for (let k = nombre - 2; k >= 0; k--)
    if (existe(k)) {
      commandes.push(`mv ${r}${niveau}.${k}/ ${r}${niveau}.${k + 1}/`);
      if (!essai) {
        const n = racine();
        n.enfants[`${niveau}.${k + 1}`] = n.enfants[`${niveau}.${k}`];
        delete n.enfants[`${niveau}.${k}`];
      }
    }
  if (i > 0) {
    const avant = conf.niveaux[i - 1];
    commandes.push(`mv ${r}${avant.nom}.${avant.nombre - 1}/ ${r}${niveau}.0/`);
    if (!essai) {
      const n = racine();
      n.enfants[`${niveau}.0`] = n.enfants[`${avant.nom}.${avant.nombre - 1}`];
      delete n.enfants[`${avant.nom}.${avant.nombre - 1}`];
    }
  } else {
    if (existe(1) || (essai && existe(0))) {
      commandes.push(`/bin/cp -al ${r}${niveau}.1 ${r}${niveau}.0`);
      if (!essai) racine().enfants[`${niveau}.0`] = copieLiee(racine().enfants[`${niveau}.1`] as Dossier);
    } else {
      commandes.push(`mkdir -m 0755 -p ${r}${niveau}.0/`);
      if (!essai) racine().enfants[`${niveau}.0`] = { type: 'dossier', enfants: {}, proprio: 'root', mode: 'rwxr-xr-x' };
    }
    for (const b of conf.sauvegardes) {
      const dest = `${r}${niveau}.0/${b.destination}`;
      commandes.push(`/usr/bin/rsync -a --delete --numeric-ids --relative --delete-excluded ${b.source} ${dest}`);
      if (essai) continue;
      const source = jeu.trouver(b.source);
      if (source?.type !== 'dossier') return { commandes, erreur: `rsync: [sender] change_dir "${b.source}" failed: No such file or directory (2)` };
      // --relative : le chemin complet de la source est recréé sous la destination.
      synchroniser(jeu, source, lieu(jeu, `${dest}${b.source}`));
    }
    commandes.push(`touch ${r}${niveau}.0/`);
  }
  commandes.push('rm -f /var/run/rsnapshot.pid');
  return { commandes };
}

export const RSNAPSHOT: Record<string, Commande> = {
  rsnapshot: {
    section: 1,
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      let fichier = CONF;
      const options = new Set<string>();
      const reste: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-c') fichier = args[++i] ?? CONF;
        else if (/^-[tvVqD]+$/.test(args[i])) for (const l of args[i].slice(1)) options.add(l);
        else reste.push(args[i]);
      }
      const commande = reste[0];
      if (!commande) return jeu.erreur(jeu.t('rsnapshot-usage'));
      const texte = jeu.lire(fichier);
      if (texte === null) return jeu.erreur(`${BANNIERE(args)}\nERROR: Config file "${fichier}" does not exist or is not readable.`);
      const { conf, erreurs } = lireConf(texte, fichier);
      if (erreurs.length)
        return jeu.erreur(
          [
            BANNIERE(args),
            ...erreurs,
            'ERROR: ---------------------------------------------------------------------',
            `ERROR: Errors were found in ${fichier},`,
            'ERROR: rsnapshot can not continue. If you think an entry looks right, make',
            "ERROR: sure you don't have spaces where only tabs should be.",
          ].join('\n'),
        );
      if (commande === 'configtest') return 'Syntax OK';
      if (commande === 'du') {
        const racine = jeu.trouver(conf.racine);
        if (racine?.type !== 'dossier') return jeu.erreur(`${BANNIERE(args)}\nERROR: snapshot_root ${conf.racine} does not exist.`);
        // Comme du -csh : un fichier lié dans plusieurs instantanés n'est compté qu'une fois.
        const vus = new Set<Noeud>();
        const taille = (n: Noeud): number => {
          if (n.type === 'dossier') return Object.values(n.enfants).reduce((t, e) => t + taille(e), 0) + 4096;
          if (vus.has(n)) return 0;
          vus.add(n);
          return n.taille ?? new TextEncoder().encode(contenu(n, jeu)).length;
        };
        const noms = conf.niveaux.flatMap((n) => Array.from({ length: n.nombre }, (_, k) => `${n.nom}.${k}`)).filter((nom) => racine.enfants[nom]);
        const lignes = noms.map((nom) => [taille(racine.enfants[nom]), `${conf.racine}${nom}/`] as const);
        const total = lignes.reduce((t, [o]) => t + o, 0);
        return [...lignes, [total, 'total'] as const].map(([o, nom]) => `${lisible(o, 'en').replace(',', '.')}\t${nom}`).join('\n');
      }
      if (!conf.niveaux.some((n) => n.nom === commande)) return jeu.erreur(jeu.t('rsnapshot-usage'));
      if (jeu.qui !== 'root' && !options.has('t'))
        return jeu.erreur(`${BANNIERE(args)}\nERROR: ${conf.racine} - snapshot_root is not writable (try sudo)`);
      const r = tourner(jeu, conf, commande, options.has('t'));
      if (r.erreur)
        return jeu.erreur([...(options.has('t') || options.has('v') ? r.commandes : []), BANNIERE(args), `ERROR: ${r.erreur}`].join('\n'));
      jeu.etat.rsnapshotTours = [...(jeu.etat.rsnapshotTours ?? []), commande];
      return options.has('t') || options.has('v')
        ? r.commandes.map((c) => `${c} `).join('\n')
        : r.commandes.filter((c) => c.endsWith('nothing to copy')).join('\n');
    },
  },
};
