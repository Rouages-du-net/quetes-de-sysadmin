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

import type { Directory, File, Node } from '../world';
import type { Shell } from '../shell';
import { content, readable } from '../tools';
import type { Command } from './index';

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

const KNOWN = [
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
  root: string;
  levels: { name: string; count: number }[];
  backups: { source: string; destination: string }[];
  withoutRootCreate: boolean;
}

/** Lit la configuration ; renvoie les erreurs au format de rsnapshot. */
export function readConf(text: string, file = CONF): { conf: ConfRsnapshot; errors: string[] } {
  const conf: ConfRsnapshot = { root: '', levels: [], backups: [], withoutRootCreate: false };
  const errors: string[] = [];
  const error = (number: number, line: string, reason: string) =>
    errors.push(`ERROR: ${file} on line ${number}:`, `ERROR: ${line} - ${reason}`);
  text.split('\n').forEach((line, i) => {
    if (!line.trim() || line.trimStart().startsWith('#')) return;
    const [key, ...values] = line.replace(/\s+$/, '').split(/\t+/);
    if (!KNOWN.includes(key)) return error(i + 1, line.trim(), 'Unknown config directive');
    if (key === 'snapshot_root') {
      if (!values[0]?.startsWith('/')) return error(i + 1, line.trim(), 'snapshot_root must be a full path');
      conf.root = values[0].replace(/\/?$/, '/');
    } else if (key === 'retain' || key === 'interval') {
      const [name, count] = values;
      if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) return error(i + 1, line.trim(), 'Interval must be alphanumeric');
      if (!/^\d+$/.test(count ?? '') || Number(count) < 1)
        return error(i + 1, line.trim(), `"${count ?? ''}" is not a legal value for a retention count`);
      conf.levels.push({ name, count: Number(count) });
    } else if (key === 'backup') {
      const [source, destination] = values;
      if (!source || !destination) return error(i + 1, line.trim(), 'backup point needs a source and a destination');
      if (!source.startsWith('/')) return error(i + 1, line.trim(), `Source directory "${source}" doesn't exist`);
      if (destination.startsWith('/')) return error(i + 1, line.trim(), `Backup destination ${destination} must be a local, relative path`);
      conf.backups.push({ source: source.replace(/\/?$/, '/'), destination: destination.replace(/\/?$/, '/') });
    } else if (key === 'no_create_root') conf.withoutRootCreate = values[0] === '1';
  });
  if (!errors.length) {
    if (!conf.root) errors.push('ERROR: snapshot_root was not defined. rsnapshot can not continue.');
    if (!conf.levels.length) errors.push('ERROR: At least one backup level must be set. rsnapshot can not continue.');
    if (!conf.backups.length) errors.push('ERROR: At least one backup point must be set. rsnapshot can not continue.');
  }
  return { conf, errors };
}

const BANNER = (args: string[]) =>
  [
    '----------------------------------------------------------------------------',
    'rsnapshot encountered an error! The program was invoked with these options:',
    `/usr/bin/rsnapshot ${args.join(' ')} `,
    '----------------------------------------------------------------------------',
  ].join('\n');

// Une copie par liens physiques (cp -al) : de nouveaux lieux, les mêmes fichiers.
const linkedCopy = (n: Directory): Directory => ({
  ...n,
  children: Object.fromEntries(Object.entries(n.children).map(([k, e]) => [k, e.type === 'directory' ? linkedCopy(e) : e])),
});

// rsync -a --delete de `source` vers `cible` : un fichier inchangé garde son
// nœud (il reste lié aux instantanés précédents), un fichier changé est remplacé.
function synchronise(game: Shell, source: Directory, target: Directory) {
  for (const name of Object.keys(target.children)) if (!(name in source.children)) delete target.children[name];
  for (const [name, e] of Object.entries(source.children)) {
    const here = target.children[name];
    if (e.type === 'directory') {
      const place =
        here?.type === 'directory' ? here : (target.children[name] = { type: 'directory', children: {}, owner: e.owner, group: e.group, mode: e.mode });
      synchronise(game, e, place);
    } else if (!(here?.type === 'file' && content(here, game) === content(e, game) && here.size === e.size)) {
      target.children[name] = { ...(e as File), content: content(e, game) };
    }
  }
}

// Le lieu `chemin` (absolu), créé au besoin.
function place(game: Shell, path: string): Directory {
  let n = game.find('/') as Directory;
  for (const part of path.split('/').filter(Boolean)) {
    const e = n.children[part];
    n = e?.type === 'directory' ? e : (n.children[part] = { type: 'directory', children: {}, owner: 'root', mode: 'rwxr-xr-x' });
  }
  return n;
}

