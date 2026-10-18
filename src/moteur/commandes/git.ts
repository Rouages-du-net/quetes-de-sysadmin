// git simulé : un dépôt garde des « commits », c'est-à-dire des photos de
// tous les fichiers suivis, avec un message, un auteur et une date. Les
// messages reprennent ceux de git en français.
//
// Écarts volontaires : une seule branche (main) ; seuls les fichiers placés
// directement dans le dossier du dépôt sont suivis (pas de sous-dossiers) ;
// les identifiants sont calculés par le jeu (git utilise SHA-1 ou SHA-256) ;
// git commit sans -m ouvrirait un éditeur de texte : ici, -m est obligatoire.
//
//   etat.git = { '/chemin/du/depot': Depot }
//   etat.auteur = 'Nom <adresse>' ; etat.date = 'Tue Oct 13 21:04:00 2026 +0200'

import type { Dossier, Fichier } from '../monde';
import type { Shell } from '../shell';
import { contenu } from '../outils';
import type { Commande } from './index';

export interface Commit {
  id: string;
  parent: string | null;
  message: string;
  auteur: string;
  date: string;
  fichiers: Record<string, string>;
}
export interface Depot {
  commits: Commit[];
  index: Record<string, string>;
}

// Empreinte déterministe (FNV-1a), étirée sur 40 chiffres hexadécimaux.
export function empreinte(texte: string): string {
  let sortie = '';
  for (let tour = 0; sortie.length < 40; tour++) {
    let h = 0x811c9dc5;
    for (const c of `${texte}|${tour}`) {
      h ^= c.codePointAt(0)!;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    sortie += h.toString(16).padStart(8, '0');
  }
  return sortie.slice(0, 40);
}

export function nouveauCommit(parent: Commit | null, message: string, auteur: string, date: string, fichiers: Record<string, string>): Commit {
  const id = empreinte(JSON.stringify([parent?.id ?? null, message, auteur, date, fichiers]));
  return { id, parent: parent?.id ?? null, message, auteur, date, fichiers: { ...fichiers } };
}

// Diff ligne à ligne (plus longue sous-suite commune), au format unifié,
// avec tout le fichier comme contexte (les fichiers du jeu sont courts).
export function diff(nom: string, avant: string | null, apres: string | null): string {
  if (avant === apres) return '';
  const a = avant === null || avant === '' ? [] : avant.split('\n');
  const b = apres === null || apres === '' ? [] : apres.split('\n');
  const l = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) l[i][j] = a[i] === b[j] ? l[i + 1][j + 1] + 1 : Math.max(l[i + 1][j], l[i][j + 1]);
  const lignes: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lignes.push(' ' + a[i]);
      i++;
      j++;
    } else if (i < a.length && (j === b.length || l[i + 1][j] >= l[i][j + 1])) lignes.push('-' + a[i++]);
    else lignes.push('+' + b[j++]);
  }
  return [
    `diff --git a/${nom} b/${nom}`,
    `--- ${avant === null ? '/dev/null' : 'a/' + nom}`,
    `+++ ${apres === null ? '/dev/null' : 'b/' + nom}`,
    `@@ -1,${a.length} +1,${b.length} @@`,
    ...lignes,
  ].join('\n');
}

function compte(avant: Record<string, string>, apres: Record<string, string>) {
  let fichiers = 0;
  let plus = 0;
  let moins = 0;
  for (const nom of new Set([...Object.keys(avant), ...Object.keys(apres)])) {
    const d = diff(nom, avant[nom] ?? null, apres[nom] ?? null);
    if (!d) continue;
    fichiers++;
    for (const l of d.split('\n').slice(4)) {
      if (l.startsWith('+')) plus++;
      else if (l.startsWith('-')) moins++;
    }
  }
  return { fichiers, plus, moins };
}

// Le dépôt qui contient le lieu courant (on remonte vers la racine).
function depotIci(jeu: Shell): { chemin: string; depot: Depot } | null {
  const depots: Record<string, Depot> = jeu.etat.git ?? {};
  let chemin = jeu.cwd;
  for (;;) {
    if (depots[chemin] && jeu.existe(`${chemin}/.git`)) return { chemin, depot: depots[chemin] };
    if (chemin === '/') return null;
    chemin = chemin.replace(/\/[^/]+$/, '') || '/';
  }
}

