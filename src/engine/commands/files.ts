// Commandes de fichiers : se déplacer, lire, créer, copier, effacer,
// permissions, archives, place disque.

import type { File, Node } from '../world';
import type { Shell } from '../shell';
import { applyMode, compareNames, content, wildcard, readable, modeWithMask, options, sizeFor } from '../tools';
import { ghostPlace } from '../open-files';
import { colourise, lsColour, visibleWidth, readColour, invalidColourMessage, sgr } from '../colours';
import { COMMANDS, type Command, type Context } from './index';

// Les commandes intégrées au shell : which ne les trouve pas.
const BUILT_IN = ['cd', 'exit', 'umask', 'echo', 'pwd', 'help', 'aide', 'test', 'history'];

// Le numéro d'inode d'un fichier (ls -i) : un par nœud, donné à la première
// demande. Deux noms pour le même nœud (lien physique) ont le même numéro.
const INODES = new WeakMap<Node, number>();
let nextInode = 1_311_201;
export const inode = (n: Node) => {
  if (!INODES.has(n)) INODES.set(n, nextInode++);
  return INODES.get(n)!;
};

const modeFor = (n: Node) => n.mode ?? (n.type === 'dossier' ? 'rwxr-xr-x' : 'rw-r--r--');

// Une ligne de « ls -l ». Écart volontaire : on omet le nombre de liens et
// la date.
// Le nom d'une entrée de ls, en couleur si ls colore (voir couleurs.ts).
type Paint = (name: string, n: Node) => string;
const withoutPainting: Paint = (name) => name;
const painting = (enabled: boolean): Paint => (enabled ? (name, n) => sgr(lsColour(name, n.type, n.type === 'fichier' && n.link !== undefined, modeFor(n)), name) : withoutPainting);

function longLine(game: Shell, name: string, n: Node, human: boolean, numeric = false, paint: Paint = withoutPainting): string {
  // -n : les numéros (uid, gid) au lieu des noms.
  const ownerName = n.owner ?? game.player;
  const groupName = n.group ?? ownerName;
  const owner = numeric ? String(game.accounts.users[ownerName]?.uid ?? ownerName) : ownerName;
  const group = numeric ? String(game.accounts.groups[groupName]?.gid ?? groupName) : groupName;
  const bytes = n.type === 'dossier' ? 4096 : sizeFor(n, game);
  const size = human ? readable(bytes, game.t.language) : String(bytes);
  const suffix = n.type === 'dossier' && name !== '.' && name !== '..' ? '/' : '';
  // Un lien symbolique : « l », droits rwxrwxrwx, taille = longueur du chemin visé.
  if (n.type === 'fichier' && n.link !== undefined)
    return `lrwxrwxrwx ${owner.padEnd(8)} ${group.padEnd(8)} ${String(n.link.length).padStart(6)} ${paint(name, n)} -> ${n.link}`;
  return `${n.type === 'dossier' ? 'd' : '-'}${modeFor(n)} ${owner.padEnd(8)} ${group.padEnd(8)} ${size.padStart(6)} ${paint(name, n)}${suffix}`;
}

// Source → (lieu de destination, nom final), comme mv et cp sous Linux :
// si la destination est un lieu, l'objet y garde son nom ; sinon, c'est un
// nouveau nom dans un lieu existant.
function destination(game: Shell, source: string, dest: string): string {
  const target = game.find(dest);
  return target?.type === 'dossier' ? `${game.resolve(dest)}/${game.name(source)}`.replace('//', '/') : game.resolve(dest);
}

const copy = (n: Node, owner: string): Node =>
  n.type === 'fichier'
    ? { ...n, owner, group: undefined, read: undefined, isProtected: undefined }
    : { type: 'dossier', owner, mode: n.mode, children: Object.fromEntries(Object.entries(n.children).map(([k, e]) => [k, copy(e, owner)])) };

