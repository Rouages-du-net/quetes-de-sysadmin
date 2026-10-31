// Histoire « La Ruche » — chapitre « L'annuaire » : les comptes de l'équipe
// sont dans un annuaire OpenLDAP (slapd, sur le routeur), installé par
// Sacha. Avant le Wi-Fi des bureaux (qui s'appuiera dessus), il faut le
// remettre d'aplomb :
//   - Camille est partie en décembre : supprimer son entrée (ldapdelete)
//     ET la retirer du groupe bureaux (memberUid n'est pas mis à jour tout
//     seul) ;
//   - Sami (l'Annexe) arrive : une entrée inetOrgPerson + posixAccount
//     (un LDIF, d'après modele-ines.ldif), avec un uidNumber libre, un mot
//     de passe en empreinte (slappasswd, ou ldappasswd) et pas en clair, et
//     memberUid: sami dans le groupe bureaux (ldapmodify).
// Objectif vérifié sur l'état de l'annuaire : plus aucune trace de camille,
// sami existe (classes, uidNumber unique, mot de passe chiffré) et est
// dans bureaux, slapd tourne.
// Sources : https://www.openldap.org/doc/admin26/dbtools.html,
// https://manpages.debian.org/trixie/ldap-utils/ldapmodify.1.en.html,
// https://wiki.debian.org/LDAP/OpenLDAPSetup

import { d, f, type Chapitre } from '../world';
import type { Jeu } from '../shell';
import { annuaire, enClair, hacherAvecSel, normaliser, trouver, type Annuaire, type Entree } from '../ldap';
import { serviceWg } from '../commands/wireguard';
import { monterWg } from '../wireguard';
import { systemd } from '../systemd';
import { FLUX_DMZ } from './dmz';
import { ANNEXE, PORTABLE_MALIK, WG0_ANNEXE } from './annex';
import { MALIK } from './remote-work';
import {
  comptesRuche,
  DNSMASQ_VLAN,
  initialiserPareFeu,
  INTERFACES_DMZ,
  lanAvecDmz,
  M,
  mondeRuche,
  MOT_DE_PASSE,
  NFTABLES_DMZ,
  SYSCTL_ROUTEUR,
  systemdRuche,
  planRuche,
} from './hive';

export const BASE = 'dc=thehive,dc=example';
export const ADMIN = `cn=admin,${BASE}`;
export const MDP_ADMIN = 'rayon-de-miel';
export const BUREAUX = `cn=bureaux,ou=groups,${BASE}`;

const personne = (uid: string, prenom: string, nom: string, numero: number, mdp: string, sel: string): Entree => ({
  dn: `uid=${uid},ou=people,${BASE}`,
  attrs: {
    objectclass: ['inetOrgPerson', 'posixAccount'],
    uid: [uid],
    cn: [`${prenom} ${nom}`],
    sn: [nom],
    givenname: [prenom],
    mail: [`${uid}@thehive.example`],
    uidnumber: [String(numero)],
    gidnumber: ['10000'],
    homedirectory: [`/home/${uid}`],
    loginshell: ['/bin/bash'],
    userpassword: [hacherAvecSel(mdp, sel)],
  },
});

/** L'annuaire de La Ruche, tel que Sacha l'a laissé. */
export function annuaireDeDepart(): Annuaire {
  return {
    base: BASE,
    admin: ADMIN,
    entrees: [
      { dn: BASE, attrs: { objectclass: ['top', 'dcObject', 'organization'], o: ['La Ruche'], dc: ['thehive'] } },
      { dn: `ou=people,${BASE}`, attrs: { objectclass: ['organizationalUnit'], ou: ['people'] } },
      { dn: `ou=groups,${BASE}`, attrs: { objectclass: ['organizationalUnit'], ou: ['groups'] } },
      personne('malik', 'Malik', 'Ferrand', 10001, 'ruche-malik-2027', 'Ab12Cd34'),
      personne('ines', 'Ines', 'Morel', 10002, 'ruche-ines-2027', 'Ef56Gh78'),
      personne('camille', 'Camille', 'Roux', 10003, 'ruche-camille-2026', 'Ij90Kl12'),
      {
        dn: `cn=equipe,ou=groups,${BASE}`,
        attrs: { objectclass: ['posixGroup'], cn: ['equipe'], gidnumber: ['10000'], memberuid: ['malik', 'ines', 'camille'] },
      },
      { dn: BUREAUX, attrs: { objectclass: ['posixGroup'], cn: ['bureaux'], gidnumber: ['10010'], memberuid: ['malik', 'ines', 'camille'] } },
    ],
  };
}

const LDAP_CONF = `#
# LDAP Defaults
#

# See ldap.conf(5) for details
# This file should be world readable but not world writable.

BASE	${BASE}
URI	ldap://localhost

TLS_CACERT	/etc/ssl/certs/ca-certificates.crt`;

const MODELE_INES = `# The entry for Ines (Sacha, 2026)
dn: uid=ines,ou=people,${BASE}
objectClass: inetOrgPerson
objectClass: posixAccount
uid: ines
cn: Ines Morel
sn: Morel
givenName: Ines
mail: ines@thehive.example
uidNumber: 10002
gidNumber: 10000
homeDirectory: /home/ines
loginShell: /bin/bash
userPassword: ruche-ines-2027`;

// ——— L'état de l'annuaire ———

const personnes = (a: Annuaire) => a.entrees.filter((e) => (e.attrs.objectclass ?? []).some((c) => c.toLowerCase() === 'posixaccount'));
const sami = (a: Annuaire) =>
  a.entrees.find((e) => (e.attrs.uid ?? []).includes('sami') && normaliser(e.dn).endsWith(normaliser(`ou=people,${BASE}`)));
