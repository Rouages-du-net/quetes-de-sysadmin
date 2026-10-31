// Les outils d'OpenLDAP (ldap-utils et slapd) sur l'annuaire simulé
// (../ldap.ts) : ldapsearch, ldapadd, ldapmodify, ldapdelete, ldappasswd,
// ldapwhoami, slappasswd, slapcat. Sorties en anglais, comme les vrais outils.
// Sources : https://manpages.debian.org/trixie/ldap-utils/ldapsearch.1.en.html,
// https://manpages.debian.org/trixie/ldap-utils/ldapmodify.1.en.html,
// https://manpages.debian.org/trixie/ldap-utils/ldappasswd.1.en.html,
// https://manpages.debian.org/trixie/slapd/slappasswd.8.en.html

import type { Shell } from '../shell';
import {
  annuaire,
  appliquer,
  correspond,
  hacher,
  lireFiltre,
  lireLdif,
  nomAttribut,
  normaliser,
  sous,
  trouver,
  verifier,
  type Annuaire,
  type Changement,
  type Entree,
  type ErreurLdap,
} from '../ldap';
import { systemd } from '../systemd';
import type { Commande } from './index';

const RACINE_EXTERNE = 'gidNumber=0+uidNumber=0,cn=peercred,cn=external,cn=auth';

interface Options {
  simple: boolean;
  uri: string | null;
  dn: string | null;
  mdp: string | null;
  demanderMdp: boolean;
  mecanisme: string | null;
  base: string | null;
  portee: string;
  ldif: number;
  fichier: string | null;
  silence: boolean;
  continuer: boolean;
  ajout: boolean;
  nouveau: string | null;
  demanderNouveau: boolean;
  reste: string[];
}

function lireOptions(args: string[], avecS: 'portee' | 'nouveau'): Options | string {
  const o: Options = {
    simple: false,
    uri: null,
    dn: null,
    mdp: null,
    demanderMdp: false,
    mecanisme: null,
    base: null,
    portee: 'sub',
    ldif: 0,
    fichier: null,
    silence: false,
    continuer: false,
    ajout: false,
    nouveau: null,
    demanderNouveau: false,
    reste: [],
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('-') || a === '-') {
      o.reste.push(a);
      continue;
    }
    const lettres = a.slice(1);
    for (let k = 0; k < lettres.length; k++) {
      const l = lettres[k];
      const valeur = () => (k < lettres.length - 1 ? lettres.slice(k + 1) : args[++i]) ?? '';
      if (l === 'x') o.simple = true;
      else if (l === 'W') o.demanderMdp = true;
      else if (l === 'L') o.ldif++;
      else if (l === 'Q') o.silence = true;
      else if (l === 'c') o.continuer = true;
      else if (l === 'a') o.ajout = true;
      else if (l === 'S') o.demanderNouveau = true;
      else if (l === 'v' || l === 'n' || l === 'N' || l === 'r') continue;
      else if ('HDwYbfs'.includes(l)) {
        const v = valeur();
        if (l === 'H') o.uri = v;
        else if (l === 'D') o.dn = v;
        else if (l === 'w') o.mdp = v;
        else if (l === 'Y') o.mecanisme = v.toUpperCase();
        else if (l === 'b') o.base = v;
        else if (l === 'f') o.fichier = v;
        else if (l === 's' && avecS === 'portee') o.portee = v;
        else if (l === 's') o.nouveau = v;
        k = lettres.length;
      } else return l;
    }
  }
  return o;
}

// /etc/ldap/ldap.conf : BASE et URI par défaut.
function defauts(jeu: Shell): { base: string | null; uri: string } {
  const texte = jeu.lire('/etc/ldap/ldap.conf') ?? '';
  const valeur = (cle: string) =>
    texte
      .split('\n')
      .find((l) => new RegExp(`^${cle}\\s`, 'i').test(l.trim()))
      ?.trim()
      .split(/\s+/)[1] ?? null;
  return { base: valeur('BASE'), uri: valeur('URI') ?? 'ldap://localhost' };
}

