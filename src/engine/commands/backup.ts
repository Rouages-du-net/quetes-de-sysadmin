// Sauvegardes : rsync (https://download.samba.org/pub/rsync/rsync.1) et
// crontab (https://manpages.debian.org/bookworm/cron/crontab.1.en.html).
// rsync : « source/ » copie le CONTENU du dossier, « source » le dossier
// lui-même ; seuls les fichiers qui ont changé sont copiés ; --delete retire
// de la destination ce qui n'est plus dans la source ; -n n'écrit rien.
// Sortie et messages en anglais, comme rsync et cron.

import type { File, Node } from '../world';
import type { Shell } from '../shell';
import { content, sizeFor } from '../tools';
import { parse, TEMPLATE } from '../cron';
import { pass, prepare } from '../access';
import { remotePath } from './transfers';
import type { Command } from './index';

const VERSION = '[sender=3.2.7]';
const count = (n: number) => n.toLocaleString('en-US');

interface Options {
  recursive: boolean;
  archive: boolean;
  verbose: boolean;
  trial: boolean;
  erase: boolean;
}

function rsync(game: Shell, args: string[]): string {
  const o: Options = { recursive: false, archive: false, verbose: false, trial: false, erase: false };
  const paths: string[] = [];
  for (const a of args) {
    if (a === '--delete') o.erase = true;
    else if (a === '--dry-run') o.trial = true;
    else if (a === '--archive') o.archive = o.recursive = true;
    else if (a === '--recursive') o.recursive = true;
    else if (a === '--verbose') o.verbose = true;
    else if (a === '--progress' || a === '--human-readable') continue;
    else if (a.startsWith('--')) return game.error(`rsync: ${a}: unknown option\nrsync error: syntax or usage error (code 1) at main.c(1795) [client=3.2.7]`);
    else if (/^-[a-zA-Z]+$/.test(a)) {
      for (const l of a.slice(1)) {
        if (l === 'a') o.archive = o.recursive = true;
        else if (l === 'r') o.recursive = true;
        else if (l === 'v') o.verbose = true;
        else if (l === 'n') o.trial = true;
        else if (l !== 'h' && l !== 'P' && l !== 'z')
          return game.error(`rsync: -${l}: unknown option\nrsync error: syntax or usage error (code 1) at main.c(1795) [client=3.2.7]`);
      }
    } else paths.push(a);
  }
  if (paths.length < 2) return game.error(game.t('rsync-usage'));
  const rawDest = paths.pop()!;
  // Une machine d'en face (« machine:chemin ») : rsync passe par ssh.
  const toRemote = remotePath(rawDest);
  const sinceRemote = paths.map(remotePath);
  const other = toRemote ?? sinceRemote.find(Boolean);
  if (!other) return transfer(game, game, game, o, paths, rawDest);
  if (toRemote && sinceRemote.some(Boolean)) return game.error('The source and destination cannot both be remote.\nrsync error: syntax or usage error (code 1) at main.c(1415) [Receiver=3.2.7]');
  const jumps = prepare(game, other.target, { program: 'ssh' });
  if (typeof jumps === 'string') return game.error(`${jumps}\nrsync: connection unexpectedly closed (0 bytes received so far) [sender]\nrsync error: unexplained error (code 255) at io.c(232) [sender=3.2.7]`);
  const d = jumps.at(-1)!;
  return pass(game, jumps, () => {
    const before = d.shell.who;
    const cwd = d.shell.cwd;
    d.shell.who = d.user;
    d.shell.cwd = d.shell.home;
    try {
      const output = toRemote
        ? transfer(game, game, d.shell, o, paths, toRemote.path || '.')
        : transfer(game, d.shell, game, o, sinceRemote.map((x) => x!.path || '.'), rawDest);
      // Une réponse à une question (mot de passe) : les erreurs s'affichent avec la sortie.
      return [...game.recoverErrors(), output].filter(Boolean).join('\n');
    } finally {
      d.shell.who = before;
      d.shell.cwd = cwd;
    }
  });
}

