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

import type { Dossier, Fichier, Noeud } from '../world';
import type { Shell } from '../shell';
import { contenu } from '../tools';
import { executerScript } from '../script';
import { systemd } from '../systemd';
import type { Commande } from './index';
import { colorer, lireCouleur, sgr } from '../colours';

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
  // Un dépôt nu (sans copie de travail), comme ceux d'un serveur.
  nu?: boolean;
  // Les dépôts distants : nom → chemin.
  distants?: Record<string, string>;
  // Ce que git --work-tree=… checkout a écrit dans chaque lieu (son index).
  extraits?: Record<string, Record<string, string>>;
}

// Les options générales (git --git-dir=… --work-tree=… -C lieu commande).
let generales: { gitDir?: string; workTree?: string; couleur?: boolean } = {};

// Les couleurs de git (color.ui=auto, par défaut depuis git 1.8.4) : à l'écran
// seulement ; --color / --no-color sur la sous-commande. Couleurs par défaut
// de git : en-têtes du diff en gras, @@ en cyan, lignes retirées en rouge,
// ajoutées en vert, commits en jaune ; dans status, l'index en vert, le
// reste en rouge. Voir https://git-scm.com/docs/git-config#Documentation/git-config.txt-colordiffltslotgt
const peindre = (code: string, texte: string) => (generales.couleur ? sgr(code, texte) : texte);
function colorerDiff(texte: string): string {
  return texte
    .split('\n')
    .map((l) =>
      /^(diff --git|index |--- |\+\+\+ )/.test(l)
        ? peindre('1', l)
        : l.startsWith('@@')
          ? peindre('36', l)
          : l.startsWith('-')
            ? peindre('31', l)
            : l.startsWith('+')
              ? peindre('32', l)
              : /^commit [0-9a-f]{40}/.test(l)
                ? peindre('33', l)
                : /^[0-9a-f]{7} /.test(l)
                  ? peindre('33', l.slice(0, 7)) + l.slice(7)
                  : l,
    )
    .join('\n');
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

/** Le dépôt d'un chemin (un dépôt nu, ou un dossier qui contient .git). */
export function depotEn(jeu: Shell, chemin: string): Depot | null {
  const d: Depot | undefined = jeu.etat.git?.[chemin];
  return d && (d.nu ? jeu.existe(chemin) : jeu.existe(`${chemin}/.git`)) ? d : null;
}

// Le dépôt qui contient le lieu courant (on remonte vers la racine), ou celui de --git-dir.
function depotIci(jeu: Shell): { chemin: string; depot: Depot } | null {
  if (generales.gitDir) {
    const chemin = jeu.resoudre(generales.gitDir).replace(/\/\.git$/, '');
    const depot = depotEn(jeu, chemin);
    return depot ? { chemin, depot } : null;
  }
  let chemin = jeu.cwd;
  for (;;) {
    if (depotEn(jeu, chemin)) return { chemin, depot: depotEn(jeu, chemin)! };
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

// Les crochets d'exemple que git init pose dans hooks/ (en .sample).
const CROCHETS_EXEMPLES = [
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
const court = (c: Commit | null) => (c ? c.id.slice(0, 7) : '0000000');

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
    if (!jeu.peut(n, 'w')) return jeu.t('git-ecriture-permission', { fichier: jeu.nom(chemin) });
    n.contenu = texte;
    delete n.taille;
    return null;
  }
  return jeu.placer('git', chemin, { type: 'fichier', contenu: texte, proprio: jeu.qui, lignes: true });
}

const SOUS: Record<string, (jeu: Shell, args: string[]) => string> = {
  init: (jeu, args) => {
    const depots: Record<string, Depot> = (jeu.etat.git ??= {});
    const nu = args.includes('--bare');
    const lieu = args.find((a) => !a.startsWith('-'));
    const chemin = lieu ? jeu.resoudre(lieu) : jeu.cwd;
    if (depots[chemin] && jeu.existe(chemin)) return jeu.t(nu ? 'git-init-existant-nu' : 'git-init-existant', { chemin });
    if (lieu && !jeu.existe(chemin)) {
      const erreur = jeu.placer('git', chemin, { type: 'dossier', proprio: jeu.qui, enfants: {} });
      if (erreur) return jeu.erreur(jeu.t('git-init-impossible', { chemin }));
    }
    const dossier = (enfants: Record<string, Noeud> = {}): Noeud => ({ type: 'dossier', proprio: jeu.qui, enfants });
    const fichier = (texte: string, mode?: string): Noeud => ({
      type: 'fichier',
      contenu: texte,
      lignes: true,
      proprio: jeu.qui,
      ...(mode ? { mode } : {}),
    });
    // Ce que contient un dépôt : HEAD, config, les crochets d'exemple (non exécutables : .sample), les objets…
    const interieur: Record<string, Noeud> = {
      HEAD: fichier('ref: refs/heads/main'),
      config: fichier(`[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = ${nu}`),
      description: fichier("Unnamed repository; edit this file 'description' to name the repository."),
      hooks: dossier(
        Object.fromEntries(CROCHETS_EXEMPLES.map((h) => [`${h}.sample`, fichier(`#!/bin/sh\n#\n# An example hook script (${h}).`, 'rwxr-xr-x')])),
      ),
      info: dossier({ exclude: fichier('# git ls-files --others --exclude-from=.git/info/exclude') }),
      objects: dossier({ info: dossier(), pack: dossier() }),
      refs: dossier({ heads: dossier(), tags: dossier() }),
    };
    const lieuGit = nu ? chemin : `${chemin}/.git`;
    if (nu) {
      const n = jeu.trouver(chemin);
      if (n?.type !== 'dossier' || !jeu.ecritDans(`${chemin}/HEAD`)) return jeu.erreur(jeu.t('git-init-impossible', { chemin }));
      Object.assign(n.enfants, interieur);
    } else {
      const erreur = jeu.placer('git', lieuGit, dossier(interieur));
      if (erreur) return jeu.erreur(erreur);
    }
    depots[chemin] = { commits: [], index: {}, ...(nu ? { nu: true } : {}) };
    return jeu.t(nu ? 'git-init-vide-nu' : 'git-init-vide', { chemin });
  },

  status: (jeu) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(jeu.t('git-pas-de-depot'));
    if (ici.depot.nu) return jeu.erreur(jeu.t('git-pas-d-arbre'));
    const { depot } = ici;
    const head = tete(depot)?.fichiers ?? {};
    const w = travail(jeu, ici.chemin);
    const indexes: string[] = [];
    const nonIndexes: string[] = [];
    const nonSuivis: string[] = [];
    const ligne = (etat: string, fichier: string, code: string) => '\t' + peindre(code, jeu.t(`git-status-${etat}`, { fichier }));
    for (const nom of Object.keys({ ...head, ...depot.index }).sort()) {
      if (!(nom in depot.index)) indexes.push(ligne('supprime', nom, '32'));
      else if (!(nom in head)) indexes.push(ligne('nouveau', nom, '32'));
      else if (head[nom] !== depot.index[nom]) indexes.push(ligne('modifie', nom, '32'));
    }
    for (const nom of Object.keys(depot.index).sort()) {
      if (!(nom in w)) nonIndexes.push(ligne('supprime', nom, '31'));
      else if (w[nom] !== depot.index[nom]) nonIndexes.push(ligne('modifie', nom, '31'));
    }
    for (const nom of Object.keys(w).sort()) if (!(nom in depot.index)) nonSuivis.push(`\t${peindre('31', nom)}`);
    const blocs = [jeu.t('git-status-branche')];
    if (!depot.commits.length) blocs.push('\n' + jeu.t('git-status-aucun-commit'));
    if (indexes.length) blocs.push('\n' + jeu.t('git-status-indexes') + '\n' + indexes.join('\n'));
    if (nonIndexes.length) blocs.push('\n' + jeu.t('git-status-non-indexes') + '\n' + nonIndexes.join('\n'));
    if (nonSuivis.length) blocs.push('\n' + jeu.t('git-status-non-suivis') + '\n' + nonSuivis.join('\n'));
    if (!indexes.length && !nonIndexes.length && !nonSuivis.length) blocs.push(jeu.t('git-status-propre'));
    else if (!indexes.length)
      blocs.push('\n' + jeu.t(nonSuivis.length && !nonIndexes.length ? 'git-status-seulement-non-suivis' : 'git-status-rien-ajoute'));
    return blocs.join('\n');
  },

  add: (jeu, args) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(jeu.t('git-pas-de-depot'));
    if (ici.depot.nu) return jeu.erreur(jeu.t('git-pas-d-arbre'));
    if (!args.length) return jeu.erreur(jeu.t('git-add-rien'));
    const w = travail(jeu, ici.chemin);
    const tous = args.includes('.') || args.includes('-A') || args.includes('--all');
    const noms = tous ? [...new Set([...Object.keys(w), ...Object.keys(ici.depot.index)])] : args.map((a) => jeu.nom(a));
    for (const nom of noms) {
      if (nom in w) ici.depot.index[nom] = w[nom];
      else if (nom in ici.depot.index) delete ici.depot.index[nom];
      else return jeu.erreur(jeu.t('git-chemin-inconnu', { fichier: nom }));
    }
    return '';
  },

  rm: (jeu, args) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(jeu.t('git-pas-de-depot'));
    if (ici.depot.nu) return jeu.erreur(jeu.t('git-pas-d-arbre'));
    const garder = args.includes('--cached');
    const noms = args.filter((a) => !a.startsWith('-')).map((a) => jeu.nom(a));
    if (!noms.length) return jeu.erreur(jeu.t('git-rm-usage'));
    const sorties: string[] = [];
    for (const nom of noms) {
      if (!(nom in ici.depot.index)) return jeu.erreur(jeu.t('git-chemin-inconnu', { fichier: nom }));
      delete ici.depot.index[nom];
      // Sans --cached, git rm efface aussi le fichier de la copie de travail.
      if (!garder) delete (jeu.trouver(ici.chemin) as Dossier).enfants[nom];
      sorties.push(`rm '${nom}'`);
    }
    return sorties.join('\n');
  },

  commit: (jeu, args) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(jeu.t('git-pas-de-depot'));
    if (ici.depot.nu) return jeu.erreur(jeu.t('git-pas-d-arbre'));
    // -m message, -a (ajouter d'abord les fichiers suivis modifiés), ou les deux : -am.
    const i = args.findIndex((a) => a === '-m' || /^-[a-z]*m$/.test(a));
    const message = i >= 0 ? args[i + 1] : undefined;
    if (!message) return jeu.erreur(jeu.t('git-commit-sans-message'));
    if (args.some((a) => a === '--all' || /^-[a-z]*a[a-z]*$/.test(a))) {
      const w = travail(jeu, ici.chemin);
      for (const nom of Object.keys(ici.depot.index)) {
        if (nom in w) ici.depot.index[nom] = w[nom];
        else delete ici.depot.index[nom];
      }
    }
    const parent = tete(ici.depot);
    const avant = parent?.fichiers ?? {};
    const { fichiers, plus, moins } = compte(avant, ici.depot.index);
    if (!fichiers) return jeu.erreur(jeu.t('git-rien-a-valider'));
    const c = nouveauCommit(parent, message, jeu.etat.auteur ?? `${jeu.joueur} <${jeu.joueur}@example.org>`, jeu.etat.date ?? 'Tue Oct 13 21:04:00 2026 +0200', ici.depot.index);
    ici.depot.commits.push(c);
    // Comme git : on ne mentionne pas les insertions ou suppressions nulles.
    const bilan = [
      jeu.t('git-commit-fichiers', { nombre: fichiers }),
      ...(plus ? [jeu.t('git-commit-insertions', { nombre: plus })] : []),
      ...(moins ? [jeu.t('git-commit-suppressions', { nombre: moins })] : []),
    ].join(', ');
    const entete = jeu.t(parent ? 'git-commit-entete' : 'git-commit-entete-racine', { id: c.id.slice(0, 7), message });
    return `${entete}\n ${bilan}`;
  },

  log: (jeu, args) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(jeu.t('git-pas-de-depot'));
    if (!ici.depot.commits.length) return jeu.erreur(jeu.t('git-aucun-commit-branche'));
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
    if (!ici) return jeu.erreur(jeu.t('git-pas-de-depot'));
    if (ici.depot.nu) return jeu.erreur(jeu.t('git-pas-d-arbre'));
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
      if (!c) return jeu.erreur(jeu.t('git-revision-ambigue', { revision: mots[0] }));
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
    if (!ici) return jeu.erreur(jeu.t('git-pas-de-depot'));
    const c = trouverCommit(ici.depot, args[0] ?? 'HEAD');
    if (!c) return jeu.erreur(jeu.t('git-revision-ambigue', { revision: String(args[0]) }));
    const parent = c.parent ? ici.depot.commits.find((p) => p.id === c.parent)!.fichiers : {};
    const noms = [...new Set([...Object.keys(parent), ...Object.keys(c.fichiers)])].sort();
    return [
      `commit ${c.id}\nAuthor: ${c.auteur}\nDate:   ${c.date}\n\n    ${c.message}\n`,
      ...noms.map((n) => diff(n, parent[n] ?? null, c.fichiers[n] ?? null)).filter(Boolean),
    ].join('\n');
  },

  restore: (jeu, args) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(jeu.t('git-pas-de-depot'));
    if (ici.depot.nu) return jeu.erreur(jeu.t('git-pas-d-arbre'));
    const source = args.find((a) => a.startsWith('--source='))?.slice(9);
    const indexe = args.includes('--staged');
    const noms = args.filter((a) => !a.startsWith('-')).map((a) => jeu.nom(a));
    if (!noms.length) return jeu.erreur(jeu.t('git-restore-sans-chemin'));
    let depuis: Record<string, string> = ici.depot.index;
    if (source) {
      const c = trouverCommit(ici.depot, source);
      if (!c) return jeu.erreur(jeu.t('git-reference-invalide', { revision: source }));
      depuis = c.fichiers;
    } else if (indexe) depuis = tete(ici.depot)?.fichiers ?? {};
    for (const nom of noms) {
      if (!(nom in depuis)) return jeu.erreur(jeu.t('git-restore-inconnu', { fichier: nom }));
      if (indexe) ici.depot.index[nom] = depuis[nom];
      else {
        const erreur = ecrire(jeu, `${ici.chemin}/${nom}`, depuis[nom]);
        if (erreur) return jeu.erreur(erreur);
      }
    }
    return '';
  },

  // git checkout ID -- fichier : l'ancienne façon de restaurer un fichier.
  // git --work-tree=lieu checkout [-f] [main] : extrait les fichiers dans un lieu (déploiement).
  checkout: (jeu, args) => {
    const sep = args.indexOf('--');
    if (sep >= 0) {
      const ref = args.slice(0, sep)[0];
      return SOUS.restore(jeu, [...(ref ? [`--source=${ref}`] : []), ...args.slice(sep + 1)]);
    }
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(jeu.t('git-pas-de-depot'));
    if (!generales.workTree) return jeu.erreur(jeu.t(ici.depot.nu ? 'git-pas-d-arbre' : 'git-checkout-usage'));
    const force = args.includes('-f') || args.includes('--force');
    const ref = args.find((a) => !a.startsWith('-')) ?? 'HEAD';
    const c = trouverCommit(ici.depot, ref);
    if (!c)
      return jeu.erreur(
        ici.depot.commits.length ? jeu.t('git-revision-ambigue', { revision: ref }) : jeu.t('git-reference-invalide', { revision: ref }),
      );
    const lieu = jeu.resoudre(generales.workTree);
    if (jeu.trouver(lieu)?.type !== 'dossier') return jeu.erreur(jeu.t('git-work-tree-introuvable', { chemin: lieu }));
    const extraits = (ici.depot.extraits ??= {});
    const avant = extraits[lieu];
    // Sans -f, git refuse d'écraser ce qu'il ne connaît pas, ou ce qu'on a modifié à la main.
    if (!force) {
      const ecrases = Object.keys(c.fichiers)
        .sort()
        .filter((nom) => {
          const n = jeu.trouver(`${lieu}/${nom}`);
          if (n?.type !== 'fichier') return false;
          const ici = contenu(n, jeu);
          return ici !== c.fichiers[nom] && (avant ? ici !== avant[nom] : true);
        });
      if (ecrases.length)
        return jeu.erreur(
          jeu.t(avant ? 'git-checkout-modifications-locales' : 'git-checkout-non-suivis', { fichiers: ecrases.map((f) => `\t${f}`).join('\n') }),
        );
    }
    for (const [nom, texte] of Object.entries(c.fichiers)) {
      const erreur = ecrire(jeu, `${lieu}/${nom}`, texte);
      if (erreur) return jeu.erreur(erreur);
    }
    // Les fichiers suivis qui ont disparu du commit sont effacés.
    const dossier = jeu.trouver(lieu) as Dossier;
    for (const nom of Object.keys(avant ?? {})) if (!(nom in c.fichiers)) delete dossier.enfants[nom];
    extraits[lieu] = { ...c.fichiers };
    // Ce qu'un crochet a déployé, et où (pour les objectifs des chapitres).
    if (jeu.etat.gitCrochet) jeu.etat.gitDeploiements = { ...jeu.etat.gitDeploiements, [lieu]: c.id };
    return '';
  },

  clone: (jeu, args) => {
    const [source, destination] = args.filter((a) => !a.startsWith('-'));
    if (!source) return jeu.erreur(jeu.t('git-clone-usage'));
    const chemin = jeu.resoudre(source).replace(/\/$/, '');
    const origine = depotEn(jeu, chemin);
    if (!origine) return jeu.erreur(jeu.t('git-distant-introuvable', { depot: source }));
    const nom =
      destination ??
      chemin
        .split('/')
        .at(-1)!
        .replace(/\.git$/, '');
    const cible = jeu.resoudre(nom);
    if (jeu.existe(cible)) return jeu.erreur(jeu.t('git-clone-existe', { chemin: nom }));
    const lignes = [jeu.t('git-clone-dans', { chemin: nom })];
    const avant = jeu.cwd;
    const erreur = jeu.placer('git', cible, { type: 'dossier', proprio: jeu.qui, enfants: {} });
    if (erreur) return jeu.erreur(erreur);
    jeu.cwd = cible;
    try {
      SOUS.init(jeu, []);
    } finally {
      jeu.cwd = avant;
    }
    const depot = jeu.etat.git[cible] as Depot;
    depot.commits = [...origine.commits];
    depot.distants = { origin: chemin };
    const h = tete(depot);
    if (h) {
      depot.index = { ...h.fichiers };
      for (const [f, texte] of Object.entries(h.fichiers)) ecrire(jeu, `${cible}/${f}`, texte);
      lignes.push(jeu.t('git-fait'));
    } else lignes.push(jeu.t('git-clone-vide'));
    return lignes.join('\n');
  },

  remote: (jeu, args) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(jeu.t('git-pas-de-depot'));
    const distants = (ici.depot.distants ??= {});
    const [action, nom, url] = args.filter((a) => a !== '-v' && a !== '--verbose');
    if (!action)
      return Object.entries(distants)
        .map(([n, u]) => (args.includes('-v') || args.includes('--verbose') ? `${n}\t${u} (fetch)\n${n}\t${u} (push)` : n))
        .join('\n');
    if (action === 'add') {
      if (!nom || !url) return jeu.erreur(jeu.t('git-remote-usage'));
      if (distants[nom]) return jeu.erreur(jeu.t('git-remote-existe', { nom }));
      distants[nom] = url;
      return '';
    }
    if (action === 'remove' || action === 'rm') {
      if (!nom || !distants[nom]) return jeu.erreur(jeu.t('git-remote-inconnu', { nom: nom ?? '' }));
      delete distants[nom];
      return '';
    }
    if (action === 'set-url') {
      if (!nom || !url) return jeu.erreur(jeu.t('git-remote-usage'));
      if (!distants[nom]) return jeu.erreur(jeu.t('git-remote-inconnu', { nom }));
      distants[nom] = url;
      return '';
    }
    if (action === 'get-url') return distants[nom ?? ''] ?? jeu.erreur(jeu.t('git-remote-inconnu', { nom: nom ?? '' }));
    return jeu.erreur(jeu.t('git-remote-usage'));
  },

  push: (jeu, args) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(jeu.t('git-pas-de-depot'));
    const [nomDistant, branche = 'main'] = args.filter((a) => !a.startsWith('-'));
    const suivre = args.includes('-u') || args.includes('--set-upstream');
    const distants = ici.depot.distants ?? {};
    const nom = nomDistant ?? (distants.origin ? 'origin' : undefined);
    if (!nom) return jeu.erreur(jeu.t('git-push-sans-destination'));
    const url = distants[nom] ?? nom;
    const chemin = jeu.resoudre(url).replace(/\/$/, '');
    const distant = depotEn(jeu, chemin);
    if (!distant) return jeu.erreur(jeu.t('git-distant-introuvable', { depot: url }));
    const refus = (raison: string) =>
      `${jeu.t('git-vers', { depot: url })}\n ! [remote rejected] main -> main (${raison})\n${jeu.t('git-push-impossible', { depot: url })}`;
    if (branche.replace(/^refs\/heads\//, '').replace(/^HEAD$/, 'main') !== 'main' || !ici.depot.commits.length)
      return jeu.erreur(`${jeu.t('git-refspec-inconnue', { ref: branche })}\n${jeu.t('git-push-impossible', { depot: url })}`);
    const avant = tete(distant);
    const local = tete(ici.depot)!;
    if (avant?.id === local.id) return jeu.t('git-tout-a-jour');
    // Le distant a des commits qu'on n'a pas : il faut d'abord les récupérer (git pull).
    if (avant && !ici.depot.commits.some((c) => c.id === avant.id))
      return jeu.erreur(
        `${jeu.t('git-vers', { depot: url })}\n ! [rejected]        main -> main (fetch first)\n${jeu.t('git-push-impossible', { depot: url })}\n${jeu.t('git-push-rejete-astuce')}`,
      );
    const nouveaux = ici.depot.commits.length - (avant ? ici.depot.commits.findIndex((c) => c.id === avant.id) + 1 : 0);
    const objets = nouveaux * 3;
    const lignes = jeu.t('git-push-progression', { objets: String(objets), octets: String(240 + objets * 37) }).split('\n');
    // Écrire dans un dépôt nu : il faut le droit d'écrire dans ses objets.
    const lieuObjets = jeu.trouver(`${chemin}/objects`) ?? jeu.trouver(`${chemin}/.git/objects`);
    if (lieuObjets && !jeu.peut(lieuObjets, 'w')) return jeu.erreur([...lignes, jeu.t('git-push-droits'), refus('unpacker error')].join('\n'));
    // Pousser vers la branche extraite d'un dépôt non nu : refusé (receive.denyCurrentBranch).
    if (!distant.nu) return jeu.erreur([...lignes, jeu.t('git-push-branche-extraite'), refus('branch is currently checked out')].join('\n'));
    // Envoyer prend un peu de temps (l'horloge de la machine avance).
    const sd = systemd(jeu);
    if (sd) sd.horloge += 20_000;
    const distantes: string[] = [];
    const crochet = (nomCrochet: string): { code: number } | null => {
      const fichier = `${chemin}/hooks/${nomCrochet}`;
      const n = jeu.trouver(fichier);
      if (n?.type !== 'fichier') return null;
      if (!jeu.peut(n, 'x')) {
        distantes.push(...jeu.t('git-crochet-ignore', { crochet: fichier }).split('\n'));
        return null;
      }
      const precedent = generales;
      generales = {};
      jeu.etat.gitCrochet = true;
      try {
        const r = executerScript(jeu, contenu(n, jeu), {
          cwd: chemin,
          nom: `hooks/${nomCrochet}`,
          entree: `${avant?.id ?? '0'.repeat(40)} ${local.id} refs/heads/main`,
        });
        if (r.sortie) distantes.push(...r.sortie.split('\n'));
        return { code: r.code };
      } finally {
        generales = precedent;
        jeu.etat.gitCrochet = false;
      }
    };
    const pre = crochet('pre-receive');
    const prefixe = () => distantes.map((l) => `remote: ${l}`.trimEnd());
    if (pre && pre.code !== 0)
      return jeu.erreur(
        [
          ...lignes,
          ...prefixe(),
          `${jeu.t('git-vers', { depot: url })}\n ! [remote rejected] main -> main (pre-receive hook declined)`,
          jeu.t('git-push-impossible', { depot: url }),
        ].join('\n'),
      );
    distant.commits = [...ici.depot.commits];
    jeu.etat.gitPoussees = (jeu.etat.gitPoussees ?? 0) + 1;
    crochet('post-receive');
    return [
      ...lignes,
      ...prefixe(),
      jeu.t('git-vers', { depot: url }),
      avant ? `   ${court(avant)}..${court(local)}  main -> main` : ' * [new branch]      main -> main',
      ...(suivre ? [jeu.t('git-push-suivi', { distant: nom })] : []),
    ].join('\n');
  },

  pull: (jeu, args) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(jeu.t('git-pas-de-depot'));
    if (ici.depot.nu) return jeu.erreur(jeu.t('git-pas-d-arbre'));
    const [nomDistant] = args.filter((a) => !a.startsWith('-'));
    const nom = nomDistant ?? (ici.depot.distants?.origin ? 'origin' : undefined);
    if (!nom) return jeu.erreur(jeu.t('git-pull-sans-distant'));
    const url = ici.depot.distants?.[nom] ?? nom;
    const distant = depotEn(jeu, jeu.resoudre(url).replace(/\/$/, ''));
    if (!distant) return jeu.erreur(jeu.t('git-distant-introuvable', { depot: url }));
    const leur = tete(distant);
    const notre = tete(ici.depot);
    const entete = [jeu.t('git-depuis', { depot: url }), ' * branch            main       -> FETCH_HEAD'];
    if (!leur || leur.id === notre?.id || ici.depot.commits.some((c) => c.id === leur.id)) return [...entete, jeu.t('git-deja-a-jour')].join('\n');
    if (notre && !distant.commits.some((c) => c.id === notre.id)) return jeu.erreur([...entete, jeu.t('git-pull-diverge')].join('\n'));
    const avant = notre?.fichiers ?? {};
    ici.depot.commits = [...distant.commits];
    ici.depot.index = { ...leur.fichiers };
    for (const [f, texte] of Object.entries(leur.fichiers)) ecrire(jeu, `${ici.chemin}/${f}`, texte);
    for (const f of Object.keys(avant)) if (!(f in leur.fichiers)) delete (jeu.trouver(ici.chemin) as Dossier).enfants[f];
    const { fichiers, plus, moins } = compte(avant, leur.fichiers);
    // « index.html | 2 +- », comme git (un + par ligne ajoutée, un - par ligne retirée).
    const noms = [...new Set([...Object.keys(avant), ...Object.keys(leur.fichiers)])]
      .filter((n) => avant[n] !== leur.fichiers[n])
      .sort()
      .map((n) => {
        const k = compte({ [n]: avant[n] ?? '' }, { [n]: leur.fichiers[n] ?? '' });
        return `${n} | ${k.plus + k.moins} ${'+'.repeat(k.plus)}${'-'.repeat(k.moins)}`;
      });
    const bilan = [
      jeu.t('git-commit-fichiers', { nombre: fichiers }),
      ...(plus ? [jeu.t('git-commit-insertions', { nombre: plus })] : []),
      ...(moins ? [jeu.t('git-commit-suppressions', { nombre: moins })] : []),
    ].join(', ');
    return [
      ...entete,
      jeu.t('git-mise-a-jour', { avant: court(notre), apres: court(leur) }),
      jeu.t('git-avance-rapide'),
      ...noms.map((n) => ` ${n}`),
      ` ${bilan}`,
    ].join('\n');
  },
};

