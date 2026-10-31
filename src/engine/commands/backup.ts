// Sauvegardes : rsync (https://download.samba.org/pub/rsync/rsync.1) et
// crontab (https://manpages.debian.org/bookworm/cron/crontab.1.en.html).
// rsync : « source/ » copie le CONTENU du dossier, « source » le dossier
// lui-même ; seuls les fichiers qui ont changé sont copiés ; --delete retire
// de la destination ce qui n'est plus dans la source ; -n n'écrit rien.
// Sortie et messages en anglais, comme rsync et cron.

import type { Fichier, Noeud } from '../world';
import type { Shell } from '../shell';
import { contenu, tailleDe } from '../tools';
import { analyser, MODELE } from '../cron';
import { franchir, preparer } from '../access';
import { cheminDistant } from './transfers';
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
  const destBrute = chemins.pop()!;
  // Une machine d'en face (« machine:chemin ») : rsync passe par ssh.
  const versDistant = cheminDistant(destBrute);
  const depuisDistant = chemins.map(cheminDistant);
  const autre = versDistant ?? depuisDistant.find(Boolean);
  if (!autre) return transferer(jeu, jeu, jeu, o, chemins, destBrute);
  if (versDistant && depuisDistant.some(Boolean)) return jeu.erreur('The source and destination cannot both be remote.\nrsync error: syntax or usage error (code 1) at main.c(1415) [Receiver=3.2.7]');
  const sauts = preparer(jeu, autre.cible, { programme: 'ssh' });
  if (typeof sauts === 'string') return jeu.erreur(`${sauts}\nrsync: connection unexpectedly closed (0 bytes received so far) [sender]\nrsync error: unexplained error (code 255) at io.c(232) [sender=3.2.7]`);
  const d = sauts.at(-1)!;
  return franchir(jeu, sauts, () => {
    const avant = d.shell.qui;
    const cwd = d.shell.cwd;
    d.shell.qui = d.utilisateur;
    d.shell.cwd = d.shell.maison;
    try {
      const sortie = versDistant
        ? transferer(jeu, jeu, d.shell, o, chemins, versDistant.chemin || '.')
        : transferer(jeu, d.shell, jeu, o, depuisDistant.map((x) => x!.chemin || '.'), destBrute);
      // Une réponse à une question (mot de passe) : les erreurs s'affichent avec la sortie.
      return [...jeu.recupererErreurs(), sortie].filter(Boolean).join('\n');
    } finally {
      d.shell.qui = avant;
      d.shell.cwd = cwd;
    }
  });
}