// Les fichiers de la copie de travail (directement dans le dossier du dépôt).
function travail(jeu: Shell, chemin: string): Record<string, string> {
  const lieu = jeu.trouver(chemin) as Dossier;
  return Object.fromEntries(
    Object.entries(lieu.enfants)
      .filter(([nom, n]) => n.type === 'fichier' && !nom.startsWith('.'))
      .map(([nom, n]) => [nom, contenu(n as Fichier, jeu)]),
  );
}

const tete = (d: Depot) => d.commits.at(-1) ?? null;

// HEAD, HEAD~2, HEAD^, main, ou le début d'un identifiant (4 caractères au moins).
function trouverCommit(d: Depot, ref: string): Commit | null {
  const m = /^(HEAD|main)((?:~\d*|\^+)*)$/.exec(ref);
  if (m) {
    let recul = 0;
    for (const p of m[2].match(/~\d*|\^/g) ?? []) recul += p === '^' ? 1 : Number(p.slice(1) || 1);
    return d.commits[d.commits.length - 1 - recul] ?? null;
  }
  if (ref.length < 4) return null;
  const trouves = d.commits.filter((c) => c.id.startsWith(ref));
  return trouves.length === 1 ? trouves[0] : null;
}

function ecrire(jeu: Shell, chemin: string, texte: string): string | null {
  const n = jeu.trouver(chemin);
  if (n?.type === 'fichier') {
    if (!jeu.peut(n, 'w')) return `error: impossible d'ouvrir '${jeu.nom(chemin)}' : Permission non accordée`;
    n.contenu = texte;
    delete n.taille;
    return null;
  }
  return jeu.placer('git', chemin, { type: 'fichier', contenu: texte, proprio: jeu.qui, lignes: true });
}

const PAS_DE_DEPOT = "fatal: ni ceci ni aucun de ses répertoires parents n'est un dépôt git : .git";