export const GIT: Record<string, Commande> = {
  git: {
    propresOptions: true,
    lancer: (c) => {
      const { args, jeu } = c;
      // Les options générales, avant la sous-commande.
      const precedent = generales;
      generales = { ...generales };
      let i = 0;
      for (; i < args.length && args[i].startsWith('-'); i++) {
        const a = args[i];
        if (a.startsWith('--git-dir=')) generales.gitDir = a.slice(10);
        else if (a === '--git-dir') generales.gitDir = args[++i];
        else if (a.startsWith('--work-tree=')) generales.workTree = a.slice(12);
        else if (a === '--work-tree') generales.workTree = args[++i];
        else if (a === '--version') return 'git version 2.47.2';
        else if (a === '--help') return jeu.t('git-usage');
        else return jeu.erreur(jeu.t('git-option-inconnue', { option: a }));
      }
      const [sous, ...brut] = args.slice(i);
      // --color[=QUAND] et --no-color, sur la sous-commande ; par défaut, à l'écran seulement.
      const couleur = lireCouleur(brut.filter((a) => a !== '--no-color'), brut.includes('--no-color') ? 'never' : 'auto');
      const reste = couleur.args;
      generales.couleur = colorer(c, couleur.quand);
      try {
        if (!sous) return jeu.erreur(jeu.t('git-usage'));
        const f = SOUS[sous];
        if (!f) return jeu.erreur(jeu.t('git-sous-commande-inconnue', { commande: sous, commandes: Object.keys(SOUS).join(', ') }));
        const sortie = f(jeu, reste);
        return ['diff', 'show', 'log'].includes(sous) ? colorerDiff(sortie) : sortie;
      } finally {
        generales = precedent;
      }
    },
  },
};
