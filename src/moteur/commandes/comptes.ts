// Comptes et groupes : id, groups (coreutils), chgrp, chown (coreutils),
// usermod (shadow-utils). Sources : https://man7.org/linux/man-pages/man1/id.1.html,
// https://man7.org/linux/man-pages/man1/chown.1.html,
// https://man7.org/linux/man-pages/man8/usermod.8.html
// Règles réelles : seul root change le propriétaire ; le propriétaire d'un
// fichier peut en changer le groupe pour un groupe dont il est membre ;
// usermod -G remplace les groupes secondaires, usermod -aG en ajoute.

import type { Noeud } from '../monde';
import type { Shell } from '../shell';
import { options } from '../outils';
import type { Commande } from './index';

// « 1000(vous) »
const avecNumero = (nom: string, numero: number | undefined) => `${numero ?? '?'}(${nom})`;

// Applique une modification à une cible, et à tout son contenu avec -R.
function pourChaque(n: Noeud, recursif: boolean, faire: (n: Noeud) => void) {
  faire(n);
  if (recursif && n.type === 'dossier') for (const e of Object.values(n.enfants)) pourChaque(e, true, faire);
}

// Les cibles de chown et chgrp : vérifie l'accès, puis applique `faire`.
function changer(jeu: Shell, commande: string, cibles: string[], recursif: boolean, autorise: (n: Noeud) => boolean, faire: (n: Noeud) => void) {
  for (const cible of cibles) {
    const n = jeu.trouver(cible);
    if (!n) jeu.erreur(jeu.t('erreur-acces-introuvable', { commande, cible }));
    else if (!jeu.traverse(cible)) jeu.erreur(jeu.t('erreur-acces-permission', { commande, cible }));
    else if (!autorise(n)) jeu.erreur(jeu.t(`${commande}-non-permise`, { cible }));
    else pourChaque(n, recursif, faire);
  }
  return '';
}