/** La copie elle-même, de la machine `src` vers la machine `dst` ; les erreurs vont à `jeu` (où rsync tourne). */
function transfer(game: Shell, src: Shell, dst: Shell, o: Options, paths: string[], dest: string): string {
  const lines: string[] = [];
  const errors: string[] = [];
  let total = 0;
  let sent = 0;
  let files = 0;

  // Crée un dossier dans la destination (sauf en essai) ; null si impossible.
  const createDirectory = (path: string, template: Node): boolean => {
    const n = dst.find(path);
    if (n?.type === 'dossier') return true;
    if (o.trial) return true;
    const error = dst.place('rsync', path, { type: 'dossier', children: {}, owner: dst.who, mode: o.archive ? template.mode : undefined });
    if (error) errors.push(`rsync: [Receiver] mkdir "${dst.resolve(path)}" failed: ${error.includes('ucun espace') ? 'No space left on device (28)' : dst.find(path + '/..') ? 'Permission denied (13)' : 'No such file or directory (2)'}`);
    return !error;
  };

  const copyFile = (source: File, path: string, relative: string, sourcePath: string) => {
    total += sizeFor(source, src);
    if (!src.can(source, 'r')) return void errors.push(`rsync: [sender] send_files failed to open "${src.resolve(sourcePath)}": Permission denied (13)`);
    const text = content(source, src);
    const old = dst.find(path);
    if (old?.type === 'fichier' && content(old, dst) === text) return;
    lines.push(relative);
    files++;
    sent += sizeFor(source, src);
    if (o.trial) return;
    if (old?.type === 'fichier') {
      if (!dst.can(old, 'w')) return void errors.push(`rsync: [Receiver] mkstemp "${dst.resolve(path)}" failed: Permission denied (13)`);
      old.content = text;
      old.lines = source.lines;
      old.prose = source.prose;
      delete old.size;
      if (o.archive) old.mode = source.mode;
      return;
    }
    const copyOf: File = { ...source, content: text, owner: dst.who, group: undefined, mode: o.archive ? source.mode : undefined, read: undefined, isProtected: undefined };
    const error = dst.place('rsync', path, copyOf);
    if (error) errors.push(`rsync: [Receiver] mkstemp "${dst.resolve(path)}" failed: Permission denied (13)`);
  };

  // Copie récursive d'un dossier source vers un dossier destination.
  const copyDirectory = (source: Node & { type: 'dossier' }, sourcePath: string, path: string, relative: string) => {
    const existed = dst.find(path)?.type === 'dossier';
    if (!createDirectory(path, source)) return;
    if (!existed) lines.push(relative || './');
    const target = dst.find(path);
    if (o.erase && target?.type === 'dossier')
      for (const name of Object.keys(target.children).sort())
        if (!(name in source.children)) {
          // Comme rsync : le contenu d'un dossier effacé d'abord, du plus profond au plus haut.
          const effaces = (n: Node, rel: string): string[] =>
            n.type === 'dossier'
              ? [...Object.keys(n.children).sort().reverse().flatMap((e) => effaces(n.children[e], `${rel}/${e}`)), `deleting ${rel}/`]
              : [`deleting ${rel}`];
          lines.push(...effaces(target.children[name], `${relative}${name}`));
          if (!o.trial) delete target.children[name];
        }
    for (const [name, e] of Object.entries(source.children).sort(([a], [b]) => a.localeCompare(b))) {
      if (e.type === 'dossier') copyDirectory(e, `${sourcePath}/${name}`, `${path}/${name}`, `${relative}${name}/`);
      else copyFile(e, `${path}/${name}`, `${relative}${name}`, `${sourcePath}/${name}`);
    }
  };

  for (const path of paths) {
    const n = src.find(path);
    if (!n || !src.traverses(path)) {
      errors.push(`rsync: [sender] link_stat "${src.resolve(path)}" failed: ${n ? 'Permission denied (13)' : 'No such file or directory (2)'}`);
      continue;
    }
    const name = src.name(path);
    if (n.type === 'dossier') {
      if (!o.recursive) {
        lines.push(`skipping directory ${name}`);
        continue;
      }
      // « src/ » : le contenu ; « src » : le dossier lui-même, dans dest.
      if (path.endsWith('/')) copyDirectory(n, path.replace(/\/+$/, ''), dest.replace(/\/+$/, ''), '');
      else {
        if (!createDirectory(dest, n)) continue;
        copyDirectory(n, path, `${dest.replace(/\/+$/, '')}/${name}`, `${name}/`);
      }
    } else {
      const d = dst.find(dest);
      const target = d?.type === 'dossier' || dest.endsWith('/') ? `${dest.replace(/\/+$/, '')}/${name}` : dest;
      if (dest.endsWith('/') && !createDirectory(dest, n)) continue;
      copyFile(n, target, name, path);
    }
  }
  for (const e of errors) game.error(e);
  if (errors.length) game.error(`rsync error: some files/attrs were not transferred (see previous errors) (code 23) at main.c(1338) ${VERSION}`);
  if (!o.verbose) return lines.filter((l) => l.startsWith('skipping')).join('\n');
  const received = 19 * files + 35;
  const send = sent + 60 * files + 100;
  return [
    'sending incremental file list',
    ...lines,
    '',
    `sent ${count(send)} bytes  received ${count(received)} bytes  ${((send + received) / 0.5).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} bytes/sec`,
    `total size is ${count(total)}  speedup is ${(total / (send + received)).toFixed(2)}${o.trial ? ' (DRY RUN)' : ''}`,
  ].join('\n');
}