type Identite = { qui: 'anonyme' } | { qui: 'admin' } | { qui: 'racine' } | { qui: 'personne'; dn: string } | { qui: 'local'; uid: number };

/** Se présenter à slapd (bind) ; renvoie l'identité, ou l'erreur à afficher (avec son code de retour). */
function seLier(jeu: Shell, o: Options, mdp: string | null): { id: Identite; journal: string[] } | { erreur: string; code: number } {
  const a = annuaire(jeu);
  const uri = o.uri ?? defauts(jeu).uri;
  const enMarche = systemd(jeu)?.services.slapd?.etat === 'active';
  const sasl = !o.simple;
  if (!enMarche) return { erreur: `${sasl ? 'ldap_sasl_interactive_bind' : 'ldap_sasl_bind(SIMPLE)'}: Can't contact LDAP server (-1)`, code: 255 };
  if (!a) return { erreur: 'ldap_bind: No such object (32)', code: 32 };
  if (sasl) {
    if (o.mecanisme !== 'EXTERNAL' || !uri.startsWith('ldapi:'))
      return {
        erreur:
          'ldap_sasl_interactive_bind: Unknown authentication method (-6)\n\tadditional info: SASL(-4): no mechanism available: No worthy mechs found',
        code: 255,
      };
    const journal = o.silence
      ? []
      : [
          'SASL/EXTERNAL authentication started',
          `SASL username: ${jeu.qui === 'root' ? RACINE_EXTERNE : `gidNumber=1000+uidNumber=1000,cn=peercred,cn=external,cn=auth`}`,
          'SASL SSF: 0',
        ];
    return { id: jeu.qui === 'root' ? { qui: 'racine' } : { qui: 'local', uid: 1000 }, journal };
  }
  if (!o.dn) return { id: { qui: 'anonyme' }, journal: [] };
  if (normaliser(o.dn) === normaliser(a.admin)) {
    if (mdp !== null && verifier(adminMdp(jeu), mdp)) return { id: { qui: 'admin' }, journal: [] };
    return { erreur: 'ldap_bind: Invalid credentials (49)', code: 49 };
  }
  const e = trouver(a, o.dn);
  if (!e || mdp === null || !(e.attrs.userpassword ?? []).some((v) => verifier(v, mdp)))
    return { erreur: 'ldap_bind: Invalid credentials (49)', code: 49 };
  return { id: { qui: 'personne', dn: e.dn }, journal: [] };
}

const adminMdp = (jeu: Shell): string => jeu.etat.ldapAdmin ?? '';
const ecrit = (id: Identite) => id.qui === 'admin' || id.qui === 'racine';

/** Lance `faire` une fois le mot de passe connu : donné (-w), demandé (-W), ou sans (anonyme, SASL). */
function avecMdp(jeu: Shell, o: Options, faire: (mdp: string | null) => string): string {
  if (!o.demanderMdp || o.mdp !== null) return faire(o.mdp);
  const qui = jeu.qui;
  jeu.demander(
    'Enter LDAP Password: ',
    (reponse) => {
      const avant = jeu.qui;
      jeu.qui = qui;
      try {
        const sortie = faire(reponse);
        return [...jeu.recupererErreurs(), sortie].filter(Boolean).join('\n');
      } finally {
        jeu.qui = avant;
      }
    },
    true,
  );
  return '';
}

// « # sami, people, thehive.example » : le commentaire de ldapsearch devant chaque entrée.
function titre(dn: string): string {
  const rdns = dn.split(',').map((r) => r.split('=').map((x) => x.trim()));
  const dcs = rdns.filter(([a]) => a.toLowerCase() === 'dc').map(([, v]) => v);
  const autres = rdns.filter(([a]) => a.toLowerCase() !== 'dc').map(([, v]) => v);
  return [...autres, ...(dcs.length ? [dcs.join('.')] : [])].join(', ');
}

