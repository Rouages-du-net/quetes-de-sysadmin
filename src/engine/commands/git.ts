// git simulé : un dépôt garde des « commits », c'est-à-dire des photos de
// tous les fichiers suivis, avec un message, un auteur et une date. Les
// messages reprennent ceux de git en français.
//
// Les dépôts distants sont des dossiers de la machine (dépôts nus, créés
// par git init --bare) : git push y envoie les commits et lance leurs
// crochets (hooks/pre-receive, hooks/post-receive), interprétés par
// script.ts ; git --work-tree=lieu checkout -f y extrait les fichiers
// (https://git-scm.com/book/fr/v2/Git-sur-le-serveur-Mise-en-place-du-serveur,
// https://git-scm.com/docs/githooks).
//
// Écarts volontaires : une seule branche (main) ; seuls les fichiers placés
// directement dans le dossier du dépôt sont suivis (pas de sous-dossiers) ;
// les identifiants sont calculés par le jeu (git utilise SHA-1 ou SHA-256) ;
// git commit sans -m ouvrirait un éditeur de texte : ici, -m est obligatoire ;
// pas de dépôt distant par le réseau (ssh://, https://), seulement des chemins.
//
//   etat.git = { '/chemin/du/depot': Depot } (un dépôt nu : son propre dossier)
//   etat.auteur = 'Nom <adresse>' ; etat.date = 'Tue Oct 13 21:04:00 2026 +0200'

import type { Directory, File, Node } from '../world';
import type { Shell } from '../shell';
import { content } from '../tools';
import { runScript } from '../script';
import { systemd } from '../systemd';
import type { Command } from './index';
import { colourise, readColour, sgr } from '../colours';

export interface Commit {
  id: string;
  parent: string | null;
  message: string;
  author: string;
  date: string;
  files: Record<string, string>;
}
export interface Repo {
  commits: Commit[];
  index: Record<string, string>;
  // Un dépôt nu (sans copie de travail), comme ceux d'un serveur.
  bare?: boolean;
  // Les dépôts distants : nom → chemin.
  remotes?: Record<string, string>;
  // Ce que git --work-tree=… checkout a écrit dans chaque lieu (son index).
  excerpts?: Record<string, Record<string, string>>;
}

// Les options générales (git --git-dir=… --work-tree=… -C lieu commande).
let general: { gitDir?: string; workTree?: string; colour?: boolean } = {};

// Les couleurs de git (color.ui=auto, par défaut depuis git 1.8.4) : à l'écran
// seulement ; --color / --no-color sur la sous-commande. Couleurs par défaut
// de git : en-têtes du diff en gras, @@ en cyan, lignes retirées en rouge,
// ajoutées en vert, commits en jaune ; dans status, l'index en vert, le
// reste en rouge. Voir https://git-scm.com/docs/git-config#Documentation/git-config.txt-colordiffltslotgt
const paint = (code: string, text: string) => (general.colour ? sgr(code, text) : text);
function colourDiff(text: string): string {
  return text
    .split('\n')
    .map((l) =>
      /^(diff --git|index |--- |\+\+\+ )/.test(l)
        ? paint('1', l)
        : l.startsWith('@@')
          ? paint('36', l)
          : l.startsWith('-')
            ? paint('31', l)
            : l.startsWith('+')
              ? paint('32', l)
              : /^commit [0-9a-f]{40}/.test(l)
                ? paint('33', l)
                : /^[0-9a-f]{7} /.test(l)
                  ? paint('33', l.slice(0, 7)) + l.slice(7)
                  : l,
    )
    .join('\n');
}

