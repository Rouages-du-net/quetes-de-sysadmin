// Commandes de fichiers : se déplacer, lire, créer, copier, effacer,
// permissions, archives, place disque.

import type { Fichier, Noeud } from '../monde';
import type { Shell } from '../shell';
import { appliquerMode, contenu, joker, lisible, options, tailleDe } from '../outils';
import type { Commande } from './index';

const modeDe = (n: Noeud) => n.mode ?? (n.type === 'dossier' ? 'rwxr-xr-x' : 'rw-r--r--');

// Une ligne de « ls -l ». Écart volontaire : on omet le nombre de liens et
// la date.
function ligneLongue(jeu: Shell, nom: string, n: Noeud, humain: boolean): string {
  const proprio = n.proprio ?? 'vous';
  const groupe = n.groupe ?? proprio;
  const octets = n.type === 'dossier' ? 4096 : tailleDe(n, jeu);
  const taille = humain ? lisible(octets, jeu.t.langue) : String(octets);
  const suffixe = n.type === 'dossier' && nom !== '.' && nom !== '..' ? '/' : '';
  return `${n.type === 'dossier' ? 'd' : '-'}${modeDe(n)} ${proprio.padEnd(8)} ${groupe.padEnd(8)} ${taille.padStart(6)} ${nom}${suffixe}`;
}

// Source → (lieu de destination, nom final), comme mv et cp sous Linux :
// si la destination est un lieu, l'objet y garde son nom ; sinon, c'est un
// nouveau nom dans un lieu existant.
function destination(jeu: Shell, source: string, dest: string): string {
  const cible = jeu.trouver(dest);
  return cible?.type === 'dossier' ? `${jeu.resoudre(dest)}/${jeu.nom(source)}`.replace('//', '/') : jeu.resoudre(dest);
}

const copier = (n: Noeud, proprio: string): Noeud =>
  n.type === 'fichier'
    ? { ...n, proprio, groupe: undefined, lu: undefined, protege: undefined }
    : { type: 'dossier', proprio, mode: n.mode, enfants: Object.fromEntries(Object.entries(n.enfants).map(([k, e]) => [k, copier(e, proprio)])) };