/** Fait tourner un niveau (rsnapshot daily) ; renvoie les commandes équivalentes. */
export function run(game: Shell, conf: ConfRsnapshot, level: string, trial: boolean): { commands: string[]; error?: string } {
  const i = conf.levels.findIndex((n) => n.name === level);
  const { count } = conf.levels[i];
  const r = conf.root;
  const commands = ['echo 4242 > /var/run/rsnapshot.pid'];
  const exists = (k: number, name = level) => game.find(`${r}${name}.${k}`)?.type === 'directory';
  if (!game.exists(r.replace(/\/$/, '') || '/')) {
    if (conf.withoutRootCreate) return { commands, error: 'rsnapshot refuses to create snapshot_root when no_create_root is enabled' };
    commands.push(`mkdir -m 0700 -p ${r}`);
    if (!trial) {
      const n = place(game, r);
      n.mode = 'rwx------';
    }
  }
  const root = () => place(game, r);
  // Un niveau plus grand : il lui faut le plus vieux instantané du niveau d'avant.
  if (i > 0) {
    const before = conf.levels[i - 1];
    const moreOld = `${before.name}.${before.count - 1}`;
    if (!exists(before.count - 1, before.name)) return { commands: [...commands, `${r}${moreOld} not present (yet), nothing to copy`] };
  }
  if (exists(count - 1)) {
    commands.push(`/bin/rm -rf ${r}${level}.${count - 1}/`);
    if (!trial) delete root().children[`${level}.${count - 1}`];
  }
  for (let k = count - 2; k >= 0; k--)
    if (exists(k)) {
      commands.push(`mv ${r}${level}.${k}/ ${r}${level}.${k + 1}/`);
      if (!trial) {
        const n = root();
        n.children[`${level}.${k + 1}`] = n.children[`${level}.${k}`];
        delete n.children[`${level}.${k}`];
      }
    }
  if (i > 0) {
    const before = conf.levels[i - 1];
    commands.push(`mv ${r}${before.name}.${before.count - 1}/ ${r}${level}.0/`);
    if (!trial) {
      const n = root();
      n.children[`${level}.0`] = n.children[`${before.name}.${before.count - 1}`];
      delete n.children[`${before.name}.${before.count - 1}`];
    }
  } else {
    if (exists(1) || (trial && exists(0))) {
      commands.push(`/bin/cp -al ${r}${level}.1 ${r}${level}.0`);
      if (!trial) root().children[`${level}.0`] = linkedCopy(root().children[`${level}.1`] as Directory);
    } else {
      commands.push(`mkdir -m 0755 -p ${r}${level}.0/`);
      if (!trial) root().children[`${level}.0`] = { type: 'directory', children: {}, owner: 'root', mode: 'rwxr-xr-x' };
    }
    for (const b of conf.backups) {
      const dest = `${r}${level}.0/${b.destination}`;
      commands.push(`/usr/bin/rsync -a --delete --numeric-ids --relative --delete-excluded ${b.source} ${dest}`);
      if (trial) continue;
      const source = game.find(b.source);
      if (source?.type !== 'directory') return { commands, error: `rsync: [sender] change_dir "${b.source}" failed: No such file or directory (2)` };
      // --relative : le chemin complet de la source est recréé sous la destination.
      synchronise(game, source, place(game, `${dest}${b.source}`));
    }
    commands.push(`touch ${r}${level}.0/`);
  }
  commands.push('rm -f /var/run/rsnapshot.pid');
  return { commands };
}

export const RSNAPSHOT: Record<string, Command> = {
  rsnapshot: {
    section: 1,
    ownOptions: true,
    launch: ({ args, game }) => {
      let file = CONF;
      const options = new Set<string>();
      const rest: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-c') file = args[++i] ?? CONF;
        else if (/^-[tvVqD]+$/.test(args[i])) for (const l of args[i].slice(1)) options.add(l);
        else rest.push(args[i]);
      }
      const command = rest[0];
      if (!command) return game.error(game.t('rsnapshot-usage'));
      const text = game.read(file);
      if (text === null) return game.error(`${BANNER(args)}\nERROR: Config file "${file}" does not exist or is not readable.`);
      const { conf, errors } = readConf(text, file);
      if (errors.length)
        return game.error(
          [
            BANNER(args),
            ...errors,
            'ERROR: ---------------------------------------------------------------------',
            `ERROR: Errors were found in ${file},`,
            'ERROR: rsnapshot can not continue. If you think an entry looks right, make',
            "ERROR: sure you don't have spaces where only tabs should be.",
          ].join('\n'),
        );
      if (command === 'configtest') return 'Syntax OK';
      if (command === 'du') {
        const root = game.find(conf.root);
        if (root?.type !== 'directory') return game.error(`${BANNER(args)}\nERROR: snapshot_root ${conf.root} does not exist.`);
        // Comme du -csh : un fichier lié dans plusieurs instantanés n'est compté qu'une fois.
        const seen = new Set<Node>();
        const size = (n: Node): number => {
          if (n.type === 'directory') return Object.values(n.children).reduce((t, e) => t + size(e), 0) + 4096;
          if (seen.has(n)) return 0;
          seen.add(n);
          return n.size ?? new TextEncoder().encode(content(n, game)).length;
        };
        const names = conf.levels.flatMap((n) => Array.from({ length: n.count }, (_, k) => `${n.name}.${k}`)).filter((name) => root.children[name]);
        const lines = names.map((name) => [size(root.children[name]), `${conf.root}${name}/`] as const);
        const total = lines.reduce((t, [o]) => t + o, 0);
        return [...lines, [total, 'total'] as const].map(([o, name]) => `${readable(o, 'en').replace(',', '.')}\t${name}`).join('\n');
      }
      if (!conf.levels.some((n) => n.name === command)) return game.error(game.t('rsnapshot-usage'));
      if (game.who !== 'root' && !options.has('t'))
        return game.error(`${BANNER(args)}\nERROR: ${conf.root} - snapshot_root is not writable (try sudo)`);
      const r = run(game, conf, command, options.has('t'));
      if (r.error)
        return game.error([...(options.has('t') || options.has('v') ? r.commands : []), BANNER(args), `ERROR: ${r.error}`].join('\n'));
      game.state.rsnapshotRuns = [...(game.state.rsnapshotRuns ?? []), command];
      return options.has('t') || options.has('v')
        ? r.commands.map((c) => `${c} `).join('\n')
        : r.commands.filter((c) => c.endsWith('nothing to copy')).join('\n');
    },
  },
};