// Empreinte déterministe (FNV-1a), étirée sur 40 chiffres hexadécimaux.
export function fingerprint(text: string): string {
  let output = '';
  for (let turn = 0; output.length < 40; turn++) {
    let h = 0x811c9dc5;
    for (const c of `${text}|${turn}`) {
      h ^= c.codePointAt(0)!;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    output += h.toString(16).padStart(8, '0');
  }
  return output.slice(0, 40);
}

export function newCommit(parent: Commit | null, message: string, author: string, date: string, files: Record<string, string>): Commit {
  const id = fingerprint(JSON.stringify([parent?.id ?? null, message, author, date, files]));
  return { id, parent: parent?.id ?? null, message, author, date, files: { ...files } };
}

// Diff ligne à ligne (plus longue sous-suite commune), au format unifié,
// avec tout le fichier comme contexte (les fichiers du jeu sont courts).
export function diff(name: string, before: string | null, after: string | null): string {
  if (before === after) return '';
  const a = before === null || before === '' ? [] : before.split('\n');
  const b = after === null || after === '' ? [] : after.split('\n');
  const l = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) l[i][j] = a[i] === b[j] ? l[i + 1][j + 1] + 1 : Math.max(l[i + 1][j], l[i][j + 1]);
  const lines: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push(' ' + a[i]);
      i++;
      j++;
    } else if (i < a.length && (j === b.length || l[i + 1][j] >= l[i][j + 1])) lines.push('-' + a[i++]);
    else lines.push('+' + b[j++]);
  }
  return [
    `diff --git a/${name} b/${name}`,
    `--- ${before === null ? '/dev/null' : 'a/' + name}`,
    `+++ ${after === null ? '/dev/null' : 'b/' + name}`,
    `@@ -1,${a.length} +1,${b.length} @@`,
    ...lines,
  ].join('\n');
}

function account(before: Record<string, string>, after: Record<string, string>) {
  let files = 0;
  let more = 0;
  let less = 0;
  for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const d = diff(name, before[name] ?? null, after[name] ?? null);
    if (!d) continue;
    files++;
    for (const l of d.split('\n').slice(4)) {
      if (l.startsWith('+')) more++;
      else if (l.startsWith('-')) less++;
    }
  }
  return { files, more, moins: less };
}

/** Le dépôt d'un chemin (un dépôt nu, ou un dossier qui contient .git). */
export function repoIn(game: Shell, path: string): Repo | null {
  const d: Repo | undefined = game.state.git?.[path];
  return d && (d.bare ? game.exists(path) : game.exists(`${path}/.git`)) ? d : null;
}

// Le dépôt qui contient le lieu courant (on remonte vers la racine), ou celui de --git-dir.
function hereRepo(game: Shell): { path: string; repo: Repo } | null {
  if (general.gitDir) {
    const path = game.resolve(general.gitDir).replace(/\/\.git$/, '');
    const repo = repoIn(game, path);
    return repo ? { path, repo } : null;
  }
  let path = game.cwd;
  for (;;) {
    if (repoIn(game, path)) return { path, repo: repoIn(game, path)! };
    if (path === '/') return null;
    path = path.replace(/\/[^/]+$/, '') || '/';
  }
}

// Les fichiers de la copie de travail (directement dans le dossier du dépôt).
function travail(game: Shell, path: string): Record<string, string> {
  const place = game.find(path) as Directory;
  return Object.fromEntries(
    Object.entries(place.children)
      .filter(([name, n]) => n.type === 'fichier' && !name.startsWith('.'))
      .map(([name, n]) => [name, content(n as File, game)]),
  );
}

const headRef = (d: Repo) => d.commits.at(-1) ?? null;

// Les crochets d'exemple que git init pose dans hooks/ (en .sample).
const EXAMPLES_CROCHETS = [
  'applypatch-msg',
  'commit-msg',
  'post-update',
  'pre-commit',
  'pre-push',
  'pre-rebase',
  'pre-receive',
  'prepare-commit-msg',
  'update',
];
const short = (c: Commit | null) => (c ? c.id.slice(0, 7) : '0000000');

// HEAD, HEAD~2, HEAD^, main, ou le début d'un identifiant (4 caractères au moins).
function findCommit(d: Repo, ref: string): Commit | null {
  const m = /^(HEAD|main)((?:~\d*|\^+)*)$/.exec(ref);
  if (m) {
    let back = 0;
    for (const p of m[2].match(/~\d*|\^/g) ?? []) back += p === '^' ? 1 : Number(p.slice(1) || 1);
    return d.commits[d.commits.length - 1 - back] ?? null;
  }
  if (ref.length < 4) return null;
  const found = d.commits.filter((c) => c.id.startsWith(ref));
  return found.length === 1 ? found[0] : null;
}

