// Sauvegardes : rsync (https://download.samba.org/pub/rsync/rsync.1) et
// crontab (https://manpages.debian.org/bookworm/cron/crontab.1.en.html).
// rsync : « source/ » copie le CONTENU du dossier, « source » le dossier
// lui-même ; seuls les fichiers qui ont changé sont copiés ; --delete retire
// de la destination ce qui n'est plus dans la source ; -n n'écrit rien.
// Sortie et messages en anglais, comme rsync et cron.

import type { Fichier, Noeud } from '../monde';
import type { Shell } from '../shell';
import { contenu, tailleDe } from '../outils';
import { analyser, MODELE } from '../cron';
import type { Commande } from './index';

const VERSION = '[sender=3.2.7]';
const nombre = (n: number) => n.toLocaleString('en-US');

interface Options {
  recursif: boolean;
  archive: boolean;
  bavard: boolean;
  essai: boolean;
  effacer: boolean;
}

function rsync(jeu: Shell, args: string[]): string {
  const o: Options = { recursif: false, archive: false, bavard: false, essai: false, effacer: false };
  const chemins: string[] = [];
  for (const a of args) {
    if (a === '--delete') o.effacer = true;
    else if (a === '--dry-run') o.essai = true;
    else if (a === '--archive') o.archive = o.recursif = true;
    else if (a === '--recursive') o.recursif = true;
    else if (a === '--verbose') o.bavard = true;
    else if (a === '--progress' || a === '--human-readable') continue;
    else if (a.startsWith('--')) return jeu.erreur(`rsync: ${a}: unknown option\nrsync error: syntax or usage error (code 1) at main.c(1795) [client=3.2.7]`);
    else if (/^-[a-zA-Z]+$/.test(a)) {
      for (const l of a.slice(1)) {
        if (l === 'a') o.archive = o.recursif = true;
        else if (l === 'r') o.recursif = true;
        else if (l === 'v') o.bavard = true;
        else if (l === 'n') o.essai = true;
        else if (l !== 'h' && l !== 'P' && l !== 'z')
          return jeu.erreur(`rsync: -${l}: unknown option\nrsync error: syntax or usage error (code 1) at main.c(1795) [client=3.2.7]`);
      }
    } else chemins.push(a);
  }
  if (chemins.length < 2) return jeu.erreur(jeu.t('rsync-usage'));
  const dest = chemins.pop()!;
  const lignes: string[] = [];
  const erreurs: string[] = [];
  let total = 0;
  let envoye = 0;
  let fichiers = 0;

  // Crée un dossier dans la destination (sauf en essai) ; null si impossible.
  const creerDossier = (chemin: string, modele: Noeud): boolean => {
    const n = jeu.trouver(chemin);
    if (n?.type === 'dossier') return true;
    if (o.essai) return true;
    const erreur = jeu.placer('rsync', chemin, { type: 'dossier', enfants: {}, proprio: jeu.qui, mode: o.archive ? modele.mode : undefined });
    if (erreur) erreurs.push(`rsync: [Receiver] mkdir "${jeu.resoudre(chemin)}" failed: ${erreur.includes('ucun espace') ? 'No space left on device (28)' : jeu.trouver(chemin + '/..') ? 'Permission denied (13)' : 'No such file or directory (2)'}`);
    return !erreur;
  };

  const copierFichier = (source: Fichier, chemin: string, relatif: string, cheminSource: string) => {
    total += tailleDe(source, jeu);
    if (!jeu.peut(source, 'r')) return void erreurs.push(`rsync: [sender] send_files failed to open "${jeu.resoudre(cheminSource)}": Permission denied (13)`);
    const texte = contenu(source, jeu);
    const ancien = jeu.trouver(chemin);
    if (ancien?.type === 'fichier' && contenu(ancien, jeu) === texte) return;
    lignes.push(relatif);
    fichiers++;
    envoye += tailleDe(source, jeu);
    if (o.essai) return;
    if (ancien?.type === 'fichier') {
      if (!jeu.peut(ancien, 'w')) return void erreurs.push(`rsync: [Receiver] mkstemp "${jeu.resoudre(chemin)}" failed: Permission denied (13)`);
      ancien.contenu = texte;
      ancien.lignes = source.lignes;
      ancien.prose = source.prose;
      delete ancien.taille;
      if (o.archive) ancien.mode = source.mode;
      return;
    }
    const copie: Fichier = { ...source, contenu: texte, proprio: jeu.qui, groupe: undefined, mode: o.archive ? source.mode : undefined, lu: undefined, protege: undefined };
    const erreur = jeu.placer('rsync', chemin, copie);
    if (erreur) erreurs.push(`rsync: [Receiver] mkstemp "${jeu.resoudre(chemin)}" failed: Permission denied (13)`);
  };

  // Copie récursive d'un dossier source vers un dossier destination.
  const copierDossier = (source: Noeud & { type: 'dossier' }, cheminSource: string, chemin: string, relatif: string) => {
    const existait = jeu.trouver(chemin)?.type === 'dossier';
    if (!creerDossier(chemin, source)) return;
    if (!existait) lignes.push(relatif || './');
    const cible = jeu.trouver(chemin);
    if (o.effacer && cible?.type === 'dossier')
      for (const nom of Object.keys(cible.enfants).sort())
        if (!(nom in source.enfants)) {
          lignes.push(`deleting ${relatif}${nom}${cible.enfants[nom].type === 'dossier' ? '/' : ''}`);
          if (!o.essai) delete cible.enfants[nom];
        }
    for (const [nom, e] of Object.entries(source.enfants).sort(([a], [b]) => a.localeCompare(b))) {
      if (e.type === 'dossier') copierDossier(e, `${cheminSource}/${nom}`, `${chemin}/${nom}`, `${relatif}${nom}/`);
      else copierFichier(e, `${chemin}/${nom}`, `${relatif}${nom}`, `${cheminSource}/${nom}`);
    }
  };

  for (const src of chemins) {
    const n = jeu.trouver(src);
    if (!n || !jeu.traverse(src)) {
      erreurs.push(`rsync: [sender] link_stat "${jeu.resoudre(src)}" failed: ${n ? 'Permission denied (13)' : 'No such file or directory (2)'}`);
      continue;
    }
    const nom = jeu.nom(src);
    if (n.type === 'dossier') {
      if (!o.recursif) {
        lignes.push(`skipping directory ${nom}`);
        continue;
      }
      // « src/ » : le contenu ; « src » : le dossier lui-même, dans dest.
      if (src.endsWith('/')) copierDossier(n, src.replace(/\/+$/, ''), dest.replace(/\/+$/, ''), '');
      else {
        if (!creerDossier(dest, n)) continue;
        copierDossier(n, src, `${dest.replace(/\/+$/, '')}/${nom}`, `${nom}/`);
      }
    } else {
      const d = jeu.trouver(dest);
      const chemin = d?.type === 'dossier' || dest.endsWith('/') ? `${dest.replace(/\/+$/, '')}/${nom}` : dest;
      if (dest.endsWith('/') && !creerDossier(dest, n)) continue;
      copierFichier(n, chemin, nom, src);
    }
  }
  for (const e of erreurs) jeu.erreur(e);
  if (erreurs.length) jeu.erreur(`rsync error: some files/attrs were not transferred (see previous errors) (code 23) at main.c(1338) ${VERSION}`);
  if (!o.bavard) return lignes.filter((l) => l.startsWith('skipping')).join('\n');
  const recu = 19 * fichiers + 35;
  const envoi = envoye + 60 * fichiers + 100;
  return [
    'sending incremental file list',
    ...lignes,
    '',
    `sent ${nombre(envoi)} bytes  received ${nombre(recu)} bytes  ${((envoi + recu) / 0.5).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} bytes/sec`,
    `total size is ${nombre(total)}  speedup is ${(total / (envoi + recu)).toFixed(2)}${o.essai ? ' (DRY RUN)' : ''}`,
  ].join('\n');
}