function lignesEntree(e: Entree, id: Identite, demandes: string[]): string[] {
  const lignes = [`dn: ${e.dn}`];
  for (const [a, valeurs] of Object.entries(e.attrs)) {
    if (demandes.length && !demandes.includes('*') && !demandes.some((d) => d.toLowerCase() === a)) continue;
    // userPassword : seulement pour l'administrateur, root, ou la personne elle-même.
    if (a === 'userpassword' && !(ecrit(id) || (id.qui === 'personne' && normaliser(id.dn) === normaliser(e.dn)))) continue;
    for (const v of valeurs) lignes.push(`${nomAttribut(a)}: ${v}`);
  }
  return lignes;
}

function ldapsearch(jeu: Shell, args: string[]): string {
  const o = lireOptions(args, 'portee');
  if (typeof o === 'string') return jeu.erreur(`ldapsearch: invalid option -- '${o}'\nldapsearch: unrecognized option -${o}`, 1);
  const [filtreTexte = '(objectclass=*)', ...demandes] = o.reste;
  const filtre = lireFiltre(filtreTexte);
  return avecMdp(jeu, o, (mdp) => {
    const lien = seLier(jeu, o, mdp);
    if ('erreur' in lien) return jeu.erreur(lien.erreur, lien.code);
    lien.journal.forEach((l) => jeu.erreur(l, 0));
    if (!filtre) return jeu.erreur('ldap_search_ext: Bad search filter (-7)', 255);
    const a = annuaire(jeu)!;
    const base = o.base ?? defauts(jeu).base ?? '';
    const enTete =
      o.ldif >= 1
        ? []
        : [
            '# extended LDIF',
            '#',
            '# LDAPv3',
            `# base <${base}>${o.base ? '' : ' (default)'} with scope ${o.portee === 'sub' ? 'subtree' : o.portee === 'one' ? 'oneLevel' : 'baseObject'}`,
            `# filter: ${filtreTexte}`,
            `# requesting: ${demandes.length ? demandes.join(' ') : 'ALL'}`,
            '#',
            '',
          ];
    const racine = trouver(a, base);
    if (!racine) {
      jeu.statut = 32;
      return [
        ...enTete,
        ...(o.ldif >= 1 ? ['No such object (32)'] : ['# search result', 'search: 2', 'result: 32 No such object', '', '# numResponses: 1']),
      ].join('\n');
    }
    const trouvees = a.entrees.filter((e) => {
      if (!sous(e.dn, base)) return false;
      const profondeur = normaliser(e.dn).split(',').length - normaliser(base).split(',').length;
      if (o.portee === 'base' && profondeur !== 0) return false;
      if (o.portee === 'one' && profondeur !== 1) return false;
      return correspond(filtre, e);
    });
    const corps = trouvees.flatMap((e) => [...(o.ldif >= 2 ? [] : [`# ${titre(e.dn)}`]), ...lignesEntree(e, lien.id, demandes), '']);
    if (o.ldif >= 1) return corps.join('\n').trimEnd();
    return [
      ...enTete,
      ...corps,
      '# search result',
      'search: 2',
      'result: 0 Success',
      '',
      `# numResponses: ${trouvees.length + 1}`,
      ...(trouvees.length ? [`# numEntries: ${trouvees.length}`] : []),
    ].join('\n');
  });
}