// ls d'un seul lieu (ou fichier).
function list({ args, game, last }: Context, paint: Paint = withoutPainting): string {
  const { letters, rest } = options(args);
  const target = rest[0] ?? '.';
  // ls -l d'un lien montre le lien lui-même ; sans -l, ls entre dans le lieu visé.
  const link = game.find(target, false);
  const n = (letters.has('l') || letters.has('n')) && link?.type === 'fichier' && link.link !== undefined ? link : game.find(target);
  if (!n) return game.error(game.t('ls-access-missing', { cible: target }));
  const reason = game.block(target);
  if (reason) return game.error(reason);
  if (!game.traverses(target)) return game.error(game.t('ls-access-permission', { cible: target }));
  // -n est un -l qui montre les numéros.
  const long = letters.has('l') || letters.has('n');
  // -i : le numéro d'inode devant chaque nom.
  const ino = (e: Node, text: string) => (letters.has('i') ? `${String(inode(e)).padStart(7)} ${text}` : text);
  // -d : le lieu lui-même, pas son contenu.
  if (n.type === 'fichier' || letters.has('d')) return ino(n, long ? longLine(game, target, n, letters.has('h'), letters.has('n'), paint) : paint(target, n));
  if (!game.can(n, 'r')) return game.error(game.t('ls-open-permission', { cible: target }));
  const inputs: [string, Node][] = Object.entries(n.children)
    .filter(([name]) => letters.has('a') || !name.startsWith('.'))
    .sort(([a], [b]) => compareNames(a, b));
  if (letters.has('a')) inputs.unshift(['.', n], ['..', game.find(target + '/..') ?? n]);
  if (long) return inputs.map(([name, e]) => ino(e, longLine(game, name, e, letters.has('h'), letters.has('n'), paint))).join('\n');
  // Le / ajouté aux lieux reste hors de la couleur (comme ls -F) : la couleur n'est jamais le seul signe.
  const shows = (name: string, e: Node) => paint(name, e) + (e.type === 'dossier' && name !== '.' && name !== '..' ? '/' : '');
  if (letters.has('i')) return inputs.map(([name, e]) => ino(e, last ? shows(name, e) : paint(name, e))).join(last ? '    ' : '\n');
  // Comme le vrai ls : en colonnes à l'écran, un nom par ligne dans un
  // tube ou un fichier (et sans le / ajouté aux lieux).
  if (!last) return inputs.map(([name, e]) => paint(name, e)).join('\n');
  return inColumns(inputs.map(([name, e]) => shows(name, e)), game.columns);
}

/**
 * Comme ls de GNU dans un terminal : le plus de colonnes possible dans la
 * largeur de l'écran ($COLUMNS), remplies de haut en bas, chaque colonne
 * aussi large que son plus long nom, plus deux espaces.
 */
export function inColumns(names: string[], screenWidth: number): string {
  const sizes = names.map((n) => visibleWidth(n));
  for (let trial = names.length; trial >= 1; trial--) {
    const ranks = Math.ceil(names.length / trial);
    const columns = Math.ceil(names.length / ranks);
    const widths = Array.from({ length: columns }, (_, c) => Math.max(...sizes.slice(c * ranks, (c + 1) * ranks)) + (c < columns - 1 ? 2 : 0));
    if (columns > 1 && widths.reduce((a, b) => a + b, 0) > screenWidth) continue;
    const lines: string[] = [];
    for (let r = 0; r < ranks; r++) {
      let line = '';
      for (let c = 0; c < columns && r + c * ranks < names.length; c++) {
        const i = r + c * ranks;
        line += names[i] + ' '.repeat(Math.max(0, widths[c] - sizes[i]));
      }
      lines.push(line.trimEnd());
    }
    return lines.join('\n');
  }
  return names.join('\n');
}