const TEMP = '/tmp/crontab.Zx81Ab';

// Installe une crontab après vérification, comme crontab(1).
function installer(jeu: Shell, texte: string, fichier: string): string {
  const { erreurs } = analyser(texte, fichier);
  if (erreurs.length) return [...erreurs, jeu.t('crontab-reessayer')].join('\n');
  const crontabs: Record<string, string> = (jeu.etat.crontabs ??= {});
  crontabs[jeu.qui] = texte;
  jeu.etat.versionCrontab = (jeu.etat.versionCrontab ?? 0) + 1;
  return 'crontab: installing new crontab';
}

export const SAUVEGARDE: Record<string, Commande> = {
  rsync: { propresOptions: true, lancer: ({ args, jeu }) => rsync(jeu, args) },

  crontab: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const crontabs: Record<string, string> = (jeu.etat.crontabs ??= {});
      // -u compte : la crontab d'un autre compte (root seulement).
      if (args[0] === '-u') {
        if (jeu.qui !== 'root') return jeu.erreur('crontab: must be privileged to use -u');
        const cible = args[1];
        if (!cible || !jeu.comptes.utilisateurs[cible]) return jeu.erreur(`crontab: user '${cible ?? ''}' unknown`);
        const avant = jeu.qui;
        jeu.qui = cible;
        try {
          const sortie = SAUVEGARDE.crontab.lancer({ args: args.slice(2), jeu, entree: null, dernier: true });
          // crontab -e : l'installation, à la fermeture de l'éditeur, se fait aussi pour ce compte.
          const apres = jeu.edition?.apres;
          if (jeu.edition && apres)
            jeu.edition.apres = () => {
              const qui = jeu.qui;
              jeu.qui = cible;
              try {
                return apres();
              } finally {
                jeu.qui = qui;
              }
            };
          if (jeu.edition) jeu.edition.root = true;
          return sortie;
        } finally {
          jeu.qui = avant;
        }
      }
      const action = args[0];
      if (action === '-l') return crontabs[jeu.qui] ?? jeu.erreur(`no crontab for ${jeu.qui}`);
      if (action === '-r') {
        if (!(jeu.qui in crontabs)) return jeu.erreur(`no crontab for ${jeu.qui}`);
        delete crontabs[jeu.qui];
        jeu.etat.versionCrontab = (jeu.etat.versionCrontab ?? 0) + 1;
        return '';
      }
      if (action === '-e') {
        // Comme le vrai crontab -e : une copie dans /tmp, ouverte dans l'éditeur,
        // vérifiée et installée à la fermeture.
        const texte = crontabs[jeu.qui] ?? MODELE;
        if (!jeu.existe(TEMP)) jeu.placer('crontab', TEMP, { type: 'dossier', enfants: {}, proprio: jeu.qui, mode: 'rwx------' });
        const fichier = `${TEMP}/crontab`;
        jeu.placer('crontab', fichier, { type: 'fichier', contenu: texte, proprio: jeu.qui, lignes: true });
        jeu.edition = {
          chemin: fichier,
          texte: texte.endsWith('\n') ? texte : texte + '\n',
          root: jeu.qui === 'root',
          message: jeu.t('nano-lignes-lues', { lignes: texte.split('\n').length - (texte.endsWith('\n') ? 1 : 0) }),
          apres: () => {
            const nouveau = (jeu.lire(fichier) ?? '').replace(/\n$/, '');
            if (nouveau === texte.replace(/\n$/, '')) return 'crontab: no changes made to crontab';
            return installer(jeu, nouveau, fichier);
          },
        };
        // Écart : l'éditeur est toujours nano (pas de select-editor).
        return jeu.qui in crontabs ? '' : `no crontab for ${jeu.qui} - using an empty one`;
      }
      if (action && !action.startsWith('-')) {
        const texte = jeu.lire(action);
        if (texte === null) return jeu.erreur(`${action}: No such file or directory`);
        return installer(jeu, texte, action);
      }
      return jeu.erreur(jeu.t('crontab-usage'));
    },
  },
};
