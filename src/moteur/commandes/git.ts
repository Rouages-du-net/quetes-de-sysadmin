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
    if (!jeu.peut(n, 'w')) return jeu.t('git-ecriture-permission', { fichier: jeu.nom(chemin) });
    n.contenu = texte;
    delete n.taille;
    return null;
  }
  return jeu.placer('git', chemin, { type: 'fichier', contenu: texte, proprio: jeu.qui, lignes: true });
}

const SOUS: Record<string, (jeu: Shell, args: string[]) => string> = {
  init: (jeu) => {
    const depots: Record<string, Depot> = (jeu.etat.git ??= {});
    const chemin = jeu.cwd;
    if (depots[chemin]) return jeu.t('git-init-existant', { chemin });
    const erreur = jeu.placer('git', `${chemin}/.git`, {
      type: 'dossier',
      proprio: jeu.qui,
      enfants: { HEAD: { type: 'fichier', contenu: 'ref: refs/heads/main', lignes: true } },
    });
    if (erreur) return jeu.erreur(erreur);
    depots[chemin] = { commits: [], index: {} };
    return jeu.t('git-init-vide', { chemin });
  },

  status: (jeu) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(jeu.t('git-pas-de-depot'));
    const { depot } = ici;
    const head = tete(depot)?.fichiers ?? {};
    const w = travail(jeu, ici.chemin);
    const indexes: string[] = [];
    const nonIndexes: string[] = [];
    const nonSuivis: string[] = [];
    const ligne = (etat: string, fichier: string) => '\t' + jeu.t(`git-status-${etat}`, { fichier });
    for (const nom of Object.keys({ ...head, ...depot.index }).sort()) {
      if (!(nom in depot.index)) indexes.push(ligne('supprime', nom));
      else if (!(nom in head)) indexes.push(ligne('nouveau', nom));
      else if (head[nom] !== depot.index[nom]) indexes.push(ligne('modifie', nom));
    }
    for (const nom of Object.keys(depot.index).sort()) {
      if (!(nom in w)) nonIndexes.push(ligne('supprime', nom));
      else if (w[nom] !== depot.index[nom]) nonIndexes.push(ligne('modifie', nom));
    }
    for (const nom of Object.keys(w).sort()) if (!(nom in depot.index)) nonSuivis.push(`\t${nom}`);
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

  commit: (jeu, args) => {
    const ici = depotIci(jeu);
    if (!ici) return jeu.erreur(jeu.t('git-pas-de-depot'));
    const i = args.indexOf('-m');
    const message = i >= 0 ? args[i + 1] : undefined;
    if (!message) return jeu.erreur(jeu.t('git-commit-sans-message'));
    const parent = tete(ici.depot);
    const avant = parent?.fichiers ?? {};
    const { fichiers, plus, moins } = compte(avant, ici.depot.index);
    if (!fichiers) return jeu.erreur(jeu.t('git-rien-a-valider'));
    const c = nouveauCommit(parent, message, jeu.etat.auteur ?? 'vous <vous@example.org>', jeu.etat.date ?? 'Tue Oct 13 21:04:00 2026 +0200', ici.depot.index);
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
  checkout: (jeu, args) => {
    const sep = args.indexOf('--');
    if (sep < 0) return jeu.erreur(jeu.t('git-checkout-usage'));
    const ref = args.slice(0, sep)[0];
    return SOUS.restore(jeu, [...(ref ? [`--source=${ref}`] : []), ...args.slice(sep + 1)]);
  },
};

export const GIT: Record<string, Commande> = {
  git: {
    lancer: ({ args, jeu }) => {
      const [sous, ...reste] = args;
      if (!sous) return jeu.erreur(jeu.t('git-usage'));
      const f = SOUS[sous];
      if (!f) return jeu.erreur(jeu.t('git-sous-commande-inconnue', { commande: sous, commandes: Object.keys(SOUS).join(', ') }));
      return f(jeu, reste);
    },
  },
};
