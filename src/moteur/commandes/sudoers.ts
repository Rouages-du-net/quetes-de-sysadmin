// visudo et sudo -l (https://www.sudo.ws/docs/man/visudo.man/,
// https://www.sudo.ws/docs/man/sudo.man/). Comme le vrai visudo : on édite
// une copie (fichier.tmp), vérifiée à la fermeture de l'éditeur ; si elle a
// une erreur, visudo la montre et demande « Et maintenant ? » (e : reprendre,
// x : quitter sans enregistrer, Q : enregistrer quand même). Le fichier
// enregistré appartient à root, en mode 0440. Messages : la traduction
// française de sudo.

import type { Shell } from '../shell';
import { analyser, lire, reglesDe, SUDOERS, type ErreurSudoers } from '../sudoers';
import type { Commande } from './index';

// L'erreur comme sudo l'affiche : fichier:ligne:colonne: message, la ligne, et ^~~~ sous le morceau fautif.
export const afficherErreur = (jeu: Shell, e: ErreurSudoers) =>
  [`${e.fichier}:${e.ligne}:${e.colonne}: ${jeu.t(e.cle)}`, e.texte, `${' '.repeat(e.colonne - 1)}^${'~'.repeat(e.longueur - 1)}`].join('\n');

// Ouvre la copie dans l'éditeur ; à la fermeture, la vérifie et l'installe.
function editer(jeu: Shell, cible: string, temp: string) {
  const texte = jeu.lire(temp) ?? '';
  jeu.edition = {
    chemin: temp,
    texte: texte && !texte.endsWith('\n') ? texte + '\n' : texte,
    root: true,
    message: jeu.t('nano-lignes-lues', { lignes: texte ? texte.split('\n').length : 0 }),
    conclure: true,
    apres: () => verifier(jeu, cible, temp),
  };
}

function installer(jeu: Shell, cible: string, temp: string): string {
  const contenu = jeu.lire(temp) ?? '';
  const avant = jeu.qui;
  jeu.qui = 'root';
  try {
    const n = jeu.trouver(cible);
    if (n?.type === 'fichier') Object.assign(n, { contenu, lignes: true, proprio: 'root', groupe: 'root', mode: 'r--r-----', taille: undefined });
    else jeu.placer('visudo', cible, { type: 'fichier', contenu, lignes: true, proprio: 'root', groupe: 'root', mode: 'r--r-----' });
    jeu.effacer(temp);
  } finally {
    jeu.qui = avant;
  }
  return '';
}

function verifier(jeu: Shell, cible: string, temp: string): string {
  const nouveau = jeu.lire(temp) ?? '';
  if (nouveau === (jeu.lire(cible) ?? '') && jeu.existe(cible)) {
    jeu.effacer(temp);
    return `visudo: ${temp} unchanged`;
  }
  const { erreur } = analyser(nouveau, temp);
  if (!erreur) return installer(jeu, cible, temp);
  const demander = (): void =>
    jeu.demander(jeu.t('visudo-et-maintenant'), (r) => {
      const choix = r.trim();
      if (choix === 'e') {
        editer(jeu, cible, temp);
        return '';
      }
      if (choix === 'x') {
        jeu.effacer(temp);
        return '';
      }
      if (choix === 'Q') return installer(jeu, cible, temp);
      demander();
      return jeu.t('visudo-options');
    });
  demander();
  return afficherErreur(jeu, erreur);
}

export const SUDOERS_COMMANDES: Record<string, Commande> = {
  visudo: {
    section: 8,
    lancer: ({ args, jeu }) => {
      const i = args.indexOf('-f');
      const cible = i >= 0 ? (args[i + 1] ?? '') : SUDOERS;
      if (i >= 0 && !cible) return jeu.erreur(jeu.t('visudo-usage'), 1);
      // -c : vérifier sans rien modifier.
      if (args.includes('-c')) {
        if (jeu.qui !== 'root') return jeu.erreur(jeu.t('visudo-permission', { fichier: cible }), 1);
        if (i >= 0) {
          const texte = jeu.lire(cible);
          if (texte === null) return jeu.erreur(jeu.t('visudo-introuvable', { fichier: cible }), 1);
          const { erreur } = analyser(texte, cible);
          if (erreur) return jeu.erreur(afficherErreur(jeu, erreur), 1);
          return jeu.t('visudo-analyse-reussie', { fichier: cible });
        }
        const { erreur, fichiers } = lire(jeu);
        if (erreur) return jeu.erreur(afficherErreur(jeu, erreur), 1);
        return fichiers.map((fichier) => jeu.t('visudo-analyse-reussie', { fichier })).join('\n');
      }
      if (jeu.qui !== 'root') return jeu.erreur(jeu.t('visudo-permission', { fichier: cible }), 1);
      const dossier = cible.replace(/\/[^/]+$/, '') || '/';
      if (!jeu.existe(dossier)) return jeu.erreur(jeu.t('visudo-introuvable', { fichier: `${cible}.tmp` }), 1);
      const temp = `${cible}.tmp`;
      jeu.placer('visudo', temp, { type: 'fichier', contenu: jeu.lire(cible) ?? '', lignes: true, proprio: 'root', mode: 'rw-------' });
      editer(jeu, cible, temp);
      return '';
    },
  },
};

/** sudo -l [-U compte] : les commandes permises (la politique de /etc/sudoers). */
export function sudoListe(jeu: Shell, args: string[]): string {
  const i = args.indexOf('-U');
  const compte = i >= 0 ? (args[i + 1] ?? '') : 'vous';
  if (i >= 0 && !jeu.comptes.utilisateurs[compte]) return jeu.erreur(jeu.t('sudo-compte-inconnu', { compte }), 1);
  const hote = jeu.lire('/etc/hostname')?.trim() || jeu.hote;
  // Une machine sans /etc/sudoers décrit par le chapitre : celui de Debian (le groupe sudo a tous les droits).
  const regles = jeu.existe(SUDOERS) ? reglesDe(jeu, compte) : jeu.groupesDe(compte).includes('sudo') || compte === 'root' ? ['(ALL : ALL) ALL'] : [];
  if (!regles.length) return jeu.t('sudo-l-aucune', { compte, hote });
  // Comme sudo -l : sans les guillemets, les deux-points échappés.
  const defauts = jeu.existe(SUDOERS)
    ? lire(jeu)
        .defauts.flatMap((x) => x.split(','))
        .map((x) => x.trim().replace(/"/g, '').replace(/:/g, '\\:'))
    : ['env_reset', 'mail_badpass', 'secure_path=/usr/local/sbin\\:/usr/local/bin\\:/usr/sbin\\:/usr/bin\\:/sbin\\:/bin', 'use_pty'];
  return jeu.t('sudo-l', { compte, hote, defauts: defauts.join(', '), regles: regles.map((r) => `    ${r}`).join('\n') });
}