// ldapadd, ldapmodify, ldapdelete : écrire dans l'annuaire.
function ecrireDans(jeu: Shell, nom: 'ldapadd' | 'ldapmodify' | 'ldapdelete', args: string[], entree: string | null): string {
  const o = lireOptions(args, 'portee');
  if (typeof o === 'string') return jeu.erreur(`${nom}: invalid option -- '${o}'`, 1);
  let changements: Changement[];
  if (nom === 'ldapdelete') {
    const dns = o.reste.length ? o.reste : (o.fichier ? (jeu.lire(o.fichier) ?? '') : (entree ?? '')).split('\n').filter((l) => l.trim());
    if (!dns.length) return jeu.erreur(jeu.t('ldap-rien-a-faire', { commande: nom }), 1);
    changements = dns.map((dn, i) => ({ quoi: 'delete', dn, ligne: i + 1 }));
  } else {
    const texte = o.fichier !== null ? jeu.lire(o.fichier) : entree;
    if (o.fichier !== null && texte === null) return jeu.erreur(`${nom}: ${o.fichier}: No such file or directory`, 1);
    if (texte === null) return jeu.erreur(jeu.t('ldap-rien-a-faire', { commande: nom }), 1);
    try {
      changements = lireLdif(texte, nom === 'ldapadd' || o.ajout);
    } catch (e) {
      return jeu.erreur((e as Error).message.replace(/^ldapmodify/, nom), 1);
    }
  }
  return avecMdp(jeu, o, (mdp) => {
    const lien = seLier(jeu, o, mdp);
    if ('erreur' in lien) return jeu.erreur(lien.erreur, lien.code);
    lien.journal.forEach((l) => jeu.erreur(l, 0));
    const a = annuaire(jeu)!;
    const sorties: string[] = [];
    for (const c of changements) {
      const dn = c.quoi === 'add' ? c.entree.dn : c.dn;
      const verbe = c.quoi === 'add' ? 'adding new entry' : c.quoi === 'delete' ? 'deleting entry' : 'modifying entry';
      if (nom !== 'ldapdelete') sorties.push(`${verbe} "${dn}"`);
      const op = c.quoi === 'add' ? 'ldap_add' : c.quoi === 'delete' ? 'ldap_delete' : 'ldap_modify';
      let e: ErreurLdap | null;
      if (lien.id.qui === 'anonyme') e = { code: 8, texte: 'Strong(er) authentication required', info: 'modifications require authentication' };
      else if (!ecrit(lien.id) && !mienne(lien.id, c)) e = { code: 50, texte: 'Insufficient access', info: `no write access to parent` };
      else e = appliquer(a, c);
      if (e) {
        sorties.push(`${op}: ${e.texte} (${e.code})${e.info ? `\n\tadditional info: ${e.info}` : ''}`);
        jeu.statut = e.code;
        if (!o.continuer) break;
      } else if (nom !== 'ldapdelete') sorties.push('');
    }
    return sorties.join('\n').trimEnd();
  });
}

// Une personne peut changer son propre mot de passe (et rien d'autre).
const mienne = (id: Identite, c: Changement) =>
  id.qui === 'personne' &&
  c.quoi === 'modify' &&
  normaliser(c.dn) === normaliser(id.dn) &&
  c.ops.every((o) => o.attr.toLowerCase() === 'userpassword');

function ldappasswd(jeu: Shell, args: string[]): string {
  const o = lireOptions(args, 'nouveau');
  if (typeof o === 'string') return jeu.erreur(`ldappasswd: invalid option -- '${o}'`, 1);
  const qui = jeu.qui;
  const reprendre = (faire: () => string) => {
    const avant = jeu.qui;
    jeu.qui = qui;
    try {
      const sortie = faire();
      return [...jeu.recupererErreurs(), sortie].filter(Boolean).join('\n');
    } finally {
      jeu.qui = avant;
    }
  };
  const changer = (nouveau: string | null) =>
    avecMdp(jeu, o, (mdp) => {
      const lien = seLier(jeu, o, mdp);
      if ('erreur' in lien) return jeu.erreur(lien.erreur, lien.code);
      lien.journal.forEach((l) => jeu.erreur(l, 0));
      const a = annuaire(jeu)!;
      const cible = o.reste[0] ?? (lien.id.qui === 'personne' ? lien.id.dn : null);
      if (!cible) return jeu.erreur('Result: Unwilling to perform (53)\nAdditional info: password modify extended operation requires a user', 53);
      const e = trouver(a, cible);
      if (!e) return jeu.erreur('Result: No such object (32)', 32);
      if (!ecrit(lien.id) && !(lien.id.qui === 'personne' && normaliser(lien.id.dn) === normaliser(e.dn)))
        return jeu.erreur(
          lien.id.qui === 'anonyme' ? 'Result: Strong(er) authentication required (8)' : 'Result: Insufficient access (50)',
          lien.id.qui === 'anonyme' ? 8 : 50,
        );
      const mot = nouveau ?? genere(jeu);
      e.attrs.userpassword = [hacher(jeu, mot)];
      return nouveau === null ? `New password: ${mot}` : '';
    });
  if (o.nouveau !== null) return changer(o.nouveau);
  if (!o.demanderNouveau) return changer(null);
  jeu.demander(
    'New password: ',
    (premier) =>
      reprendre(() => {
        jeu.demander(
          'Re-enter new password: ',
          (second) => reprendre(() => (premier === second ? changer(premier) : jeu.erreur('passwords do not match', 1))),
          true,
        );
        return '';
      }),
    true,
  );
  return '';
}

