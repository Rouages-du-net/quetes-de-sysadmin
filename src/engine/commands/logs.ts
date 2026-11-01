// Les journaux qui grossissent : lsof (qui tient quel fichier ouvert),
// truncate (vider un fichier sans le supprimer) et logrotate (faire tourner
// les journaux). D'après lsof(8), truncate (coreutils) et logrotate(8)
// (https://man7.org/linux/man-pages/man8/logrotate.8.html).
// Écarts : lsof ne connaît que les fichiers ouverts décrits par le jeu
// (etat.ouverts) ; logrotate : une partie des directives, un état par
// journal, sorties de -d et -v abrégées.

import type { File, Node } from '../world';
import type { Shell } from '../shell';
import { wildcard } from '../tools';
import { inode } from './files';
import { erases, openSet, held } from '../open-files';
import { runScript } from '../script';
import { systemd } from '../systemd';
import type { Command } from './index';

const size = (n: File) => n.size ?? (typeof n.content === 'string' ? n.content.length : 0);

// ——— lsof ———

function lsof(game: Shell, args: string[]): string {
  const links = args.includes('+L1');
  const pid = args.includes('-p') ? args[args.indexOf('-p') + 1] : undefined;
  const account = args.includes('-u') ? args[args.indexOf('-u') + 1] : undefined;
  const paths = args.filter((a, i) => !a.startsWith('-') && !a.startsWith('+') && !['-p', '-u'].includes(args[i - 1])).map((a) => game.resolve(a));
  // Sans être root, on ne voit que ses propres processus.
  const lines = openSet(game).filter(
    (o) =>
      held(game, o) &&
      (game.who === 'root' || o.user === game.who) &&
      (!links || erases(game, o)) &&
      (!pid || String(o.pid) === pid) &&
      (!account || o.user === account) &&
      (!paths.length || paths.includes(o.path)),
  );
  if (!lines.length) return game.error('');
  const header = links
    ? 'COMMAND  PID     USER   FD   TYPE DEVICE    SIZE/OFF NLINK   NODE NAME'
    : 'COMMAND  PID     USER   FD   TYPE DEVICE    SIZE/OFF   NODE NAME';
  return [
    header,
    ...lines.map((o) => {
      const end = `${String(inode(o.node)).padStart(7)} ${o.path}${erases(game, o) ? ' (deleted)' : ''}`;
      const start = `${o.command.slice(0, 8).padEnd(8)} ${String(o.pid).padEnd(7)} ${o.user.padEnd(6)} ${`${o.fd}w`.padStart(4)}   REG  254,1 ${String(size(o.node)).padStart(11)}`;
      return links ? `${start} ${(erases(game, o) ? '0' : '1').padStart(5)} ${end}` : `${start} ${end}`;
    }),
  ].join('\n');
}

// ——— truncate ———

// « 0 », « 10K », « 1M », « 2G » → octets.
function bytes(text: string): number | null {
  const m = /^(\d+)([KMG]?)$/i.exec(text);
  if (!m) return null;
  return Number(m[1]) * { '': 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3 }[m[2].toUpperCase() as '' | 'K' | 'M' | 'G'];
}

function truncate(game: Shell, args: string[]): string {
  const i = args.findIndex((a) => a === '-s' || a.startsWith('--size='));
  const raw = i < 0 ? undefined : args[i] === '-s' ? args[i + 1] : args[i].slice(7);
  const files = args.filter((a, k) => !a.startsWith('-') && !(i >= 0 && args[i] === '-s' && k === i + 1));
  if (raw === undefined) return game.error(game.t('truncate-size'));
  const n = bytes(raw);
  if (n === null) return game.error(game.t('truncate-size-incorrect', { size: raw }));
  if (!files.length) return game.error(game.t('truncate-operand'));
  for (const f of files) {
    const node = game.find(f);
    if (node?.type === 'dossier') game.error(game.t('truncate-directory', { file: f }));
    else if (node) {
      if (!game.can(node, 'w')) game.error(game.t('truncate-permission', { file: f }));
      else {
        node.content = typeof node.content === 'string' ? node.content.slice(0, n) : '';
        node.size = n;
      }
    } else if (!args.includes('-c')) {
      const e = game.place('truncate', f, { type: 'fichier', content: '', size: n, owner: game.who });
      if (e) game.error(e);
    }
  }
  return '';
}

