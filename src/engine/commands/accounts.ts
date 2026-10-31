// Comptes et groupes : id, groups (coreutils), chgrp, chown (coreutils),
// usermod, userdel, gpasswd, chage (shadow-utils). Sources : https://man7.org/linux/man-pages/man1/id.1.html,
// https://man7.org/linux/man-pages/man1/chown.1.html,
// https://man7.org/linux/man-pages/man8/usermod.8.html,
// https://man7.org/linux/man-pages/man8/userdel.8.html, https://man7.org/linux/man-pages/man1/gpasswd.1.html,
// https://man7.org/linux/man-pages/man1/chage.1.html
// Règles réelles : seul root change le propriétaire ; le propriétaire d'un
// fichier peut en changer le groupe pour un groupe dont il est membre ;
// usermod -G remplace les groupes secondaires, usermod -aG en ajoute.

import type { Noeud } from '../world';
import type { Shell } from '../shell';
import { options } from '../tools';
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
      const autorise = (n: Noeud) => jeu.qui === 'root' || ((n.proprio ?? jeu.joueur) === jeu.qui && jeu.groupesDe(jeu.qui).includes(groupe));
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
      let expire: string | null = null;
      let shell: string | null = null;
      const reste: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (/^-[a-zA-Z]+$/.test(a)) {
          if (a.includes('a')) ajout = true;
          // -L verrouille le mot de passe (un « ! » devant son empreinte dans /etc/shadow), -U le déverrouille.
          if (a.includes('L')) verrou = true;
          if (a.includes('U')) verrou = false;
          if (a.includes('G')) liste = args[++i] ?? '';
          // -e : date de fin de validité du compte (AAAA-MM-JJ, ou 1 : le 2 janvier 1970) ; -s : le shell de connexion.
          if (a.includes('e')) expire = args[++i] ?? '';
          if (a.includes('s')) shell = args[++i] ?? '';
        } else reste.push(a);
      }
      const nom = reste[0];
      if (!nom || (liste === null && verrou === null && expire === null && shell === null))
        return jeu.erreur(jeu.t(ajout && liste === null ? 'usermod-a-sans-G' : 'usermod-usage'));
      if (ajout && liste === null) return jeu.erreur(jeu.t('usermod-a-sans-G'));
      if (jeu.qui !== 'root') return jeu.erreur(jeu.t('usermod-permission'));
      const u = jeu.comptes.utilisateurs[nom];
      if (!u) return jeu.erreur(jeu.t('usermod-utilisateur-inexistant', { utilisateur: nom }));
      let date: string | undefined;
      if (expire !== null && expire !== '') {
        date = dateExpiration(expire) ?? undefined;
        if (!date) return jeu.erreur(jeu.t('usermod-date-invalide', { date: expire }));
      }
      if (liste !== null) {
        const groupes = liste.split(',').filter(Boolean);
        const inconnu = groupes.find((g) => !jeu.comptes.groupes[g]);
        if (inconnu) return jeu.erreur(jeu.t('usermod-groupe-inexistant', { groupe: inconnu }));
        // Sans -a, les groupes secondaires sont REMPLACÉS par la liste.
        if (!ajout) for (const g of Object.values(jeu.comptes.groupes)) g.membres = g.membres.filter((m) => m !== nom);
        for (const g of groupes) if (!jeu.comptes.groupes[g].membres.includes(nom)) jeu.comptes.groupes[g].membres.push(nom);
      }
      if (verrou !== null) {
        const verrous: string[] = (jeu.etat.comptesVerrouilles ??= []);
        jeu.etat.comptesVerrouilles = verrou ? [...new Set([...verrous, nom])] : verrous.filter((v) => v !== nom);
      }
      if (expire !== null) {
        if (date) u.expire = date;
        else delete u.expire;
      }
      if (shell !== null) u.shell = shell;
      return '';
    },
  },

  // userdel : supprime un compte (et, avec -r, son dossier personnel et sa boîte aux lettres).
  userdel: {
    lancer: ({ args, jeu }) => {
      const { lettres, reste } = options(args);
      const nom = reste[0];
      if (!nom) return jeu.erreur(jeu.t('userdel-usage'));
      if (jeu.qui !== 'root') return jeu.erreur(jeu.t('userdel-permission'));
      const u = jeu.comptes.utilisateurs[nom];
      if (!u) return jeu.erreur(jeu.t('userdel-inexistant', { utilisateur: nom }), 6);
      // Un compte encore utilisé par un processus n'est pas supprimé (sauf -f).
      const p = ((jeu.etat.processus ?? []) as { pid: number; utilisateur: string }[]).find((x) => x.utilisateur === nom);
      if (p && !lettres.has('f')) return jeu.erreur(jeu.t('userdel-utilise', { utilisateur: nom, pid: String(p.pid) }), 8);
      delete jeu.comptes.utilisateurs[nom];
      for (const g of Object.values(jeu.comptes.groupes)) g.membres = g.membres.filter((m) => m !== nom);
      // Son groupe personnel (même nom) part aussi, s'il n'a pas d'autre membre.
      if (jeu.comptes.groupes[u.groupe] && u.groupe === nom && !jeu.comptes.groupes[nom].membres.length) delete jeu.comptes.groupes[nom];
      if (lettres.has('r')) {
        const maison = u.maison ?? `/home/${nom}`;
        const sortie: string[] = [];
        if (jeu.existe(maison)) jeu.effacer(maison);
        if (jeu.existe(`/var/mail/${nom}`)) jeu.effacer(`/var/mail/${nom}`);
        else sortie.push(jeu.t('userdel-sans-courrier', { utilisateur: nom }));
        return sortie.join('\n');
      }
      return '';
    },
  },

  // gpasswd -a / -d : ajoute ou retire un compte d'un groupe.
  gpasswd: {
    lancer: ({ args, jeu }) => {
      const i = args.findIndex((a) => a === '-a' || a === '-d');
      const nom = args[i + 1];
      const groupe = args.filter((_, k) => k !== i && k !== i + 1)[0];
      if (i < 0 || !nom || !groupe) return jeu.erreur(jeu.t('gpasswd-usage'), 2);
      if (jeu.qui !== 'root') return jeu.erreur(jeu.t('gpasswd-permission'), 1);
      const g = jeu.comptes.groupes[groupe];
      if (!g) return jeu.erreur(jeu.t('gpasswd-groupe-inexistant', { groupe }), 3);
      if (!jeu.comptes.utilisateurs[nom]) return jeu.erreur(jeu.t('gpasswd-utilisateur-inexistant', { utilisateur: nom }), 3);
      if (args[i] === '-a') {
        if (!g.membres.includes(nom)) g.membres.push(nom);
        return jeu.t('gpasswd-ajout', { utilisateur: nom, groupe });
      }
      if (!g.membres.includes(nom)) return jeu.erreur(jeu.t('gpasswd-pas-membre', { utilisateur: nom, groupe }), 3);
      g.membres = g.membres.filter((m) => m !== nom);
      return jeu.t('gpasswd-retrait', { utilisateur: nom, groupe });
    },
  },

  // chage -l (les dates du compte) et -E (sa fin de validité).
  chage: {
    lancer: ({ args, jeu }) => {
      const i = args.indexOf('-E');
      const liste = args.includes('-l');
      const nom = args.filter((a, k) => !a.startsWith('-') && (i < 0 || k !== i + 1)).at(-1);
      if (!nom || (i < 0 && !liste)) return jeu.erreur(jeu.t('chage-usage'), 2);
      const u = jeu.comptes.utilisateurs[nom];
      if (!u) return jeu.erreur(jeu.t('chage-inexistant', { utilisateur: nom }), 1);
      if (liste && i < 0) {
        if (jeu.qui !== 'root' && jeu.qui !== nom) return jeu.erreur(jeu.t('chage-permission'), 1);
        return jeu.t('chage-liste', { expire: u.expire ?? 'never' });
      }
      if (jeu.qui !== 'root') return jeu.erreur(jeu.t('chage-permission'), 1);
      const valeur = args[i + 1] ?? '';
      if (valeur === '-1') delete u.expire;
      else {
        const date = valeur === '0' ? '1970-01-01' : dateExpiration(valeur);
        if (!date) return jeu.erreur(jeu.t('chage-date-invalide', { date: valeur }), 2);
        u.expire = date;
      }
      return '';
    },
  },
};

// Une date de fin de validité : AAAA-MM-JJ, ou un nombre de jours depuis le 1er janvier 1970.
function dateExpiration(texte: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(texte) && !Number.isNaN(Date.parse(texte))) return texte;
  if (/^\d+$/.test(texte)) return new Date(Number(texte) * 86_400_000).toISOString().slice(0, 10);
  return null;
}