// Le mot de passe que choisit ldappasswd quand on ne lui en donne pas.
const genere = (jeu: Shell) => {
  const n = (jeu.etat.ldapGenere = (jeu.etat.ldapGenere ?? 0) + 1);
  return ['aB3dEf9h', 'Qw7rTy2u', 'Zx5cVb8n'][(n - 1) % 3];
};

function ldapwhoami(jeu: Shell, args: string[]): string {
  const o = lireOptions(args, 'portee');
  if (typeof o === 'string') return jeu.erreur(`ldapwhoami: invalid option -- '${o}'`, 1);
  return avecMdp(jeu, o, (mdp) => {
    const lien = seLier(jeu, o, mdp);
    if ('erreur' in lien) return jeu.erreur(lien.erreur, lien.code);
    lien.journal.forEach((l) => jeu.erreur(l, 0));
    const id = lien.id;
    const a = annuaire(jeu)!;
    if (id.qui === 'anonyme') return 'anonymous';
    if (id.qui === 'admin') return `dn:${a.admin}`;
    if (id.qui === 'racine') return `dn:${RACINE_EXTERNE}`;
    if (id.qui === 'local') return `dn:gidNumber=${id.uid}+uidNumber=${id.uid},cn=peercred,cn=external,cn=auth`;
    return `dn:${id.dn}`;
  });
}

function slappasswd(jeu: Shell, args: string[]): string {
  const k = args.indexOf('-s');
  if (k >= 0) return hacher(jeu, args[k + 1] ?? '');
  const inconnue = args.find((a) => a.startsWith('-') && !['-h'].includes(a));
  if (inconnue) return jeu.erreur(`slappasswd: invalid option -- '${inconnue.slice(1)}'`, 1);
  const qui = jeu.qui;
  jeu.demander(
    'New password: ',
    (premier) => {
      jeu.demander(
        'Re-enter new password: ',
        (second) => {
          const avant = jeu.qui;
          jeu.qui = qui;
          try {
            if (premier === second) return hacher(jeu, premier);
            jeu.erreur('Password values do not match', 1);
            return jeu.recupererErreurs().join('\n');
          } finally {
            jeu.qui = avant;
          }
        },
        true,
      );
      return '';
    },
    true,
  );
  return '';
}

function slapcat(jeu: Shell): string {
  if (jeu.qui !== 'root') return jeu.erreur('slapcat: could not open config directory "/etc/ldap/slapd.d": Permission denied', 1);
  const a: Annuaire | undefined = annuaire(jeu);
  if (!a) return '';
  return a.entrees
    .flatMap((e) => [...lignesEntree(e, { qui: 'racine' }, []), ''])
    .join('\n')
    .trimEnd();
}

export const LDAP: Record<string, Commande> = {
  ldapsearch: { propresOptions: true, lancer: ({ args, jeu }) => ldapsearch(jeu, args) },
  ldapadd: { propresOptions: true, lancer: ({ args, jeu, entree }) => ecrireDans(jeu, 'ldapadd', args, entree) },
  ldapmodify: { propresOptions: true, lancer: ({ args, jeu, entree }) => ecrireDans(jeu, 'ldapmodify', args, entree) },
  ldapdelete: { propresOptions: true, lancer: ({ args, jeu, entree }) => ecrireDans(jeu, 'ldapdelete', args, entree) },
  ldappasswd: { propresOptions: true, lancer: ({ args, jeu }) => ldappasswd(jeu, args) },
  ldapwhoami: { propresOptions: true, lancer: ({ args, jeu }) => ldapwhoami(jeu, args) },
  slappasswd: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => slappasswd(jeu, args) },
  slapcat: { section: 8, propresOptions: true, lancer: ({ jeu }) => slapcat(jeu) },
  ldif: { section: 5, lancer: () => '' },
};