export const FILES: Record<string, Command> = {
  pwd: {
    launch: ({ game }) => game.cwd,
  },

  whoami: {
    launch: ({ game }) => game.who,
  },

  // umask : le masque des droits des fichiers créés (commande intégrée à bash).
  // Sans argument, l'affiche (-S : sous forme symbolique) ; sinon, le change pour cette session.
  // history, comme celui de bash : les commandes tapées sur cette machine, numérotées
  // (!n les relance, !! la dernière : voir Shell.developperHistorique).
  history: {
    launch: ({ args, game }) => {
      if (args[0] === '-c') {
        game.history.length = 0;
        return '';
      }
      if (args[0] !== undefined && !/^\d+$/.test(args[0])) return game.error(`-bash: history: ${args[0]}: numeric argument required`);
      const lines = game.history.map((l, i) => `${String(i + 1).padStart(5)}  ${l}`);
      return (args[0] === undefined ? lines : lines.slice(-Number(args[0]))).join('\n');
    },
  },

  umask: {
    launch: ({ args, game }) => {
      const value = args.find((a) => !a.startsWith('-'));
      if (value) {
        if (!/^[0-7]{1,4}$/.test(value)) return game.error(`-bash: umask: ${value}: octal number out of range`);
        game.mask = value.padStart(4, '0');
        return '';
      }
      if (!args.includes('-S')) return game.mask;
      const permitted = modeWithMask(true, game.mask);
      return ['u', 'g', 'o'].map((q, i) => `${q}=${permitted.slice(i * 3, i * 3 + 3).replace(/-/g, '')}`).join(',');
    },
  },

  // which : le chemin complet d'une commande (le premier trouvé dans le PATH) ;
  // rien, et le code 1, pour une commande intégrée au shell ou inconnue.
  which: {
    launch: ({ args, game }) => {
      const names = args.filter((a) => !a.startsWith('-'));
      const found = names.map((n) => {
        const c = COMMANDS[n];
        if (!c || c.directory || c.section === 5 || BUILT_IN.includes(n)) return null;
        return `${c.section === 8 ? '/usr/sbin' : '/usr/bin'}/${n}`;
      });
      if (found.some((x) => x === null)) game.status = 1;
      return found.filter(Boolean).join('\n');
    },
  },

  // hostname : le nom de la machine ; -f, le nom complet (celui que /etc/hosts donne en premier).
  hostname: {
    launch: ({ args, game }) => {
      const name = game.read('/etc/hostname')?.trim() || game.hostName;
      if (!args.includes('-f')) return name;
      const line = (game.read('/etc/hosts') ?? '').split('\n').find((l) => l.replace(/#.*/, '').trim().split(/\s+/).slice(1).includes(name));
      return line?.trim().split(/\s+/)[1] ?? name;
    },
  },

  ls: {
    launch: (raw) => {
      // --color : comme l'alias « ls --color=auto » du ~/.bashrc de Debian, ls colore à l'écran par défaut.
      const { when, args, invalid } = readColour(raw.args, 'auto');
      if (invalid !== undefined) return raw.game.error(invalidColourMessage(raw, 'ls', invalid));
      const c = { ...raw, args };
      const paint = painting(colourise(c, when));
      const list_ = (ctx: Context) => list(ctx, paint);
      const { rest } = options(c.args);
      if (rest.length <= 1) return list_(c);
      // Plusieurs cibles : les fichiers d'abord, puis un bloc par lieu, avec son nom (comme ls).
      const letters = c.args.filter((a) => a.startsWith('-'));
      const files = rest.filter((r) => c.game.find(r)?.type !== 'dossier');
      const places = rest.filter((r) => c.game.find(r)?.type === 'dossier');
      const blocks = files.map((f) => list_({ ...c, args: [...letters, f] })).filter(Boolean);
      for (const l of places) blocks.push(`${l}:\n${list_({ ...c, args: [...letters, l] })}`);
      return blocks.join('\n\n');
    },
  },

  cd: {
    launch: ({ args, game }) => {
      // cd - : retour au dossier d'avant ($OLDPWD), que bash affiche.
      if (args[0] === '-') {
        if (game.old === null) return game.error(game.t('cd-old-missing'));
        const old = game.old;
        if (game.find(old)?.type !== 'dossier') return game.error(game.t('error-missing', { commande: 'cd', cible: old }));
        game.old = game.cwd;
        game.cwd = old;
        game.visits.add(old);
        return old;
      }
      const target = args[0] ?? '~';
      const n = game.find(target);
      if (!n) return game.error(game.t('error-missing', { commande: 'cd', cible: target }));
      if (n.type !== 'dossier') return game.error(game.t('cd-not-one-directory', { cible: target }));
      const reason = game.block(target);
      if (reason) return game.error(reason);
      if (!game.traverses(target) || !game.can(n, 'x')) return game.error(game.t('error-permission', { commande: 'cd', cible: target }));
      game.old = game.cwd;
      game.cwd = game.resolve(target);
      game.visits.add(game.cwd);
      return '';
    },
  },

  cat: {
    launch: ({ args, input, game }) => {
      if (!args.length) return input ?? game.error(game.t('cat-usage'));
      return args
        .map((target) => {
          const text = game.readFor('cat', target);
          if (text === null) return null;
          const n = game.find(target) as File;
          const effect = n.read?.(game);
          return [text, effect].filter(Boolean).join('\n\n');
        })
        .filter((t) => t !== null)
        .join('\n');
    },
  },

  echo: {
    launch: ({ args }) => args.join(' '),
  },

  tee: {
    launch: ({ args, input, game }) => {
      const { letters, rest } = options(args);
      const text = input ?? '';
      for (const target of rest) {
        const n = game.find(target);
        if (n?.type === 'fichier') {
          if (!game.traverses(target) || !game.can(n, 'w')) {
            game.error(game.t('error-permission', { commande: 'tee', cible: target }));
            continue;
          }
          const before = content(n, game);
          n.content = letters.has('a') && before ? `${before}\n${text}` : text;
          n.lines = true;
          delete n.size;
        } else {
          const error = game.place('tee', target, { type: 'fichier', content: text, owner: game.who, lines: true });
          if (error) game.error(error);
        }
      }
      return text;
    },
  },

  mv: {
    launch: ({ args, game }) => {
      const [source, dest] = args;
      if (!source || !dest) return game.error(game.t('mv-usage'));
      const n = game.find(source);
      if (!n) return game.error(game.t('mv-missing', { cible: source }));
      // Simplification du jeu : on déplace des objets, jamais des lieux.
      if (n.type === 'dossier') return game.error(game.t('mv-place', { cible: source }));
      if (n.isProtected?.mv) return game.error(n.isProtected.mv);
      const target = destination(game, source, dest);
      const reason = game.block(source) ?? game.block(target + '/..');
      if (reason) return game.error(reason);
      if (game.resolve(source) === target) return '';
      if (!game.writtenIn(source)) return game.error(game.t('mv-permission', { cible: source }));
      const error = game.place('mv', target, n);
      if (error) return game.error(error);
      game.erase(source);
      return '';
    },
  },

  cp: {
    launch: ({ args, game }) => {
      const { letters, rest } = options(args);
      const [source, dest] = rest;
      if (!source || !dest) return game.error(game.t('cp-usage'));
      const n = game.find(source);
      if (!n) return game.error(game.t('cp-missing', { cible: source }));
      if (n.type === 'dossier' && !letters.has('r')) return game.error(game.t('cp-directory', { cible: source }));
      const target = destination(game, source, dest);
      const reason = game.block(source) ?? game.block(target + '/..');
      if (reason) return game.error(reason);
      if (game.resolve(source) === target) return game.error(game.t('cp-same-file', { source, destination: dest }));
      if (!game.traverses(source) || !game.can(n, 'r')) return game.error(game.t('cp-read-permission', { cible: source }));
      const error = game.place('cp', target, copy(n, game.who));
      return error ? game.error(error) : '';
    },
  },

  rm: {
    launch: ({ args, game }) => {
      if (!args.length) return game.error(game.t('rm-usage'));
      for (const target of args.filter((a) => !a.startsWith('-'))) {
        // rm efface le lien lui-même, jamais ce qu'il vise.
        const n = game.find(target, false);
        if (!n) game.error(game.t('rm-missing', { cible: target }));
        else if (n.type === 'dossier') game.error(game.t('rm-directory', { cible: target }));
        else if (n.isProtected?.rm) game.error(n.isProtected.rm);
        else if (game.block(target)) game.error(game.block(target)!);
        // Effacer un fichier, c'est modifier le lieu qui le contient : il faut
        // le droit d'écrire dans ce lieu, pas sur le fichier.
        else if (!game.writtenIn(target)) game.error(game.t('rm-permission', { cible: target }));
        else game.erase(target);
      }
      return '';
    },
  },

  // ln : lien symbolique (-s) ou physique. Comme coreutils : si la
  // destination est un lieu, le lien y prend le nom de la cible ; le chemin
  // visé est enregistré tel quel (relatif au lieu du lien, pas au lieu courant).
  ln: {
    launch: ({ args, game }) => {
      const { letters, rest } = options(args);
      if (!rest.length) return game.error(game.t('ln-operand-missing'));
      const [target, dest = '.'] = rest;
      // -n : si la destination est un lien vers un lieu, on remplace le lien
      // au lieu d'entrer dans le lieu (ln -sfn, pour basculer un lien « current »).
      const place = letters.has('n') ? game.find(dest, false) : game.find(dest);
      const path = place?.type === 'dossier' ? `${game.resolve(dest)}/${target.replace(/\/$/, '').split('/').at(-1)}` : game.resolve(dest);
      const shows = place?.type === 'dossier' ? path : dest;
      const symbolic = letters.has('s');
      const what = symbolic ? 'ln-impossible-symbolic' : 'ln-impossible-physical';
      if (game.find(path, false)) {
        if (!letters.has('f')) return game.error(game.t(what, { cible: shows, raison: game.t('ln-exists') }));
        if (!game.writtenIn(path)) return game.error(game.t(what, { cible: shows, raison: game.t('ln-permission') }));
        game.erase(path);
      }
      if (!symbolic) {
        const source = game.find(target);
        if (!source) return game.error(game.t('ln-access-impossible', { cible: target }));
        if (source.type === 'dossier') return game.error(game.t('ln-physical-directory', { cible: target }));
      }
      if (game.find(path + '/..')?.type !== 'dossier') return game.error(game.t(what, { cible: shows, raison: game.t('ln-missing') }));
      if (!game.writtenIn(path)) return game.error(game.t(what, { cible: shows, raison: game.t('ln-permission') }));
      // Un lien physique est un deuxième nom pour le même fichier : le même nœud.
      const node: Node = symbolic ? { type: 'fichier', content: '', link: target, owner: game.who } : game.find(target)!;
      const parent = game.find(path + '/..');
      if (parent?.type === 'dossier') parent.children[game.name(path)] = node;
      return letters.has('v') ? `'${shows}' -> '${target}'` : '';
    },
  },

  touch: {
    launch: ({ args, game }) => {
      if (!args.length) return game.error(game.t('touch-usage'));
      for (const target of args) {
        if (game.exists(target)) continue;
        const error = game.place('touch', target, { type: 'fichier', content: '', owner: game.who });
        if (error) game.error(error);
      }
      return '';
    },
  },

  mkdir: {
    launch: ({ args, game }) => {
      // -p : crée aussi les lieux parents, sans erreur s'ils existent déjà.
      const parents = args.includes('-p') || args.includes('--parents');
      const targets = args.filter((a) => a !== '-p' && a !== '--parents');
      if (!targets.length) return game.error(game.t('mkdir-usage'));
      for (const target of targets) {
        if (parents) {
          const chunks = game.resolve(target).split('/').filter(Boolean);
          for (let i = 1; i <= chunks.length; i++) {
            const path = '/' + chunks.slice(0, i).join('/');
            const n = game.find(path);
            if (n?.type === 'dossier') continue;
            const error = n ? game.t('mkdir-exists', { cible: path }) : game.place('mkdir', path, { type: 'dossier', children: {}, owner: game.who });
            if (error) {
              game.error(error);
              break;
            }
          }
        } else if (game.exists(target)) game.error(game.t('mkdir-exists', { cible: target }));
        else {
          const error = game.place('mkdir', target, { type: 'dossier', children: {}, owner: game.who });
          if (error) game.error(error);
        }
      }
      return '';
    },
  },

  chmod: {
    // -R (récursif) ; les autres arguments qui commencent par « - » sont des
    // modes (chmod -w fichier), comme pour le vrai chmod.
    ownOptions: true,
    launch: ({ args, game }) => {
      const recursive = args.some((a) => a === '-R' || a === '--recursive');
      const [rights, ...targets] = args.filter((a) => a !== '-R' && a !== '--recursive');
      if (!rights || !targets.length) return game.error(game.t('chmod-usage'));
      const apply = (n: Node) => {
        const fresh = applyMode(modeFor(n), rights);
        if (fresh) n.mode = fresh;
        if (recursive && n.type === 'dossier') Object.values(n.children).forEach(apply);
        return fresh;
      };
      for (const target of targets) {
        const n = game.find(target);
        if (!n) game.error(game.t('chmod-access-missing', { cible: target }));
        else if (!game.traverses(target)) game.error(game.t('chmod-access-permission', { cible: target }));
        else if (game.who !== 'root' && (n.owner ?? game.player) !== game.who) game.error(game.t('chmod-not-allowed', { cible: target }));
        else if (!applyMode(modeFor(n), rights)) game.error(game.t('chmod-mode-incorrect', { droits: rights }));
        else apply(n);
      }
      return '';
    },
  },

  find: {
    launch: ({ args, game }) => {
      const departure = args[0] && !args[0].startsWith('-') ? args[0] : '.';
      const crit = args[0] && !args[0].startsWith('-') ? args.slice(1) : args;
      let name: RegExp | null = null;
      let type: string | null = null;
      let erase = false;
      // -mtime +N : modifié il y a plus de N jours (l'âge en jours entiers, comme find) ; -N : moins ; N : exactement.
      let age: { sign: string; days: number } | null = null;
      let depth = Infinity;
      for (let i = 0; i < crit.length; i++) {
        if (crit[i] === '-name') name = wildcard(crit[++i] ?? '');
        else if (crit[i] === '-type') type = crit[++i] ?? null;
        else if (crit[i] === '-delete') erase = true;
        else if (crit[i] === '-print') continue;
        else if (crit[i] === '-maxdepth') {
          const v = crit[++i] ?? '';
          if (!/^\d+$/.test(v)) return game.error(game.t('find-argument-numeric', { predicat: '-maxdepth', valeur: v }));
          depth = Number(v);
        } else if (crit[i] === '-mtime') {
          const v = crit[++i] ?? '';
          const m = /^([+-]?)(\d+)$/.exec(v);
          if (!m) return game.error(game.t('find-argument-numeric', { predicat: '-mtime', valeur: v }));
          age = { sign: m[1], days: Number(m[2]) };
        } else return game.error(game.t('find-predicate-unknown', { predicat: crit[i] }));
      }
      const now: number = game.state.systemd?.clock ?? 0;
      const ageOk = (e: Node) => {
        if (!age) return true;
        const days = e.type === 'fichier' && e.mtime !== undefined ? Math.floor((now - e.mtime) / 86_400_000) : 0;
        return age.sign === '+' ? days > age.days : age.sign === '-' ? days < age.days : days === age.days;
      };
      const n = game.find(departure);
      if (!n) return game.error(game.t('find-missing', { cible: departure }));
      const found: string[] = [];
      const walk = (path: string, e: Node, level: number) => {
        const kept = (!name || name.test(path.split('/').pop()!)) && (!type || (type === 'd') === (e.type === 'dossier')) && ageOk(e);
        if (kept) found.push(path);
        if (e.type !== 'dossier' || level >= depth) return;
        if (!game.can(e, 'r') || !game.can(e, 'x')) return void game.error(game.t('find-permission', { cible: path }));
        for (const [k, child] of Object.entries(e.children).sort(([a], [b]) => compareNames(a, b)))
          walk(`${path.replace(/\/$/, '')}/${k}`, child, level + 1);
      };
      walk(departure, n, 0);
      if (!erase) return found.join('\n');
      for (const path of found.reverse()) {
        const e = game.find(path)!;
        if (e.type === 'dossier' && Object.keys(e.children).length) game.error(game.t('find-remove-not-empty', { cible: path }));
        else if (!game.writtenIn(path)) game.error(game.t('find-remove-permission', { cible: path }));
        else game.erase(path);
      }
      return '';
    },
  },

  du: {
    launch: ({ args, game }) => {
      // --inodes : compter les fichiers (et lieux) au lieu des octets ; -d N (--max-depth=N) : n'afficher que N niveaux.
      const inodes = args.includes('--inodes');
      let depth = Infinity;
      const raw: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--inodes') continue;
        if (args[i] === '-d') depth = Number(args[++i]);
        else if (args[i].startsWith('--max-depth=')) depth = Number(args[i].slice(12));
        else raw.push(args[i]);
      }
      if (Number.isNaN(depth)) return game.error(game.t('depth'));
      const { letters, rest } = options(raw);
      const fmt = (o: number) => (inodes ? String(o) : letters.has('h') ? readable(o, game.t.language) : String(Math.ceil(o / 1024)));
      const lines: string[] = [];
      // Comme du : un fichier qui a plusieurs noms (liens physiques) n'est compté qu'une fois.
      const seen = new Set<Node>();
      const walk = (path: string, e: Node, level = 0): number => {
        if (e.type === 'fichier') {
          if (seen.has(e)) return 0;
          seen.add(e);
          return inodes ? 1 : sizeFor(e, game);
        }
        let total = inodes ? 1 : 0;
        for (const [k, child] of Object.entries(e.children)) total += walk(`${path.replace(/\/$/, '')}/${k}`, child, level + 1);
        if (!letters.has('s') && level <= depth) lines.push(`${fmt(total)}\t${path}`);
        return total;
      };
      for (const target of rest.length ? rest : ['.']) {
        const n = game.find(target);
        if (!n) {
          game.error(game.t('missing', { cible: target }));
          continue;
        }
        const total = walk(target, n);
        if (letters.has('s') || n.type === 'fichier') lines.push(`${fmt(total)}\t${target}`);
      }
      return lines.join('\n');
    },
  },

  df: {
    launch: ({ args, game }) => {
      const { letters, rest } = options(args);
      const fmt = (o: number) => (letters.has('h') ? readable(o, game.t.language) : String(Math.ceil(o / 1024)));
      const mounts: { path: string; capacity: number; name: string; inodes?: number; inodesBase?: number }[] = game.state.mounts ?? [];
      const chosen = (rest.length ? rest.map((r) => game.mount(game.resolve(r))).filter(Boolean) : mounts) as typeof mounts;
      // -i : les inodes (un par fichier ou lieu) au lieu des octets.
      if (letters.has('i')) {
        // -h avec -i : 64K plutôt que 65536, comme GNU df -ih.
        const n = (v: number) => (letters.has('h') ? readable(v, game.t.language) : String(v));
        const iLines = [game.t('df-header-inodes')];
        for (const m of chosen) {
          const total = m.inodes ?? Math.round(m.capacity / 16384);
          const taken = Math.min(total, game.usedInodes(m));
          const pct = Math.ceil((100 * taken) / total);
          iLines.push(
            `${(m.name ?? m.path).padEnd(18)} ${n(total).padStart(7)} ${n(taken).padStart(7)} ${n(total - taken).padStart(7)} ${String(pct).padStart(4)}% ${m.path}`,
          );
        }
        return iLines.join('\n');
      }
      const lines = [game.t('df-header')];
      for (const m of chosen) {
        const place = game.find(m.path);
        // Les fichiers effacés mais encore ouverts par un processus occupent toujours leur place.
        // Sans compter les autres supports montés dedans (/srv/radio n'est pas sur /).
        const inside = mounts.filter((x) => x.path !== m.path && (m.path === '/' || x.path.startsWith(m.path + '/')));
        const other = inside.reduce((t, x) => t + ((n) => (n ? game.size(n) : 0))(game.find(x.path)), 0);
        const inUse = Math.min(m.capacity, (place ? game.size(place) : 0) - other + ghostPlace(game, m.path));
        const pct = Math.round((100 * inUse) / m.capacity);
        lines.push(
          `${(m.name ?? m.path).padEnd(18)} ${fmt(m.capacity).padStart(6)} ${fmt(inUse).padStart(7)} ${fmt(Math.max(0, m.capacity - inUse)).padStart(6)} ${String(pct).padStart(3)}% ${m.path}`,
        );
      }
      return lines.join('\n');
    },
  },

  tar: {
    launch: ({ args, game }) => {
      // -C lieu (ou --directory=lieu) : se placer dans ce lieu avant d'extraire.
      let cPlace = '';
      const withoutC: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-C') cPlace = args[++i] ?? '';
        else if (args[i].startsWith('--directory=')) cPlace = args[i].slice('--directory='.length);
        else withoutC.push(args[i]);
      }
      const { letters, rest } = options(withoutC);
      if (!letters.has('f') || !rest.length) return game.error(game.t('tar-usage'));
      const [archiveName, ...sources] = rest;
      if (letters.has('c')) {
        if (!sources.length) return game.error(game.t('tar-archive-empty'));
        const files: Record<string, File> = {};
        const add = (path: string, e: Node) => {
          if (e.type === 'fichier') {
            if (!game.can(e, 'r')) return void game.error(game.t('error-permission', { commande: 'tar', cible: path }));
            files[path] = { ...e, read: undefined } as File;
          } else for (const [k, child] of Object.entries(e.children)) add(`${path.replace(/\/$/, '')}/${k}`, child);
        };
        for (const s of sources) {
          const e = game.find(s);
          if (!e) game.error(game.t('error-missing', { commande: 'tar', cible: s }));
          else add(s.replace(/^\.?\/+/, ''), e);
        }
        const compressed = letters.has('z');
        // Taille : 512 octets d'en-tête par fichier ; gzip réduit beaucoup le
        // texte (environ au tiers) et presque pas les images, sons et vidéos,
        // déjà compressés.
        const already = /\.(png|jpe?g|gif|webp|mp3|ogg|mp4|webm|zip|gz|pdf)$/i;
        const size = Object.entries(files).reduce((t, [path, f]) => {
          const raw = sizeFor(f, game);
          return t + 512 + (compressed ? Math.round(raw * (already.test(path) ? 0.98 : 0.35)) : raw);
        }, 0);
        const archive: File = { type: 'fichier', content: '', size, owner: game.who, archive: { files, compressed } };
        const error = game.place('tar', archiveName, archive);
        if (error) return game.error(error);
        return letters.has('v') ? Object.keys(files).join('\n') : '';
      }
      const n = game.find(archiveName);
      if (!n) return game.error(game.t('tar-open-impossible', { cible: archiveName }));
      if (n.type !== 'fichier' || !n.archive) return game.error(game.t('tar-not-one-archive', { cible: archiveName }));
      // Une archive coupée (disque plein, machine éteinte pendant l'écriture) :
      // tar lit ce qui précède la coupure, puis s'arrête sur une erreur.
      const { truncated } = n.archive;
      const inputs = Object.entries(n.archive.files).slice(0, truncated);
      const cut = () => {
        game.state.truncatedArchive = game.resolve(archiveName);
        game.error(game.t('tar-truncated'));
      };
      if (letters.has('t')) {
        const listing = inputs.map(([path]) => path).join('\n');
        if (truncated === undefined) return listing;
        // La liste, puis l'erreur à l'endroit de la coupure.
        game.state.truncatedArchive = game.resolve(archiveName);
        return game.error([listing, game.t('tar-truncated')].filter(Boolean).join('\n'));
      }
      if (letters.has('x')) {
        const base = cPlace || '.';
        if (cPlace) {
          const l = game.find(cPlace);
          if (!l || l.type !== 'dossier') return game.error(game.t('tar-place-missing', { cible: cPlace }));
        }
        const inside = (path: string) => `${base.replace(/\/$/, '')}/${path}`;
        for (const [path, f] of inputs) {
          const parts = path.split('/');
          let place = '';
          for (const p of parts.slice(0, -1)) {
            place = place ? `${place}/${p}` : p;
            if (!game.exists(inside(place))) game.place('tar', inside(place), { type: 'dossier', children: {}, owner: game.who });
          }
          // root garde le propriétaire et les droits enregistrés dans l'archive ;
          // les autres deviennent propriétaires de ce qu'ils extraient.
          const error = game.place('tar', inside(path), game.who === 'root' ? { ...f } : { ...f, owner: game.who, group: undefined });
          if (error) game.error(error);
        }
        if (truncated !== undefined) cut();
        return '';
      }
      return game.error(game.t('tar-option-missing'));
    },
  },
};