function write(game: Shell, path: string, text: string): string | null {
  const n = game.find(path);
  if (n?.type === 'fichier') {
    if (!game.can(n, 'w')) return game.t('git-ecriture-permission', { fichier: game.name(path) });
    n.content = text;
    delete n.size;
    return null;
  }
  return game.place('git', path, { type: 'fichier', content: text, owner: game.who, lines: true });
}

const UNDER: Record<string, (game: Shell, args: string[]) => string> = {
  init: (game, args) => {
    const depots: Record<string, Repo> = (game.state.git ??= {});
    const bare = args.includes('--bare');
    const place = args.find((a) => !a.startsWith('-'));
    const path = place ? game.resolve(place) : game.cwd;
    if (depots[path] && game.exists(path)) return game.t(bare ? 'git-init-existant-nu' : 'git-init-existant', { chemin: path });
    if (place && !game.exists(path)) {
      const error = game.place('git', path, { type: 'dossier', owner: game.who, children: {} });
      if (error) return game.error(game.t('git-init-impossible', { chemin: path }));
    }
    const directory = (children: Record<string, Node> = {}): Node => ({ type: 'dossier', owner: game.who, children });
    const file = (text: string, mode?: string): Node => ({
      type: 'fichier',
      content: text,
      lines: true,
      owner: game.who,
      ...(mode ? { mode } : {}),
    });
    // Ce que contient un dépôt : HEAD, config, les crochets d'exemple (non exécutables : .sample), les objets…
    const inside: Record<string, Node> = {
      HEAD: file('ref: refs/heads/main'),
      config: file(`[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = ${bare}`),
      description: file("Unnamed repository; edit this file 'description' to name the repository."),
      hooks: directory(
        Object.fromEntries(EXAMPLES_CROCHETS.map((h) => [`${h}.sample`, file(`#!/bin/sh\n#\n# An example hook script (${h}).`, 'rwxr-xr-x')])),
      ),
      info: directory({ exclude: file('# git ls-files --others --exclude-from=.git/info/exclude') }),
      objects: directory({ info: directory(), pack: directory() }),
      refs: directory({ heads: directory(), tags: directory() }),
    };
    const gitPlace = bare ? path : `${path}/.git`;
    if (bare) {
      const n = game.find(path);
      if (n?.type !== 'dossier' || !game.writtenIn(`${path}/HEAD`)) return game.error(game.t('git-init-impossible', { chemin: path }));
      Object.assign(n.children, inside);
    } else {
      const error = game.place('git', gitPlace, directory(inside));
      if (error) return game.error(error);
    }
    depots[path] = { commits: [], index: {}, ...(bare ? { bare: true } : {}) };
    return game.t(bare ? 'git-init-vide-nu' : 'git-init-vide', { chemin: path });
  },

  status: (game) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-pas-de-depot'));
    if (here.repo.bare) return game.error(game.t('git-pas-d-arbre'));
    const { repo } = here;
    const head = headRef(repo)?.files ?? {};
    const w = travail(game, here.path);
    const indexes: string[] = [];
    const notIndexes: string[] = [];
    const notTracked: string[] = [];
    const line = (state: string, file: string, code: string) => '\t' + paint(code, game.t(`git-status-${state}`, { fichier: file }));
    for (const name of Object.keys({ ...head, ...repo.index }).sort()) {
      if (!(name in repo.index)) indexes.push(line('supprime', name, '32'));
      else if (!(name in head)) indexes.push(line('nouveau', name, '32'));
      else if (head[name] !== repo.index[name]) indexes.push(line('modifie', name, '32'));
    }
    for (const name of Object.keys(repo.index).sort()) {
      if (!(name in w)) notIndexes.push(line('supprime', name, '31'));
      else if (w[name] !== repo.index[name]) notIndexes.push(line('modifie', name, '31'));
    }
    for (const name of Object.keys(w).sort()) if (!(name in repo.index)) notTracked.push(`\t${paint('31', name)}`);
    const blocks = [game.t('git-status-branche')];
    if (!repo.commits.length) blocks.push('\n' + game.t('git-status-aucun-commit'));
    if (indexes.length) blocks.push('\n' + game.t('git-status-indexes') + '\n' + indexes.join('\n'));
    if (notIndexes.length) blocks.push('\n' + game.t('git-status-non-indexes') + '\n' + notIndexes.join('\n'));
    if (notTracked.length) blocks.push('\n' + game.t('git-status-non-suivis') + '\n' + notTracked.join('\n'));
    if (!indexes.length && !notIndexes.length && !notTracked.length) blocks.push(game.t('git-status-propre'));
    else if (!indexes.length)
      blocks.push('\n' + game.t(notTracked.length && !notIndexes.length ? 'git-status-seulement-non-suivis' : 'git-status-rien-ajoute'));
    return blocks.join('\n');
  },

  add: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-pas-de-depot'));
    if (here.repo.bare) return game.error(game.t('git-pas-d-arbre'));
    if (!args.length) return game.error(game.t('git-add-rien'));
    const w = travail(game, here.path);
    const all = args.includes('.') || args.includes('-A') || args.includes('--all');
    const names = all ? [...new Set([...Object.keys(w), ...Object.keys(here.repo.index)])] : args.map((a) => game.name(a));
    for (const name of names) {
      if (name in w) here.repo.index[name] = w[name];
      else if (name in here.repo.index) delete here.repo.index[name];
      else return game.error(game.t('git-chemin-inconnu', { fichier: name }));
    }
    return '';
  },

  rm: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-pas-de-depot'));
    if (here.repo.bare) return game.error(game.t('git-pas-d-arbre'));
    const keep = args.includes('--cached');
    const names = args.filter((a) => !a.startsWith('-')).map((a) => game.name(a));
    if (!names.length) return game.error(game.t('git-rm-usage'));
    const outputs: string[] = [];
    for (const name of names) {
      if (!(name in here.repo.index)) return game.error(game.t('git-chemin-inconnu', { fichier: name }));
      delete here.repo.index[name];
      // Sans --cached, git rm efface aussi le fichier de la copie de travail.
      if (!keep) delete (game.find(here.path) as Directory).children[name];
      outputs.push(`rm '${name}'`);
    }
    return outputs.join('\n');
  },

  commit: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-pas-de-depot'));
    if (here.repo.bare) return game.error(game.t('git-pas-d-arbre'));
    // -m message, -a (ajouter d'abord les fichiers suivis modifiés), ou les deux : -am.
    const i = args.findIndex((a) => a === '-m' || /^-[a-z]*m$/.test(a));
    const message = i >= 0 ? args[i + 1] : undefined;
    if (!message) return game.error(game.t('git-commit-sans-message'));
    if (args.some((a) => a === '--all' || /^-[a-z]*a[a-z]*$/.test(a))) {
      const w = travail(game, here.path);
      for (const name of Object.keys(here.repo.index)) {
        if (name in w) here.repo.index[name] = w[name];
        else delete here.repo.index[name];
      }
    }
    const parent = headRef(here.repo);
    const before = parent?.files ?? {};
    const { files, more, moins: less } = account(before, here.repo.index);
    if (!files) return game.error(game.t('git-rien-a-valider'));
    const c = newCommit(parent, message, game.state.auteur ?? `${game.player} <${game.player}@example.org>`, game.state.date ?? 'Tue Oct 13 21:04:00 2026 +0200', here.repo.index);
    here.repo.commits.push(c);
    // Comme git : on ne mentionne pas les insertions ou suppressions nulles.
    const summary = [
      game.t('git-commit-fichiers', { nombre: files }),
      ...(more ? [game.t('git-commit-insertions', { nombre: more })] : []),
      ...(less ? [game.t('git-commit-suppressions', { nombre: less })] : []),
    ].join(', ');
    const header = game.t(parent ? 'git-commit-entete' : 'git-commit-entete-racine', { id: c.id.slice(0, 7), message });
    return `${header}\n ${summary}`;
  },

  log: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-pas-de-depot'));
    if (!here.repo.commits.length) return game.error(game.t('git-aucun-commit-branche'));
    const short = args.includes('--oneline');
    return [...here.repo.commits]
      .reverse()
      .map((c, i) =>
        short
          ? `${c.id.slice(0, 7)} ${i === 0 ? '(HEAD -> main) ' : ''}${c.message}`
          : `commit ${c.id}${i === 0 ? ' (HEAD -> main)' : ''}\nAuthor: ${c.author}\nDate:   ${c.date}\n\n    ${c.message}`,
      )
      .join(short ? '\n' : '\n\n');
  },

  diff: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-pas-de-depot'));
    if (here.repo.bare) return game.error(game.t('git-pas-d-arbre'));
    const { repo } = here;
    const w = travail(game, here.path);
    const indexed = args.includes('--staged') || args.includes('--cached');
    const words = args.filter((a) => !a.startsWith('-'));
    let before: Record<string, string> = repo.index;
    let after: Record<string, string> = w;
    let rest = words;
    if (indexed) {
      before = headRef(repo)?.files ?? {};
      after = repo.index;
    } else if (words[0] && !game.exists(`${here.path}/${words[0]}`)) {
      const c = findCommit(repo, words[0]);
      if (!c) return game.error(game.t('git-revision-ambigue', { revision: words[0] }));
      before = c.files;
      rest = words.slice(1);
    }
    const names = rest.length ? rest.map((r) => game.name(r)) : [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    // Sans --staged, git diff ne montre pas les fichiers non suivis.
    return names
      .filter((n) => indexed || n in before)
      .map((n) => diff(n, before[n] ?? null, after[n] ?? null))
      .filter(Boolean)
      .join('\n');
  },

  show: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-pas-de-depot'));
    const c = findCommit(here.repo, args[0] ?? 'HEAD');
    if (!c) return game.error(game.t('git-revision-ambigue', { revision: String(args[0]) }));
    const parent = c.parent ? here.repo.commits.find((p) => p.id === c.parent)!.files : {};
    const names = [...new Set([...Object.keys(parent), ...Object.keys(c.files)])].sort();
    return [
      `commit ${c.id}\nAuthor: ${c.author}\nDate:   ${c.date}\n\n    ${c.message}\n`,
      ...names.map((n) => diff(n, parent[n] ?? null, c.files[n] ?? null)).filter(Boolean),
    ].join('\n');
  },

  restore: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-pas-de-depot'));
    if (here.repo.bare) return game.error(game.t('git-pas-d-arbre'));
    const source = args.find((a) => a.startsWith('--source='))?.slice(9);
    const indexed = args.includes('--staged');
    const names = args.filter((a) => !a.startsWith('-')).map((a) => game.name(a));
    if (!names.length) return game.error(game.t('git-restore-sans-chemin'));
    let since: Record<string, string> = here.repo.index;
    if (source) {
      const c = findCommit(here.repo, source);
      if (!c) return game.error(game.t('git-reference-invalide', { revision: source }));
      since = c.files;
    } else if (indexed) since = headRef(here.repo)?.files ?? {};
    for (const name of names) {
      if (!(name in since)) return game.error(game.t('git-restore-inconnu', { fichier: name }));
      if (indexed) here.repo.index[name] = since[name];
      else {
        const error = write(game, `${here.path}/${name}`, since[name]);
        if (error) return game.error(error);
      }
    }
    return '';
  },

  // git checkout ID -- fichier : l'ancienne façon de restaurer un fichier.
  // git --work-tree=lieu checkout [-f] [main] : extrait les fichiers dans un lieu (déploiement).
  checkout: (game, args) => {
    const sep = args.indexOf('--');
    if (sep >= 0) {
      const ref = args.slice(0, sep)[0];
      return UNDER.restore(game, [...(ref ? [`--source=${ref}`] : []), ...args.slice(sep + 1)]);
    }
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-pas-de-depot'));
    if (!general.workTree) return game.error(game.t(here.repo.bare ? 'git-pas-d-arbre' : 'git-checkout-usage'));
    const force = args.includes('-f') || args.includes('--force');
    const ref = args.find((a) => !a.startsWith('-')) ?? 'HEAD';
    const c = findCommit(here.repo, ref);
    if (!c)
      return game.error(
        here.repo.commits.length ? game.t('git-revision-ambigue', { revision: ref }) : game.t('git-reference-invalide', { revision: ref }),
      );
    const place = game.resolve(general.workTree);
    if (game.find(place)?.type !== 'dossier') return game.error(game.t('git-work-tree-introuvable', { chemin: place }));
    const excerpts = (here.repo.excerpts ??= {});
    const before = excerpts[place];
    // Sans -f, git refuse d'écraser ce qu'il ne connaît pas, ou ce qu'on a modifié à la main.
    if (!force) {
      const overwritten = Object.keys(c.files)
        .sort()
        .filter((name) => {
          const n = game.find(`${place}/${name}`);
          if (n?.type !== 'fichier') return false;
          const here = content(n, game);
          return here !== c.files[name] && (before ? here !== before[name] : true);
        });
      if (overwritten.length)
        return game.error(
          game.t(before ? 'git-checkout-modifications-locales' : 'git-checkout-non-suivis', { fichiers: overwritten.map((f) => `\t${f}`).join('\n') }),
        );
    }
    for (const [name, text] of Object.entries(c.files)) {
      const error = write(game, `${place}/${name}`, text);
      if (error) return game.error(error);
    }
    // Les fichiers suivis qui ont disparu du commit sont effacés.
    const directory = game.find(place) as Directory;
    for (const name of Object.keys(before ?? {})) if (!(name in c.files)) delete directory.children[name];
    excerpts[place] = { ...c.files };
    // Ce qu'un crochet a déployé, et où (pour les objectifs des chapitres).
    if (game.state.gitCrochet) game.state.gitDeploiements = { ...game.state.gitDeploiements, [place]: c.id };
    return '';
  },

  clone: (game, args) => {
    const [source, destination] = args.filter((a) => !a.startsWith('-'));
    if (!source) return game.error(game.t('git-clone-usage'));
    const path = game.resolve(source).replace(/\/$/, '');
    const origin = repoIn(game, path);
    if (!origin) return game.error(game.t('git-distant-introuvable', { depot: source }));
    const name =
      destination ??
      path
        .split('/')
        .at(-1)!
        .replace(/\.git$/, '');
    const target = game.resolve(name);
    if (game.exists(target)) return game.error(game.t('git-clone-existe', { chemin: name }));
    const lines = [game.t('git-clone-dans', { chemin: name })];
    const before = game.cwd;
    const error = game.place('git', target, { type: 'dossier', owner: game.who, children: {} });
    if (error) return game.error(error);
    game.cwd = target;
    try {
      UNDER.init(game, []);
    } finally {
      game.cwd = before;
    }
    const repo = game.state.git[target] as Repo;
    repo.commits = [...origin.commits];
    repo.remotes = { origin: path };
    const h = headRef(repo);
    if (h) {
      repo.index = { ...h.files };
      for (const [f, text] of Object.entries(h.files)) write(game, `${target}/${f}`, text);
      lines.push(game.t('git-fait'));
    } else lines.push(game.t('git-clone-vide'));
    return lines.join('\n');
  },

  remote: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-pas-de-depot'));
    const remotes = (here.repo.remotes ??= {});
    const [action, name, url] = args.filter((a) => a !== '-v' && a !== '--verbose');
    if (!action)
      return Object.entries(remotes)
        .map(([n, u]) => (args.includes('-v') || args.includes('--verbose') ? `${n}\t${u} (fetch)\n${n}\t${u} (push)` : n))
        .join('\n');
    if (action === 'add') {
      if (!name || !url) return game.error(game.t('git-remote-usage'));
      if (remotes[name]) return game.error(game.t('git-remote-existe', { nom: name }));
      remotes[name] = url;
      return '';
    }
    if (action === 'remove' || action === 'rm') {
      if (!name || !remotes[name]) return game.error(game.t('git-remote-inconnu', { nom: name ?? '' }));
      delete remotes[name];
      return '';
    }
    if (action === 'set-url') {
      if (!name || !url) return game.error(game.t('git-remote-usage'));
      if (!remotes[name]) return game.error(game.t('git-remote-inconnu', { nom: name }));
      remotes[name] = url;
      return '';
    }
    if (action === 'get-url') return remotes[name ?? ''] ?? game.error(game.t('git-remote-inconnu', { nom: name ?? '' }));
    return game.error(game.t('git-remote-usage'));
  },

  push: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-pas-de-depot'));
    const [remoteName, branch = 'main'] = args.filter((a) => !a.startsWith('-'));
    const follow = args.includes('-u') || args.includes('--set-upstream');
    const remotes = here.repo.remotes ?? {};
    const name = remoteName ?? (remotes.origin ? 'origin' : undefined);
    if (!name) return game.error(game.t('git-push-sans-destination'));
    const url = remotes[name] ?? name;
    const path = game.resolve(url).replace(/\/$/, '');
    const remote = repoIn(game, path);
    if (!remote) return game.error(game.t('git-distant-introuvable', { depot: url }));
    const refusal = (reason: string) =>
      `${game.t('git-vers', { depot: url })}\n ! [remote rejected] main -> main (${reason})\n${game.t('git-push-impossible', { depot: url })}`;
    if (branch.replace(/^refs\/heads\//, '').replace(/^HEAD$/, 'main') !== 'main' || !here.repo.commits.length)
      return game.error(`${game.t('git-refspec-inconnue', { ref: branch })}\n${game.t('git-push-impossible', { depot: url })}`);
    const before = headRef(remote);
    const local = headRef(here.repo)!;
    if (before?.id === local.id) return game.t('git-tout-a-jour');
    // Le distant a des commits qu'on n'a pas : il faut d'abord les récupérer (git pull).
    if (before && !here.repo.commits.some((c) => c.id === before.id))
      return game.error(
        `${game.t('git-vers', { depot: url })}\n ! [rejected]        main -> main (fetch first)\n${game.t('git-push-impossible', { depot: url })}\n${game.t('git-push-rejete-astuce')}`,
      );
    const fresh = here.repo.commits.length - (before ? here.repo.commits.findIndex((c) => c.id === before.id) + 1 : 0);
    const objets = fresh * 3;
    const lines = game.t('git-push-progression', { objets: String(objets), octets: String(240 + objets * 37) }).split('\n');
    // Écrire dans un dépôt nu : il faut le droit d'écrire dans ses objets.
    const objetsPlace = game.find(`${path}/objects`) ?? game.find(`${path}/.git/objects`);
    if (objetsPlace && !game.can(objetsPlace, 'w')) return game.error([...lines, game.t('git-push-droits'), refusal('unpacker error')].join('\n'));
    // Pousser vers la branche extraite d'un dépôt non nu : refusé (receive.denyCurrentBranch).
    if (!remote.bare) return game.error([...lines, game.t('git-push-branche-extraite'), refusal('branch is currently checked out')].join('\n'));
    // Envoyer prend un peu de temps (l'horloge de la machine avance).
    const sd = systemd(game);
    if (sd) sd.clock += 20_000;
    const remoteRefs: string[] = [];
    const hook = (hookName: string): { code: number } | null => {
      const file = `${path}/hooks/${hookName}`;
      const n = game.find(file);
      if (n?.type !== 'fichier') return null;
      if (!game.can(n, 'x')) {
        remoteRefs.push(...game.t('git-crochet-ignore', { crochet: file }).split('\n'));
        return null;
      }
      const previous = general;
      general = {};
      game.state.gitCrochet = true;
      try {
        const r = runScript(game, content(n, game), {
          cwd: path,
          name: `hooks/${hookName}`,
          input: `${before?.id ?? '0'.repeat(40)} ${local.id} refs/heads/main`,
        });
        if (r.output) remoteRefs.push(...r.output.split('\n'));
        return { code: r.code };
      } finally {
        general = previous;
        game.state.gitCrochet = false;
      }
    };
    const pre = hook('pre-receive');
    const prefix = () => remoteRefs.map((l) => `remote: ${l}`.trimEnd());
    if (pre && pre.code !== 0)
      return game.error(
        [
          ...lines,
          ...prefix(),
          `${game.t('git-vers', { depot: url })}\n ! [remote rejected] main -> main (pre-receive hook declined)`,
          game.t('git-push-impossible', { depot: url }),
        ].join('\n'),
      );
    remote.commits = [...here.repo.commits];
    game.state.gitPoussees = (game.state.gitPoussees ?? 0) + 1;
    hook('post-receive');
    return [
      ...lines,
      ...prefix(),
      game.t('git-vers', { depot: url }),
      before ? `   ${short(before)}..${short(local)}  main -> main` : ' * [new branch]      main -> main',
      ...(follow ? [game.t('git-push-suivi', { distant: name })] : []),
    ].join('\n');
  },

  pull: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-pas-de-depot'));
    if (here.repo.bare) return game.error(game.t('git-pas-d-arbre'));
    const [remoteName] = args.filter((a) => !a.startsWith('-'));
    const name = remoteName ?? (here.repo.remotes?.origin ? 'origin' : undefined);
    if (!name) return game.error(game.t('git-pull-sans-distant'));
    const url = here.repo.remotes?.[name] ?? name;
    const remote = repoIn(game, game.resolve(url).replace(/\/$/, ''));
    if (!remote) return game.error(game.t('git-distant-introuvable', { depot: url }));
    const their = headRef(remote);
    const our = headRef(here.repo);
    const header = [game.t('git-depuis', { depot: url }), ' * branch            main       -> FETCH_HEAD'];
    if (!their || their.id === our?.id || here.repo.commits.some((c) => c.id === their.id)) return [...header, game.t('git-deja-a-jour')].join('\n');
    if (our && !remote.commits.some((c) => c.id === our.id)) return game.error([...header, game.t('git-pull-diverge')].join('\n'));
    const before = our?.files ?? {};
    here.repo.commits = [...remote.commits];
    here.repo.index = { ...their.files };
    for (const [f, text] of Object.entries(their.files)) write(game, `${here.path}/${f}`, text);
    for (const f of Object.keys(before)) if (!(f in their.files)) delete (game.find(here.path) as Directory).children[f];
    const { files, more, moins: less } = account(before, their.files);
    // « index.html | 2 +- », comme git (un + par ligne ajoutée, un - par ligne retirée).
    const names = [...new Set([...Object.keys(before), ...Object.keys(their.files)])]
      .filter((n) => before[n] !== their.files[n])
      .sort()
      .map((n) => {
        const k = account({ [n]: before[n] ?? '' }, { [n]: their.files[n] ?? '' });
        return `${n} | ${k.more + k.moins} ${'+'.repeat(k.more)}${'-'.repeat(k.moins)}`;
      });
    const summary = [
      game.t('git-commit-fichiers', { nombre: files }),
      ...(more ? [game.t('git-commit-insertions', { nombre: more })] : []),
      ...(less ? [game.t('git-commit-suppressions', { nombre: less })] : []),
    ].join(', ');
    return [
      ...header,
      game.t('git-mise-a-jour', { avant: short(our), apres: short(their) }),
      game.t('git-avance-rapide'),
      ...names.map((n) => ` ${n}`),
      ` ${summary}`,
    ].join('\n');
  },
};