export const COMPTES: Record<string, Commande> = {
  id: {
    lancer: ({ args, jeu }) => {
      const nom = args[0] ?? jeu.qui;
      const u = jeu.comptes.utilisateurs[nom];
      if (!u) return jeu.erreur(jeu.t('id-inexistant', { utilisateur: nom }));
      const gid = (g: string) => jeu.comptes.groupes[g]?.gid;
      return jeu.t('id-ligne', {
        uid: avecNumero(nom, u.uid),
        gid: avecNumero(u.groupe, gid(u.groupe)),
        groupes: jeu.groupesDe(nom).map((g) => avecNumero(g, gid(g))).join(','),
      });
    },
  },

  groups: {
    lancer: ({ args, jeu }) => {
      if (!args.length) return jeu.groupesDe(jeu.qui).join(' ');
      return args
        .map((nom) =>
          jeu.comptes.utilisateurs[nom] ? `${nom} : ${jeu.groupesDe(nom).join(' ')}` : jeu.erreur(jeu.t('groups-inexistant', { utilisateur: nom })),
        )
        .filter(Boolean)
        .join('\n');
    },
  },

  chgrp: {
    lancer: ({ args, jeu }) => {
      const { lettres, reste } = options(args);
      const [groupe, ...cibles] = reste;
      if (!groupe || !cibles.length) return jeu.erreur(jeu.t('chgrp-usage'));
      if (!jeu.comptes.groupes[groupe]) return jeu.erreur(jeu.t('chgrp-groupe-incorrect', { groupe }));
      const autorise = (n: Noeud) => jeu.qui === 'root' || ((n.proprio ?? 'vous') === jeu.qui && jeu.groupesDe(jeu.qui).includes(groupe));
      return changer(jeu, 'chgrp', cibles, lettres.has('R'), autorise, (n) => (n.groupe = groupe));
    },
  },

  chown: {
    lancer: ({ args, jeu }) => {
      const { lettres, reste } = options(args);
      const [proprio, ...cibles] = reste;
      if (!proprio || !cibles.length) return jeu.erreur(jeu.t('chown-usage'));
      // Un numéro (uid, gid) est accepté même sans compte qui le porte : ls -l l'affiche alors tel quel.
      const parUid = (x: string) => Object.entries(jeu.comptes.utilisateurs).find(([, u]) => String(u.uid) === x)?.[0] ?? x;
      const parGid = (x: string) => Object.entries(jeu.comptes.groupes).find(([, g]) => String(g.gid) === x)?.[0] ?? x;
      const [brutNom, brutGroupe] = proprio.split(':');
      const nom = brutNom && /^\d+$/.test(brutNom) ? parUid(brutNom) : brutNom;
      const groupe = brutGroupe && /^\d+$/.test(brutGroupe) ? parGid(brutGroupe) : brutGroupe;
      if (nom && !/^\d+$/.test(nom) && !jeu.comptes.utilisateurs[nom]) return jeu.erreur(jeu.t('chown-utilisateur-incorrect', { proprio }));
      if (groupe && !/^\d+$/.test(groupe) && !jeu.comptes.groupes[groupe]) return jeu.erreur(jeu.t('chown-groupe-incorrect', { proprio }));
      // « chown malo: f » : le groupe principal de malo.
      const nouveauGroupe = groupe || (proprio.endsWith(':') && nom ? (jeu.comptes.utilisateurs[nom]?.groupe ?? nom) : undefined);
      return changer(jeu, 'chown', cibles, lettres.has('R'), () => jeu.qui === 'root', (n) => {
        if (nom) n.proprio = nom;
        if (nouveauGroupe) n.groupe = nouveauGroupe;
      });
    },
  },

  usermod: {
    lancer: ({ args, jeu }) => {
      let ajout = false;
      let liste: string | null = null;
      let verrou: boolean | null = null;
      const reste: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (/^-[a-zA-Z]+$/.test(a)) {
          if (a.includes('a')) ajout = true;
          // -L verrouille le mot de passe (un « ! » devant son empreinte dans /etc/shadow), -U le déverrouille.
          if (a.includes('L')) verrou = true;
          if (a.includes('U')) verrou = false;
          if (a.includes('G')) liste = args[++i] ?? '';
        } else reste.push(a);
      }
      const nom = reste[0];
      if (verrou !== null && liste === null) {
        if (!nom) return jeu.erreur(jeu.t('usermod-usage'));
        if (jeu.qui !== 'root') return jeu.erreur(jeu.t('usermod-permission'));
        if (!jeu.comptes.utilisateurs[nom]) return jeu.erreur(jeu.t('usermod-utilisateur-inexistant', { utilisateur: nom }));
        const verrous: string[] = (jeu.etat.comptesVerrouilles ??= []);
        jeu.etat.comptesVerrouilles = verrou ? [...new Set([...verrous, nom])] : verrous.filter((v) => v !== nom);
        return '';
      }
      if (!nom || liste === null) return jeu.erreur(jeu.t(ajout && liste === null ? 'usermod-a-sans-G' : 'usermod-usage'));
      if (jeu.qui !== 'root') return jeu.erreur(jeu.t('usermod-permission'));
      if (!jeu.comptes.utilisateurs[nom]) return jeu.erreur(jeu.t('usermod-utilisateur-inexistant', { utilisateur: nom }));
      const groupes = liste.split(',').filter(Boolean);
      const inconnu = groupes.find((g) => !jeu.comptes.groupes[g]);
      if (inconnu) return jeu.erreur(jeu.t('usermod-groupe-inexistant', { groupe: inconnu }));
      // Sans -a, les groupes secondaires sont REMPLACÉS par la liste.
      if (!ajout) for (const g of Object.values(jeu.comptes.groupes)) g.membres = g.membres.filter((m) => m !== nom);
      for (const g of groupes) if (!jeu.comptes.groupes[g].membres.includes(nom)) jeu.comptes.groupes[g].membres.push(nom);
      return '';
    },
  },
};