export const FICHIERS: Record<string, Commande> = {
  pwd: {
    lancer: ({ jeu }) => jeu.cwd,
  },

  whoami: {
    lancer: ({ jeu }) => jeu.qui,
  },

  ls: {
    lancer: ({ args, jeu, dernier }) => {
      const { lettres, reste } = options(args);
      const cible = reste[0] ?? '.';
      const n = jeu.trouver(cible);
      if (!n) return jeu.erreur(jeu.t('ls-acces-introuvable', { cible }));
      const raison = jeu.blocage(cible);
      if (raison) return jeu.erreur(raison);
      if (!jeu.traverse(cible)) return jeu.erreur(jeu.t('ls-acces-permission', { cible }));
      if (n.type === 'fichier') return lettres.has('l') ? ligneLongue(jeu, cible, n, lettres.has('h')) : cible;
      if (!jeu.peut(n, 'r')) return jeu.erreur(jeu.t('ls-ouvrir-permission', { cible }));
      const entrees: [string, Noeud][] = Object.entries(n.enfants)
        .filter(([nom]) => lettres.has('a') || !nom.startsWith('.'))
        .sort(([a], [b]) => a.localeCompare(b, 'fr'));
      if (lettres.has('a')) entrees.unshift(['.', n], ['..', jeu.trouver(cible + '/..') ?? n]);
      if (lettres.has('l')) return entrees.map(([nom, e]) => ligneLongue(jeu, nom, e, lettres.has('h'))).join('\n');
      // Comme le vrai ls : en colonnes à l'écran, un nom par ligne dans un
      // tube ou un fichier (et sans le / ajouté aux lieux).
      if (!dernier) return entrees.map(([nom]) => nom).join('\n');
      return entrees.map(([nom, e]) => (e.type === 'dossier' && nom !== '.' && nom !== '..' ? nom + '/' : nom)).join('    ');
    },
  },

  cd: {
    lancer: ({ args, jeu }) => {
      const cible = args[0] ?? '~';
      const n = jeu.trouver(cible);
      if (!n) return jeu.erreur(jeu.t('erreur-introuvable', { commande: 'cd', cible }));
      if (n.type !== 'dossier') return jeu.erreur(jeu.t('cd-pas-un-dossier', { cible }));
      const raison = jeu.blocage(cible);
      if (raison) return jeu.erreur(raison);
      if (!jeu.traverse(cible) || !jeu.peut(n, 'x')) return jeu.erreur(jeu.t('erreur-permission', { commande: 'cd', cible }));
      jeu.cwd = jeu.resoudre(cible);
      return '';
    },
  },

  cat: {
    lancer: ({ args, entree, jeu }) => {
      if (!args.length) return entree ?? jeu.erreur(jeu.t('cat-usage'));
      return args
        .map((cible) => {
          const texte = jeu.lirePour('cat', cible);
          if (texte === null) return null;
          const n = jeu.trouver(cible) as Fichier;
          const effet = n.lu?.(jeu);
          return [texte, effet].filter(Boolean).join('\n\n');
        })
        .filter((t) => t !== null)
        .join('\n');
    },
  },

  echo: {
    lancer: ({ args }) => args.join(' '),
  },

  tee: {
    lancer: ({ args, entree, jeu }) => {
      const { lettres, reste } = options(args);
      const texte = entree ?? '';
      for (const cible of reste) {
        const n = jeu.trouver(cible);
        if (n?.type === 'fichier') {
          if (!jeu.traverse(cible) || !jeu.peut(n, 'w')) {
            jeu.erreur(jeu.t('erreur-permission', { commande: 'tee', cible }));
            continue;
          }
          const avant = contenu(n, jeu);
          n.contenu = lettres.has('a') && avant ? `${avant}\n${texte}` : texte;
          n.lignes = true;
          delete n.taille;
        } else {
          const erreur = jeu.placer('tee', cible, { type: 'fichier', contenu: texte, proprio: jeu.qui, lignes: true });
          if (erreur) jeu.erreur(erreur);
        }
      }
      return texte;
    },
  },

  mv: {
    lancer: ({ args, jeu }) => {
      const [source, dest] = args;
      if (!source || !dest) return jeu.erreur(jeu.t('mv-usage'));
      const n = jeu.trouver(source);
      if (!n) return jeu.erreur(jeu.t('mv-introuvable', { cible: source }));
      // Simplification du jeu : on déplace des objets, jamais des lieux.
      if (n.type === 'dossier') return jeu.erreur(jeu.t('mv-lieu', { cible: source }));
      if (n.protege?.mv) return jeu.erreur(n.protege.mv);
      const cible = destination(jeu, source, dest);
      const raison = jeu.blocage(source) ?? jeu.blocage(cible + '/..');
      if (raison) return jeu.erreur(raison);
      if (jeu.resoudre(source) === cible) return '';
      if (!jeu.ecritDans(source)) return jeu.erreur(jeu.t('mv-permission', { cible: source }));
      const erreur = jeu.placer('mv', cible, n);
      if (erreur) return jeu.erreur(erreur);
      jeu.effacer(source);
      return '';
    },
  },

  cp: {
    lancer: ({ args, jeu }) => {
      const { lettres, reste } = options(args);
      const [source, dest] = reste;
      if (!source || !dest) return jeu.erreur(jeu.t('cp-usage'));
      const n = jeu.trouver(source);
      if (!n) return jeu.erreur(jeu.t('cp-introuvable', { cible: source }));
      if (n.type === 'dossier' && !lettres.has('r')) return jeu.erreur(jeu.t('cp-repertoire', { cible: source }));
      const cible = destination(jeu, source, dest);
      const raison = jeu.blocage(source) ?? jeu.blocage(cible + '/..');
      if (raison) return jeu.erreur(raison);
      if (jeu.resoudre(source) === cible) return jeu.erreur(jeu.t('cp-meme-fichier', { source, destination: dest }));
      if (!jeu.traverse(source) || !jeu.peut(n, 'r'))
        return jeu.erreur(jeu.t('cp-lecture-permission', { cible: source }));
      const erreur = jeu.placer('cp', cible, copier(n, jeu.qui));
      return erreur ? jeu.erreur(erreur) : '';
    },
  },

  rm: {
    lancer: ({ args, jeu }) => {
      if (!args.length) return jeu.erreur(jeu.t('rm-usage'));
      for (const cible of args.filter((a) => !a.startsWith('-'))) {
        const n = jeu.trouver(cible);
        if (!n) jeu.erreur(jeu.t('rm-introuvable', { cible }));
        else if (n.type === 'dossier') jeu.erreur(jeu.t('rm-dossier', { cible }));
        else if (n.protege?.rm) jeu.erreur(n.protege.rm);
        else if (jeu.blocage(cible)) jeu.erreur(jeu.blocage(cible)!);
        // Effacer un fichier, c'est modifier le lieu qui le contient : il faut
        // le droit d'écrire dans ce lieu, pas sur le fichier.
        else if (!jeu.ecritDans(cible)) jeu.erreur(jeu.t('rm-permission', { cible }));
        else jeu.effacer(cible);
      }
      return '';
    },
  },

  touch: {
    lancer: ({ args, jeu }) => {
      if (!args.length) return jeu.erreur(jeu.t('touch-usage'));
      for (const cible of args) {
        if (jeu.existe(cible)) continue;
        const erreur = jeu.placer('touch', cible, { type: 'fichier', contenu: '', proprio: jeu.qui });
        if (erreur) jeu.erreur(erreur);
      }
      return '';
    },
  },

  mkdir: {
    lancer: ({ args, jeu }) => {
      if (!args.length) return jeu.erreur(jeu.t('mkdir-usage'));
      for (const cible of args) {
        if (jeu.existe(cible)) jeu.erreur(jeu.t('mkdir-existe', { cible }));
        else {
          const erreur = jeu.placer('mkdir', cible, { type: 'dossier', enfants: {}, proprio: jeu.qui });
          if (erreur) jeu.erreur(erreur);
        }
      }
      return '';
    },
  },

  chmod: {
    lancer: ({ args, jeu }) => {
      const [droits, ...cibles] = args;
      if (!droits || !cibles.length) return jeu.erreur(jeu.t('chmod-usage'));
      for (const cible of cibles) {
        const n = jeu.trouver(cible);
        if (!n) jeu.erreur(jeu.t('chmod-acces-introuvable', { cible }));
        else if (!jeu.traverse(cible)) jeu.erreur(jeu.t('chmod-acces-permission', { cible }));
        else if (jeu.qui !== 'root' && (n.proprio ?? 'vous') !== jeu.qui) jeu.erreur(jeu.t('chmod-non-permise', { cible }));
        else {
          const nouveau = appliquerMode(modeDe(n), droits);
          if (!nouveau) jeu.erreur(jeu.t('chmod-mode-incorrect', { droits }));
          else n.mode = nouveau;
        }
      }
      return '';
    },
  },

  find: {
    lancer: ({ args, jeu }) => {
      const depart = args[0] && !args[0].startsWith('-') ? args[0] : '.';
      const crit = args[0] && !args[0].startsWith('-') ? args.slice(1) : args;
      let nom: RegExp | null = null;
      let type: string | null = null;
      let effacer = false;
      for (let i = 0; i < crit.length; i++) {
        if (crit[i] === '-name') nom = joker(crit[++i] ?? '');
        else if (crit[i] === '-type') type = crit[++i] ?? null;
        else if (crit[i] === '-delete') effacer = true;
        else return jeu.erreur(jeu.t('find-predicat-inconnu', { predicat: crit[i] }));
      }
      const n = jeu.trouver(depart);
      if (!n) return jeu.erreur(jeu.t('find-introuvable', { cible: depart }));
      const trouves: string[] = [];
      const parcourir = (chemin: string, e: Noeud) => {
        const garde = (!nom || nom.test(chemin.split('/').pop()!)) && (!type || (type === 'd') === (e.type === 'dossier'));
        if (garde) trouves.push(chemin);
        if (e.type !== 'dossier') return;
        if (!jeu.peut(e, 'r') || !jeu.peut(e, 'x')) return void jeu.erreur(jeu.t('find-permission', { cible: chemin }));
        for (const [k, enfant] of Object.entries(e.enfants).sort(([a], [b]) => a.localeCompare(b, 'fr')))
          parcourir(`${chemin.replace(/\/$/, '')}/${k}`, enfant);
      };
      parcourir(depart, n);
      if (!effacer) return trouves.join('\n');
      for (const chemin of trouves.reverse()) {
        const e = jeu.trouver(chemin)!;
        if (e.type === 'dossier' && Object.keys(e.enfants).length) jeu.erreur(jeu.t('find-supprimer-non-vide', { cible: chemin }));
        else if (!jeu.ecritDans(chemin)) jeu.erreur(jeu.t('find-supprimer-permission', { cible: chemin }));
        else jeu.effacer(chemin);
      }
      return '';
    },
  },

  du: {
    lancer: ({ args, jeu }) => {
      const { lettres, reste } = options(args);
      const fmt = (o: number) => (lettres.has('h') ? lisible(o, jeu.t.langue) : String(Math.ceil(o / 1024)));
      const lignes: string[] = [];
      const parcourir = (chemin: string, e: Noeud): number => {
        if (e.type === 'fichier') return tailleDe(e, jeu);
        let total = 0;
        for (const [k, enfant] of Object.entries(e.enfants)) total += parcourir(`${chemin.replace(/\/$/, '')}/${k}`, enfant);
        if (!lettres.has('s')) lignes.push(`${fmt(total)}\t${chemin}`);
        return total;
      };
      for (const cible of reste.length ? reste : ['.']) {
        const n = jeu.trouver(cible);
        if (!n) {
          jeu.erreur(jeu.t('du-introuvable', { cible }));
          continue;
        }
        const total = parcourir(cible, n);
        if (lettres.has('s') || n.type === 'fichier') lignes.push(`${fmt(total)}\t${cible}`);
      }
      return lignes.join('\n');
    },
  },

  df: {
    lancer: ({ args, jeu }) => {
      const { lettres, reste } = options(args);
      const fmt = (o: number) => (lettres.has('h') ? lisible(o, jeu.t.langue) : String(Math.ceil(o / 1024)));
      const montages: { chemin: string; capacite: number; nom: string }[] = jeu.etat.montages ?? [];
      const choisis = reste.length
        ? reste.map((r) => jeu.montage(jeu.resoudre(r))).filter(Boolean)
        : montages;
      const lignes = [jeu.t('df-entete')];
      for (const m of choisis as typeof montages) {
        const lieu = jeu.trouver(m.chemin);
        const utilise = lieu ? jeu.taille(lieu) : 0;
        const pct = Math.round((100 * utilise) / m.capacite);
        lignes.push(
          `${(m.nom ?? m.chemin).padEnd(18)} ${fmt(m.capacite).padStart(6)} ${fmt(utilise).padStart(7)} ${fmt(Math.max(0, m.capacite - utilise)).padStart(6)} ${String(pct).padStart(3)}% ${m.chemin}`,
        );
      }
      return lignes.join('\n');
    },
  },

  tar: {
    lancer: ({ args, jeu }) => {
      const { lettres, reste } = options(args);
      if (!lettres.has('f') || !reste.length) return jeu.erreur(jeu.t('tar-usage'));
      const [nomArchive, ...sources] = reste;
      if (lettres.has('c')) {
        if (!sources.length) return jeu.erreur(jeu.t('tar-archive-vide'));
        const fichiers: Record<string, Fichier> = {};
        const ajouter = (chemin: string, e: Noeud) => {
          if (e.type === 'fichier') {
            if (!jeu.peut(e, 'r')) return void jeu.erreur(jeu.t('erreur-permission', { commande: 'tar', cible: chemin }));
            fichiers[chemin] = { ...e, lu: undefined } as Fichier;
          } else for (const [k, enfant] of Object.entries(e.enfants)) ajouter(`${chemin.replace(/\/$/, '')}/${k}`, enfant);
        };
        for (const s of sources) {
          const e = jeu.trouver(s);
          if (!e) jeu.erreur(jeu.t('erreur-introuvable', { commande: 'tar', cible: s }));
          else ajouter(s.replace(/^\.?\/+/, ''), e);
        }
        const compresse = lettres.has('z');
        // Taille : 512 octets d'en-tête par fichier ; gzip réduit beaucoup le
        // texte (environ au tiers) et presque pas les images, sons et vidéos,
        // déjà compressés.
        const deja = /\.(png|jpe?g|gif|webp|mp3|ogg|mp4|webm|zip|gz|pdf)$/i;
        const taille = Object.entries(fichiers).reduce((t, [chemin, f]) => {
          const brut = tailleDe(f, jeu);
          return t + 512 + (compresse ? Math.round(brut * (deja.test(chemin) ? 0.98 : 0.35)) : brut);
        }, 0);
        const archive: Fichier = { type: 'fichier', contenu: '', taille, proprio: jeu.qui, archive: { fichiers, compresse } };
        const erreur = jeu.placer('tar', nomArchive, archive);
        if (erreur) return jeu.erreur(erreur);
        return lettres.has('v') ? Object.keys(fichiers).join('\n') : '';
      }
      const n = jeu.trouver(nomArchive);
      if (!n) return jeu.erreur(jeu.t('tar-open-impossible', { cible: nomArchive }));
      if (n.type !== 'fichier' || !n.archive) return jeu.erreur(jeu.t('tar-pas-une-archive', { cible: nomArchive }));
      if (lettres.has('t')) return Object.keys(n.archive.fichiers).join('\n');
      if (lettres.has('x')) {
        for (const [chemin, f] of Object.entries(n.archive.fichiers)) {
          const parties = chemin.split('/');
          let lieu = '.';
          for (const p of parties.slice(0, -1)) {
            lieu = `${lieu}/${p}`;
            if (!jeu.existe(lieu)) jeu.placer('tar', lieu, { type: 'dossier', enfants: {}, proprio: jeu.qui });
          }
          const erreur = jeu.placer('tar', chemin, { ...f, proprio: jeu.qui });
          if (erreur) jeu.erreur(erreur);
        }
        return '';
      }
      return jeu.erreur(jeu.t('tar-option-manquante'));
    },
  },
};