export const GIT: Record<string, Command> = {
  git: {
    ownOptions: true,
    launch: (c) => {
      const { args, game } = c;
      // Les options générales, avant la sous-commande.
      const previous = general;
      general = { ...general };
      let i = 0;
      for (; i < args.length && args[i].startsWith('-'); i++) {
        const a = args[i];
        if (a.startsWith('--git-dir=')) general.gitDir = a.slice(10);
        else if (a === '--git-dir') general.gitDir = args[++i];
        else if (a.startsWith('--work-tree=')) general.workTree = a.slice(12);
        else if (a === '--work-tree') general.workTree = args[++i];
        else if (a === '--version') return 'git version 2.47.2';
        else if (a === '--help') return game.t('git-usage');
        else return game.error(game.t('git-option-inconnue', { option: a }));
      }
      const [under, ...raw] = args.slice(i);
      // --color[=QUAND] et --no-color, sur la sous-commande ; par défaut, à l'écran seulement.
      const colour = readColour(raw.filter((a) => a !== '--no-color'), raw.includes('--no-color') ? 'never' : 'auto');
      const rest = colour.args;
      general.colour = colourise(c, colour.when);
      try {
        if (!under) return game.error(game.t('git-usage'));
        const f = UNDER[under];
        if (!f) return game.error(game.t('git-sous-commande-inconnue', { commande: under, commandes: Object.keys(UNDER).join(', ') }));
        const output = f(game, rest);
        return ['diff', 'show', 'log'].includes(under) ? colourDiff(output) : output;
      } finally {
        general = previous;
      }
    },
  },
};