const TEMP = '/tmp/crontab.Zx81Ab';

// Installe une crontab après vérification, comme crontab(1).
function installer(game: Shell, text: string, file: string): string {
  const { errors } = parse(text, file);
  if (errors.length) return [...errors, game.t('crontab-retry')].join('\n');
  const crontabs: Record<string, string> = (game.state.crontabs ??= {});
  crontabs[game.who] = text;
  game.state.crontabVersion = (game.state.crontabVersion ?? 0) + 1;
  return 'crontab: installing new crontab';
}

export const BACKUP: Record<string, Command> = {
  rsync: { ownOptions: true, launch: ({ args, game }) => rsync(game, args) },

  crontab: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const crontabs: Record<string, string> = (game.state.crontabs ??= {});
      // -u compte, où qu'il soit (crontab -l -u marc) : on le ramène devant.
      const iu = args.indexOf('-u');
      if (iu > 0) args = ['-u', args[iu + 1], ...args.filter((_, k) => k !== iu && k !== iu + 1)];
      // -u compte : la crontab d'un autre compte (root seulement).
      if (args[0] === '-u') {
        if (game.who !== 'root') return game.error('crontab: must be privileged to use -u');
        const target = args[1];
        if (!target || !game.accounts.users[target]) return game.error(`crontab: user '${target ?? ''}' unknown`);
        const before = game.who;
        game.who = target;
        try {
          const output = BACKUP.crontab.launch({ args: args.slice(2), game, input: null, last: true });
          // crontab -e : l'installation, à la fermeture de l'éditeur, se fait aussi pour ce compte.
          const after = game.edition?.after;
          if (game.edition && after)
            game.edition.after = () => {
              const who = game.who;
              game.who = target;
              try {
                return after();
              } finally {
                game.who = who;
              }
            };
          if (game.edition) game.edition.root = true;
          return output;
        } finally {
          game.who = before;
        }
      }
      const action = args[0];
      if (action === '-l') return crontabs[game.who] ?? game.error(`no crontab for ${game.who}`);
      if (action === '-r') {
        if (!(game.who in crontabs)) return game.error(`no crontab for ${game.who}`);
        delete crontabs[game.who];
        game.state.crontabVersion = (game.state.crontabVersion ?? 0) + 1;
        return '';
      }
      if (action === '-e') {
        // Comme le vrai crontab -e : une copie dans /tmp, ouverte dans l'éditeur,
        // vérifiée et installée à la fermeture.
        const account = game.who;
        const text = crontabs[game.who] ?? TEMPLATE;
        if (!game.exists(TEMP)) game.place('crontab', TEMP, { type: 'dossier', children: {}, owner: game.who, mode: 'rwx------' });
        const file = `${TEMP}/crontab`;
        game.place('crontab', file, { type: 'fichier', content: text, owner: game.who, lines: true });
        game.edition = {
          path: file,
          text: text.endsWith('\n') ? text : text + '\n',
          root: game.who === 'root',
          message: game.t('nano-lines-read', { lignes: text.split('\n').length - (text.endsWith('\n') ? 1 : 0) }),
          // La crontab est installée pour le compte qui l'a ouverte (root avec sudo), à la fermeture de l'éditeur.
          after: () => {
            const who = game.who;
            game.who = account;
            try {
              const fresh = (game.read(file) ?? '').replace(/\n$/, '');
              if (fresh === text.replace(/\n$/, '')) return 'crontab: no changes made to crontab';
              return installer(game, fresh, file);
            } finally {
              game.who = who;
            }
          },
        };
        // Écart : l'éditeur est toujours nano (pas de select-editor).
        return game.who in crontabs ? '' : `no crontab for ${game.who} - using an empty one`;
      }
      if (action && !action.startsWith('-')) {
        const text = game.read(action);
        if (text === null) return game.error(`${action}: No such file or directory`);
        return installer(game, text, action);
      }
      return game.error(game.t('crontab-usage'));
    },
  },
};