const SOUS: Record<string, (jeu: Shell, args: string[]) => string> = {
  init: (jeu) => {
    const depots: Record<string, Depot> = (jeu.etat.git ??= {});
    const chemin = jeu.cwd;
    if (depots[chemin]) return `Dépôt Git existant réinitialisé dans ${chemin}/.git/`;
    const erreur = jeu.placer('git', `${chemin}/.git`, {
      type: 'dossier',
      proprio: jeu.qui,
      enfants: { HEAD: { type: 'fichier', contenu: 'ref: refs/heads/main', lignes: true } },
    });
    if (erreur) return jeu.erreur(erreur);
    depots[chemin] = { commits: [], index: {} };
    return `Dépôt Git vide initialisé dans ${chemin}/.git/`;
  },

  status: (jeu) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(PAS_DE_DEPOT);
    const { depot } = ici;
    const head = tete(depot)?.fichiers ?? {};
    const w = travail(jeu, ici.chemin);
    const indexes: string[] = [];
    const nonIndexes: string[] = [];
    const nonSuivis: string[] = [];
    for (const nom of Object.keys({ ...head, ...depot.index }).sort()) {
      if (!(nom in depot.index)) indexes.push(`\tsupprimé :        ${nom}`);
      else if (!(nom in head)) indexes.push(`\tnouveau fichier : ${nom}`);
      else if (head[nom] !== depot.index[nom]) indexes.push(`\tmodifié :         ${nom}`);
    }
    for (const nom of Object.keys(depot.index).sort()) {
      if (!(nom in w)) nonIndexes.push(`\tsupprimé :        ${nom}`);
      else if (w[nom] !== depot.index[nom]) nonIndexes.push(`\tmodifié :         ${nom}`);
    }
    for (const nom of Object.keys(w).sort()) if (!(nom in depot.index)) nonSuivis.push(`\t${nom}`);
    const blocs = ['Sur la branche main'];
    if (!depot.commits.length) blocs.push('\nAucun commit');
    if (indexes.length)
      blocs.push('\nModifications qui seront validées :\n  (utilisez "git restore --staged <fichier>..." pour désindexer)\n' + indexes.join('\n'));
    if (nonIndexes.length)
      blocs.push(
        '\nModifications qui ne seront pas validées :\n  (utilisez "git add <fichier>..." pour mettre à jour ce qui sera validé)\n  (utilisez "git restore <fichier>..." pour annuler les modifications dans le répertoire de travail)\n' +
          nonIndexes.join('\n'),
      );
    if (nonSuivis.length)
      blocs.push('\nFichiers non suivis :\n  (utilisez "git add <fichier>..." pour inclure dans ce qui sera validé)\n' + nonSuivis.join('\n'));
    if (!indexes.length && !nonIndexes.length && !nonSuivis.length) blocs.push('rien à valider, la copie de travail est propre');
    else if (!indexes.length)
      blocs.push(
        nonSuivis.length && !nonIndexes.length
          ? '\naucune modification ajoutée à la validation mais des fichiers non suivis sont présents (utilisez "git add" pour les suivre)'
          : '\naucune modification n\'a été ajoutée à la validation (utilisez "git add")',
      );
    return blocs.join('\n');
  },

  add: (jeu, args) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(PAS_DE_DEPOT);
    if (!args.length) return jeu.erreur('Rien de spécifié, rien n\'a été ajouté.\n(par exemple : git add roman.txt, ou git add . pour tout)');
    const w = travail(jeu, ici.chemin);
    const tous = args.includes('.') || args.includes('-A') || args.includes('--all');
    const noms = tous ? [...new Set([...Object.keys(w), ...Object.keys(ici.depot.index)])] : args.map((a) => jeu.nom(a));
    for (const nom of noms) {
      if (nom in w) ici.depot.index[nom] = w[nom];
      else if (nom in ici.depot.index) delete ici.depot.index[nom];
      else return jeu.erreur(`fatal: le chemin '${nom}' ne correspond à aucun fichier`);
    }
    return '';
  },

  commit: (jeu, args) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(PAS_DE_DEPOT);
    const i = args.indexOf('-m');
    const message = i >= 0 ? args[i + 1] : undefined;
    if (!message)
      return jeu.erreur('Écrire le message avec -m, entre guillemets : git commit -m "Ce que j’ai changé"\n(le vrai git ouvrirait un éditeur de texte)');
    const parent = tete(ici.depot);
    const avant = parent?.fichiers ?? {};
    const { fichiers, plus, moins } = compte(avant, ici.depot.index);
    if (!fichiers) return jeu.erreur('Sur la branche main\nrien à valider (utilisez "git add" pour indiquer ce qu’il faut valider)');
    const c = nouveauCommit(parent, message, jeu.etat.auteur ?? 'vous <vous@example.org>', jeu.etat.date ?? 'Tue Oct 13 21:04:00 2026 +0200', ici.depot.index);
    ici.depot.commits.push(c);
    const pluriel = (n: number, s: string, p: string) => `${n} ${n > 1 ? p : s}`;
    // Comme git : on ne mentionne pas les insertions ou suppressions nulles.
    const bilan = [
      pluriel(fichiers, 'fichier modifié', 'fichiers modifiés'),
      ...(plus ? [pluriel(plus, 'insertion(+)', 'insertions(+)')] : []),
      ...(moins ? [pluriel(moins, 'suppression(-)', 'suppressions(-)')] : []),
    ].join(', ');
    return `[main${parent ? '' : ' (commit racine)'} ${c.id.slice(0, 7)}] ${message}\n ${bilan}`;
  },

  log: (jeu, args) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(PAS_DE_DEPOT);
    if (!ici.depot.commits.length) return jeu.erreur("fatal: votre branche actuelle 'main' ne contient encore aucun commit");
    const court = args.includes('--oneline');
    return [...ici.depot.commits]
      .reverse()
      .map((c, i) =>
        court
          ? `${c.id.slice(0, 7)} ${i === 0 ? '(HEAD -> main) ' : ''}${c.message}`
          : `commit ${c.id}${i === 0 ? ' (HEAD -> main)' : ''}\nAuthor: ${c.auteur}\nDate:   ${c.date}\n\n    ${c.message}`,
      )
      .join(court ? '\n' : '\n\n');
  },

  diff: (jeu, args) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(PAS_DE_DEPOT);
    const { depot } = ici;
    const w = travail(jeu, ici.chemin);
    const indexe = args.includes('--staged') || args.includes('--cached');
    const mots = args.filter((a) => !a.startsWith('-'));
    let avant: Record<string, string> = depot.index;
    let apres: Record<string, string> = w;
    let reste = mots;
    if (indexe) {
      avant = tete(depot)?.fichiers ?? {};
      apres = depot.index;
    } else if (mots[0] && !jeu.existe(`${ici.chemin}/${mots[0]}`)) {
      const c = trouverCommit(depot, mots[0]);
      if (!c) return jeu.erreur(`fatal: argument '${mots[0]}' ambigu : révision inconnue ou chemin inexistant.`);
      avant = c.fichiers;
      reste = mots.slice(1);
    }
    const noms = reste.length ? reste.map((r) => jeu.nom(r)) : [...new Set([...Object.keys(avant), ...Object.keys(apres)])].sort();
    // Sans --staged, git diff ne montre pas les fichiers non suivis.
    return noms
      .filter((n) => indexe || n in avant)
      .map((n) => diff(n, avant[n] ?? null, apres[n] ?? null))
      .filter(Boolean)
      .join('\n');
  },

  show: (jeu, args) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(PAS_DE_DEPOT);
    const c = trouverCommit(ici.depot, args[0] ?? 'HEAD');
    if (!c) return jeu.erreur(`fatal: argument '${args[0]}' ambigu : révision inconnue ou chemin inexistant.`);
    const parent = c.parent ? ici.depot.commits.find((p) => p.id === c.parent)!.fichiers : {};
    const noms = [...new Set([...Object.keys(parent), ...Object.keys(c.fichiers)])].sort();
    return [
      `commit ${c.id}\nAuthor: ${c.auteur}\nDate:   ${c.date}\n\n    ${c.message}\n`,
      ...noms.map((n) => diff(n, parent[n] ?? null, c.fichiers[n] ?? null)).filter(Boolean),
    ].join('\n');
  },

  restore: (jeu, args) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(PAS_DE_DEPOT);
    const source = args.find((a) => a.startsWith('--source='))?.slice(9);
    const indexe = args.includes('--staged');
    const noms = args.filter((a) => !a.startsWith('-')).map((a) => jeu.nom(a));
    if (!noms.length) return jeu.erreur('fatal: vous devez spécifier un ou plusieurs chemins à restaurer');
    let depuis: Record<string, string> = ici.depot.index;
    if (source) {
      const c = trouverCommit(ici.depot, source);
      if (!c) return jeu.erreur(`fatal: référence invalide : ${source}`);
      depuis = c.fichiers;
    } else if (indexe) depuis = tete(ici.depot)?.fichiers ?? {};
    for (const nom of noms) {
      if (!(nom in depuis)) return jeu.erreur(`error: la spécification de chemin '${nom}' ne correspond à aucun fichier connu de git`);
      if (indexe) ici.depot.index[nom] = depuis[nom];
      else {
        const erreur = ecrire(jeu, `${ici.chemin}/${nom}`, depuis[nom]);
        if (erreur) return jeu.erreur(erreur);
      }
    }
    return '';
  },

  // git checkout ID -- fichier : l'ancienne façon de restaurer un fichier.
  checkout: (jeu, args) => {
    const sep = args.indexOf('--');
    if (sep < 0) return jeu.erreur('Dans ce jeu, git checkout sert à restaurer un fichier : git checkout ID -- fichier\n(on préfère aujourd’hui : git restore --source=ID fichier)');
    const ref = args.slice(0, sep)[0];
    return SOUS.restore(jeu, [...(ref ? [`--source=${ref}`] : []), ...args.slice(sep + 1)]);
  },
};

export const GIT: Record<string, Commande> = {
  git: {
    manuel: `git commande — garde l'historique d'un dossier (un « dépôt »). Les principales commandes :
  git init                    transforme le lieu en dépôt
  git status                  ce qui a changé depuis le dernier commit
  git add fichier (ou .)      prépare un fichier pour le prochain commit
  git commit -m "message"     enregistre une photo de tous les fichiers préparés
  git log [--oneline]         l'historique des commits
  git diff [ID] [fichier]     les différences (- avant, + après)
  git show [ID]               un commit et ses changements
  git restore --source=ID f   remet le fichier f tel qu'il était dans le commit ID
Un commit se désigne par le début de son identifiant (au moins 4 caractères), ou par HEAD (le dernier), HEAD~1 (l'avant-dernier)…`,
    lancer: ({ args, jeu }) => {
      const [sous, ...reste] = args;
      if (!sous) return jeu.erreur('usage : git <commande> [<args>]\n(voir man git)');
      const f = SOUS[sous];
      if (!f) return jeu.erreur(`git : '${sous}' n'est pas une commande git (dans ce jeu : ${Object.keys(SOUS).join(', ')}).`);
      return f(jeu, reste);
    },
  },
};