const membres = (a: Annuaire, groupe: string) => trouver(a, groupe)?.attrs.memberuid ?? [];
const traceDeCamille = (a: Annuaire) =>
  a.entrees.some((e) => (e.attrs.uid ?? []).includes('camille') || (e.attrs.memberuid ?? []).includes('camille'));
const uidDouble = (a: Annuaire) => {
  const n = personnes(a).map((e) => e.attrs.uidnumber?.[0]);
  return n.some((x, i) => n.indexOf(x) !== i);
};
const motsEnClair = (a: Annuaire) => a.entrees.some((e) => (e.attrs.userpassword ?? []).some(enClair));
const samiComplet = (a: Annuaire) => {
  const e = sami(a);
  const classes = (e?.attrs.objectclass ?? []).map((c) => c.toLowerCase());
  return !!e && classes.includes('inetorgperson') && classes.includes('posixaccount') && (e.attrs.userpassword ?? []).length > 0;
};

const fini = (j: Jeu) => {
  const a = annuaire(j)!;
  return (
    systemd(j)?.services.slapd?.etat === 'active' &&
    !traceDeCamille(a) &&
    samiComplet(a) &&
    !uidDouble(a) &&
    !motsEnClair(a) &&
    membres(a, BUREAUX).includes('sami')
  );
};

/** Le service slapd de La Ruche. */
export const serviceSlapd = () => ({
  description: 'LSB: OpenLDAP standalone server (Lightweight Directory Access Protocol)',
  active: true,
  executable: 'slapd',
  processus: [
    {
      pid: 980,
      utilisateur: 'openldap',
      cpu: 0,
      mem: 0.4,
      commande: '/usr/sbin/slapd -h ldap:/// ldapi:/// -g openldap -u openldap -F /etc/ldap/slapd.d',
    },
  ],
});

export const annuaireChapitre: Chapitre = {
  id: 'annuaire',
  numero: 7,
  plan: planRuche({ teletravail: true, dmz: true, annexe: true, annuaire: true }),
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'nano',
    'cp',
    'mv',
    'rm',
    'echo',
    'sudo',
    'id',
    'whoami',
    'systemctl',
    'journalctl',
    'ldapsearch',
    'ldapadd',
    'ldapmodify',
    'ldapdelete',
    'ldappasswd',
    'ldapwhoami',
    'slappasswd',
    'slapcat',
  ],
  maison: M,
  accueil: 'courriel_malik.txt',
  noms: true,
  final: 'fin',
  motDePasse: MOT_DE_PASSE,
  comptes: () => {
    const c = comptesRuche();
    c.utilisateurs.openldap = { uid: 112, groupe: 'openldap', maison: '/var/lib/ldap', shell: '/bin/false' };
    c.groupes.openldap = { gid: 118, membres: [] };
    return c;
  },
  etat: () => {
    const sd = systemdRuche({ 'wg-quick@wg0': serviceWg('wg0'), slapd: serviceSlapd() });
    for (const nom of ['nftables', 'wg-quick@wg0']) Object.assign(sd.services[nom], { active: true, etat: 'active' });
    const l = lanAvecDmz();
    return {
      lan: { ...l, flux: FLUX_DMZ.map(({ permis: _, ...x }) => x), distants: [MALIK, ANNEXE] },
      systemd: sd,
      nft: { tables: [] },
      wg: {},
      ldap: annuaireDeDepart(),
      ldapAdmin: MDP_ADMIN,
    };
  },
  initialiser: (j) => {
    initialiserPareFeu(j);
    monterWg(j, 'wg0', true);
  },
  creerMonde: (t) =>
    mondeRuche({
      interfaces: INTERFACES_DMZ,
      dnsmasq: DNSMASQ_VLAN,
      nftables: NFTABLES_DMZ,
      sysctl: SYSCTL_ROUTEUR,
      etc: {
        wireguard: d({ 'wg0.conf': f(WG0_ANNEXE, { lignes: true, proprio: 'root', mode: 'rw-------' }) }, undefined, {
          proprio: 'root',
          mode: 'rwx------',
        }),
        ldap: d({ 'ldap.conf': f(LDAP_CONF, { lignes: true, proprio: 'root' }) }, undefined, { proprio: 'root' }),
      },
      maison: {
        'courriel_malik.txt': f(t('annuaire-courriel-malik', { admin: ADMIN, motdepasse: MDP_ADMIN })),
        'modele-ines.ldif': f(MODELE_INES, { lignes: true }),
        'malik-laptop.conf': f(PORTABLE_MALIK, { lignes: true }),
      },
    }),
  evenements: [
    { id: 'clair', condition: (j) => motsEnClair(annuaire(j)!), message: (j) => j.t('annuaire-evenement-clair') },
    { id: 'uid-double', condition: (j) => uidDouble(annuaire(j)!), message: (j) => j.t('annuaire-evenement-uid-double') },
    {
      id: 'camille-reste',
      condition: (j) => {
        const a = annuaire(j)!;
        return !trouver(a, `uid=camille,ou=people,${BASE}`) && traceDeCamille(a);
      },
      message: (j) => j.t('annuaire-evenement-camille-reste'),
    },
    {
      id: 'sami-seul',
      condition: (j) => samiComplet(annuaire(j)!) && !membres(annuaire(j)!, BUREAUX).includes('sami'),
      message: (j) => j.t('annuaire-evenement-sami-seul'),
    },
    { id: 'arrete', condition: (j) => systemd(j)?.services.slapd?.etat !== 'active', message: (j) => j.t('annuaire-evenement-arrete') },
    { id: 'fin', condition: fini, message: (j) => j.t('annuaire-evenement-fin') },
  ],
};