/** La copie elle-même, de la machine `src` vers la machine `dst` ; les erreurs vont à `jeu` (où rsync tourne). */
function transferer(jeu: Shell, src: Shell, dst: Shell, o: Options, chemins: string[], dest: string): string {
  const lignes: string[] = [];
  const erreurs: string[] = [];
  let total = 0;
  let envoye = 0;
  let fichiers = 0;

  // Crée un dossier dans la destination (sauf en essai) ; null si impossible.
  const creerDossier = (chemin: string, modele: Noeud): boolean => {
    const n = dst.trouver(chemin);
    if (n?.type === 'dossier') return true;
    if (o.essai) return true;
    const erreur = dst.placer('rsync', chemin, { type: 'dossier', enfants: {}, proprio: dst.qui, mode: o.archive ? modele.mode : undefined });
    if (erreur) erreurs.push(`rsync: [Receiver] mkdir "${dst.resoudre(chemin)}" failed: ${erreur.includes('ucun espace') ? 'No space left on device (28)' : dst.trouver(chemin + '/..') ? 'Permission denied (13)' : 'No such file or directory (2)'}`);
    return !erreur;
  };

  const copierFichier = (source: Fichier, chemin: string, relatif: string, cheminSource: string) => {
    total += tailleDe(source, src);
    if (!src.peut(source, 'r')) return void erreurs.push(`rsync: [sender] send_files failed to open "${src.resoudre(cheminSource)}": Permission denied (13)`);
    const texte = contenu(source, src);
    const ancien = dst.trouver(chemin);
    if (ancien?.type === 'fichier' && contenu(ancien, dst) === texte) return;
    lignes.push(relatif);
    fichiers++;
    envoye += tailleDe(source, src);
    if (o.essai) return;
    if (ancien?.type === 'fichier') {
      if (!dst.peut(ancien, 'w')) return void erreurs.push(`rsync: [Receiver] mkstemp "${dst.resoudre(chemin)}" failed: Permission denied (13)`);
      ancien.contenu = texte;
      ancien.lignes = source.lignes;
      ancien.prose = source.prose;
      delete ancien.taille;
      if (o.archive) ancien.mode = source.mode;
      return;
    }
    const copie: Fichier = { ...source, contenu: texte, proprio: dst.qui, groupe: undefined, mode: o.archive ? source.mode : undefined, lu: undefined, protege: undefined };
    const erreur = dst.placer('rsync', chemin, copie);
    if (erreur) erreurs.push(`rsync: [Receiver] mkstemp "${dst.resoudre(chemin)}" failed: Permission denied (13)`);
  };

  // Copie récursive d'un dossier source vers un dossier destination.
  const copierDossier = (source: Noeud & { type: 'dossier' }, cheminSource: string, chemin: string, relatif: string) => {
    const existait = dst.trouver(chemin)?.type === 'dossier';
    if (!creerDossier(chemin, source)) return;
    if (!existait) lignes.push(relatif || './');
    const cible = dst.trouver(chemin);
    if (o.effacer && cible?.type === 'dossier')
      for (const nom of Object.keys(cible.enfants).sort())
        if (!(nom in source.enfants)) {
          // Comme rsync : le contenu d'un dossier effacé d'abord, du plus profond au plus haut.
          const effaces = (n: Noeud, rel: string): string[] =>
            n.type === 'dossier'
              ? [...Object.keys(n.enfants).sort().reverse().flatMap((e) => effaces(n.enfants[e], `${rel}/${e}`)), `deleting ${rel}/`]
              : [`deleting ${rel}`];
          lignes.push(...effaces(cible.enfants[nom], `${relatif}${nom}`));
          if (!o.essai) delete cible.enfants[nom];
        }
    for (const [nom, e] of Object.entries(source.enfants).sort(([a], [b]) => a.localeCompare(b))) {
      if (e.type === 'dossier') copierDossier(e, `${cheminSource}/${nom}`, `${chemin}/${nom}`, `${relatif}${nom}/`);
      else copierFichier(e, `${chemin}/${nom}`, `${relatif}${nom}`, `${cheminSource}/${nom}`);
    }
  };

  for (const chemin of chemins) {
    const n = src.trouver(chemin);
    if (!n || !src.traverse(chemin)) {
      erreurs.push(`rsync: [sender] link_stat "${src.resoudre(chemin)}" failed: ${n ? 'Permission denied (13)' : 'No such file or directory (2)'}`);
      continue;
    }
    const nom = src.nom(chemin);
    if (n.type === 'dossier') {
      if (!o.recursif) {
        lignes.push(`skipping directory ${nom}`);
        continue;
      }
      // « src/ » : le contenu ; « src » : le dossier lui-même, dans dest.
      if (chemin.endsWith('/')) copierDossier(n, chemin.replace(/\/+$/, ''), dest.replace(/\/+$/, ''), '');
      else {
        if (!creerDossier(dest, n)) continue;
        copierDossier(n, chemin, `${dest.replace(/\/+$/, '')}/${nom}`, `${nom}/`);
      }
    } else {
      const d = dst.trouver(dest);
      const cible = d?.type === 'dossier' || dest.endsWith('/') ? `${dest.replace(/\/+$/, '')}/${nom}` : dest;
      if (dest.endsWith('/') && !creerDossier(dest, n)) continue;
      copierFichier(n, cible, nom, chemin);
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
      // -u compte, où qu'il soit (crontab -l -u marc) : on le ramène devant.
      const iu = args.indexOf('-u');
      if (iu > 0) args = ['-u', args[iu + 1], ...args.filter((_, k) => k !== iu && k !== iu + 1)];
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
        const compte = jeu.qui;
        const texte = crontabs[jeu.qui] ?? MODELE;
        if (!jeu.existe(TEMP)) jeu.placer('crontab', TEMP, { type: 'dossier', enfants: {}, proprio: jeu.qui, mode: 'rwx------' });
        const fichier = `${TEMP}/crontab`;
        jeu.placer('crontab', fichier, { type: 'fichier', contenu: texte, proprio: jeu.qui, lignes: true });
        jeu.edition = {
          chemin: fichier,
          texte: texte.endsWith('\n') ? texte : texte + '\n',
          root: jeu.qui === 'root',
          message: jeu.t('nano-lignes-lues', { lignes: texte.split('\n').length - (texte.endsWith('\n') ? 1 : 0) }),
          // La crontab est installée pour le compte qui l'a ouverte (root avec sudo), à la fermeture de l'éditeur.
          apres: () => {
            const qui = jeu.qui;
            jeu.qui = compte;
            try {
              const nouveau = (jeu.lire(fichier) ?? '').replace(/\n$/, '');
              if (nouveau === texte.replace(/\n$/, '')) return 'crontab: no changes made to crontab';
              return installer(jeu, nouveau, fichier);
            } finally {
              jeu.qui = qui;
            }
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