// ——— logrotate ———

interface Block {
  patterns: string[];
  period: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  rotation: number;
  compress: boolean;
  delay: boolean;
  okMissing: boolean;
  ifEmpty: boolean;
  copyTruncate: boolean;
  create: { mode?: string; owner?: string; group?: string } | null;
  size: number | null;
  after: string[];
}

const WITHOUT_ARGUMENT = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'hourly',
  'compress',
  'nocompress',
  'delaycompress',
  'missingok',
  'nomissingok',
  'notifempty',
  'ifempty',
  'copytruncate',
  'nocopytruncate',
  'nocreate',
  'sharedscripts',
  'nosharedscripts',
  'dateext',
  'nodateext',
];
const WITH_ARGUMENT = [
  'rotate',
  'size',
  'maxsize',
  'minsize',
  'maxage',
  'su',
  'olddir',
  'compresscmd',
  'compressext',
  'dateformat',
  'include',
  'create',
  'tabooext',
];

/** Lit un fichier de configuration de logrotate (et ce qu'il inclut). */
function readConfig(game: Shell, file: string, errors: string[], fallback?: Partial<Block>, read: string[] = []): Block[] {
  read.push(file);
  const text = game.read(file);
  if (text === null) {
    errors.push(`error: cannot stat ${file}: No such file or directory`);
    return [];
  }
  const global: Partial<Block> = { ...fallback };
  const blocks: Block[] = [];
  let active: Block | null = null;
  let script: string[] | null = null;
  const lines = text.split('\n');
  const apply = (target: Partial<Block>, words: string[], number: number) => {
    const [key, ...args] = words;
    if (!WITHOUT_ARGUMENT.includes(key) && !WITH_ARGUMENT.includes(key))
      return errors.push(`error: ${file}:${number} unknown option '${key}' -- ignoring line`);
    if (['daily', 'weekly', 'monthly', 'yearly', 'hourly'].includes(key)) target.period = key as Block['period'];
    else if (key === 'rotate') {
      if (!/^\d+$/.test(args[0] ?? '')) return errors.push(`error: ${file}:${number} bad rotation count '${args[0] ?? ''}'`);
      target.rotation = Number(args[0]);
    } else if (key === 'compress') target.compress = true;
    else if (key === 'nocompress') target.compress = false;
    else if (key === 'delaycompress') target.delay = true;
    else if (key === 'missingok') target.okMissing = true;
    else if (key === 'nomissingok') target.okMissing = false;
    else if (key === 'notifempty') target.ifEmpty = false;
    else if (key === 'ifempty') target.ifEmpty = true;
    else if (key === 'copytruncate') target.copyTruncate = true;
    else if (key === 'nocreate') target.create = null;
    else if (key === 'create') target.create = { mode: args[0], owner: args[1], group: args[2] };
    else if (key === 'size' || key === 'maxsize') target.size = bytes(args[0] ?? '') ?? null;
    else if (key === 'include') {
      const n = game.find(args[0] ?? '');
      const files =
        n?.type === 'dossier'
          ? Object.keys(n.children)
              .sort()
              .map((k) => `${args[0].replace(/\/$/, '')}/${k}`)
          : [args[0]];
      for (const f of files) blocks.push(...readConfig(game, f, errors, { ...global }, read));
    }
    return 0;
  };
  lines.forEach((rawValue, i) => {
    const number = i + 1;
    const line = rawValue.replace(/(^|\s)#.*$/, '').trim();
    if (script) {
      if (line === 'endscript') script = null;
      else script.push(rawValue.trim());
      return;
    }
    if (!line) return;
    if (active) {
      if (line === '}') {
        blocks.push(active);
        active = null;
      } else if (line === 'postrotate' || line === 'prerotate') {
        script = line === 'postrotate' ? active.after : [];
      } else apply(active, line.split(/\s+/), number);
      return;
    }
    const opens = /^(.+?)\s*\{$/.exec(line);
    if (opens) {
      active = {
        patterns: opens[1].split(/\s+/),
        period: null,
        rotation: 0,
        compress: false,
        delay: false,
        okMissing: false,
        ifEmpty: true,
        copyTruncate: false,
        create: {},
        size: null,
        ...global,
        after: [],
      } as Block;
      return;
    }
    if (line === '{' || line === '}') return void errors.push(`error: ${file}:${number} unexpected ${line}`);
    apply(global, line.split(/\s+/), number);
  });
  if (active) errors.push(`error: ${file}:${lines.length} missing '}' at end of file`);
  return blocks;
}

// Les journaux qu'un motif désigne (un joker dans le nom du fichier).
function logs(game: Shell, pattern: string): string[] {
  const directory = pattern.slice(0, pattern.lastIndexOf('/')) || '/';
  const name = pattern.slice(pattern.lastIndexOf('/') + 1);
  const n = game.find(directory);
  if (n?.type !== 'dossier') return [];
  const re = wildcard(name);
  return Object.keys(n.children)
    .filter((k) => re.test(k) && n.children[k].type === 'fichier')
    .sort()
    .map((k) => `${directory}/${k}`);
}

const PERIODS: Record<string, number> = {
  hourly: 3600_000,
  daily: 86_400_000,
  weekly: 7 * 86_400_000,
  monthly: 30 * 86_400_000,
  yearly: 365 * 86_400_000,
};

function logrotate(game: Shell, args: string[]): string {
  const debug = args.includes('-d') || args.includes('--debug');
  const force = args.includes('-f') || args.includes('--force');
  const verbose = debug || args.includes('-v') || args.includes('--verbose');
  const configs = args.filter((a) => !a.startsWith('-'));
  if (!configs.length) return game.error(game.t('logrotate-usage'));
  if (game.who !== 'root' && !debug) return game.error('error: error creating output file /var/lib/logrotate/status.tmp: Permission denied');
  const errors: string[] = [];
  const blocks = configs.flatMap((c) => readConfig(game, c, errors));
  const output: string[] = [];
  if (debug)
    output.push(
      'warning: logrotate in debug mode does nothing except printing debug messages!  Consider using verbose mode (-v) instead if this is not what you want.',
      '',
    );
  if (verbose)
    output.push(
      ...configs.map((c) => `reading config file ${c}`),
      'Reading state from file: /var/lib/logrotate/status',
      '',
      `Handling ${blocks.length} logs`,
      '',
    );
  const state: Record<string, number> = (game.state.logrotateState ??= {});
  const now = systemd(game)?.clock ?? 0;
  const parent = (path: string) => game.find(path.replace(/\/[^/]+$/, '')) as { children: Record<string, Node> };
  const name = (path: string) => path.split('/').at(-1)!;
  for (const b of blocks) {
    if (verbose)
      output.push(
        `rotating pattern: ${b.patterns.join(' ')}  ${b.period ? `after 1 ${b.period.replace('ly', '').replace('dai', 'day')}s` : 'forced from command line'} ${b.ifEmpty ? '' : 'empty log files are not rotated, '}(${b.rotation} rotations), old logs are removed`,
      );
    const files = b.patterns.flatMap((m) => logs(game, m));
    if (!files.length && !b.okMissing) for (const m of b.patterns) errors.push(`error: stat of ${m} failed: No such file or directory`);
    for (const path of files) {
      const n = game.find(path) as File;
      if (verbose) output.push(`considering log ${path}`);
      const last = state[path];
      // Un journal jamais vu : logrotate note la date, sans le faire tourner (sauf -f).
      const deadline = b.size !== null ? size(n) >= b.size : last !== undefined && now - last >= PERIODS[b.period ?? 'daily'];
      if (last === undefined && !debug) state[path] = now;
      if (!force && !deadline) {
        if (verbose) output.push(`  log does not need rotating (log has been ${last === undefined ? 'already rotated' : 'rotated recently'})`);
        continue;
      }
      if (!b.ifEmpty && size(n) === 0) {
        if (verbose) output.push('  log does not need rotating (log is empty)');
        continue;
      }
      if (verbose) output.push(`  log needs rotating`, `rotating log ${path}, log->rotateCount is ${b.rotation}`);
      if (debug) {
        output.push(
          b.copyTruncate ? `copying ${path} to ${path}.1` : `renaming ${path} to ${path}.1`,
          b.copyTruncate ? `truncating ${path}` : `creating new ${path}`,
        );
        continue;
      }
      const place = parent(path);
      const nameFor = (k: number, gz: boolean) => `${name(path)}.${k}${gz ? '.gz' : ''}`;
      // Les anciens journaux remontent d'un cran ; le plus vieux disparaît.
      for (let k = b.rotation; k >= 1; k--)
        for (const gz of [true, false]) {
          const e = place.children[nameFor(k, gz)];
          if (!e) continue;
          delete place.children[nameFor(k, gz)];
          if (k < b.rotation) place.children[nameFor(k + 1, gz)] = e;
        }
      if (b.rotation === 0) {
        if (b.copyTruncate) Object.assign(n, { content: '', size: 0 });
        else delete place.children[name(path)];
      } else if (b.copyTruncate) {
        // Une copie, puis le fichier vidé : le programme continue d'écrire dans le même fichier.
        place.children[nameFor(1, false)] = { ...n };
        Object.assign(n, { content: '', size: 0 });
      } else {
        // Renommé : le programme qui l'a ouvert écrit toujours dedans, sous son nouveau nom.
        place.children[nameFor(1, false)] = n;
        for (const o of openSet(game)) if (o.node === n) o.path = `${path}.1`;
        if (b.create)
          place.children[name(path)] = {
            type: 'fichier',
            content: '',
            lines: true,
            size: 0,
            owner: b.create.owner ?? n.owner,
            group: b.create.group ?? n.group,
            mode: n.mode,
          };
      }
      state[path] = now;
      if (b.after.length) {
        if (verbose) output.push('running postrotate script');
        const r = runScript(game, b.after.join('\n'), { cwd: '/', name: 'postrotate' });
        if (r.output) output.push(r.output);
        if (r.code !== 0) errors.push(`error: error running non-shared postrotate script for ${path} of '${b.patterns.join(' ')}'`);
      }
      // Puis la compression (après le postrotate, comme logrotate).
      // compress (sans delaycompress, dès .1) : gzip écrit le .gz et efface l'original.
      const compressA = b.compress ? (b.delay ? 2 : 1) : 0;
      if (compressA) {
        const e = place.children[nameFor(compressA, false)];
        if (e?.type === 'fichier') {
          place.children[nameFor(compressA, true)] = {
            type: 'fichier',
            content: '',
            size: Math.round(size(e) / 10),
            owner: e.owner,
            group: e.group,
            mode: e.mode,
          };
          delete place.children[nameFor(compressA, false)];
          if (verbose) output.push(`compressing log with: /bin/gzip`);
        }
      }
    }
  }
  game.state.logrotateRuns = (game.state.logrotateRuns ?? 0) + (debug ? 0 : 1);
  if (errors.length) game.error(errors.join('\n'));
  return verbose ? output.join('\n') : '';
}

export const LOGS: Record<string, Command> = {
  lsof: { section: 8, ownOptions: true, launch: ({ args, game }) => lsof(game, args) },
  truncate: { ownOptions: true, launch: ({ args, game }) => truncate(game, args) },
  logrotate: { section: 8, ownOptions: true, launch: ({ args, game }) => logrotate(game, args) },
};
