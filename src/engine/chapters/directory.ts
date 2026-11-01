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

import { d, f, type Chapter } from '../world';
import type { Game } from '../shell';
import { directory, inClear, hashWithSalt, normalise, find, type Directory, type Input } from '../ldap';
import { serviceWg } from '../commands/wireguard';
import { mountWg } from '../wireguard';
import { systemd } from '../systemd';
import { FLUX_DMZ } from './dmz';
import { ANNEX, MALIK_LAPTOP, ANNEX_WG0 } from './annex';
import { MALIK } from './remote-work';
import {
  hiveAccounts,
  DNSMASQ_VLAN,
  initialiseFirewall,
  INTERFACES_DMZ,
  lanWithDmz,
  M,
  hiveWorld,
  PASSWORD,
  NFTABLES_DMZ,
  ROUTER_SYSCTL,
  hiveSystemd,
  hivePlan,
} from './hive';

export const BASE = 'dc=thehive,dc=example';
export const ADMIN = `cn=admin,${BASE}`;
export const MDP_ADMIN = 'rayon-de-miel';
export const OFFICES = `cn=bureaux,ou=groups,${BASE}`;

const person = (uid: string, firstName: string, name: string, number: number, mdp: string, salt: string): Input => ({
  dn: `uid=${uid},ou=people,${BASE}`,
  attrs: {
    objectclass: ['inetOrgPerson', 'posixAccount'],
    uid: [uid],
    cn: [`${firstName} ${name}`],
    sn: [name],
    givenname: [firstName],
    mail: [`${uid}@thehive.example`],
    uidnumber: [String(number)],
    gidnumber: ['10000'],
    homedirectory: [`/home/${uid}`],
    loginshell: ['/bin/bash'],
    userpassword: [hashWithSalt(mdp, salt)],
  },
});

/** L'annuaire de La Ruche, tel que Sacha l'a laissé. */
export function departureDirectory(): Directory {
  return {
    base: BASE,
    admin: ADMIN,
    inputs: [
      { dn: BASE, attrs: { objectclass: ['top', 'dcObject', 'organization'], o: ['La Ruche'], dc: ['thehive'] } },
      { dn: `ou=people,${BASE}`, attrs: { objectclass: ['organizationalUnit'], ou: ['people'] } },
      { dn: `ou=groups,${BASE}`, attrs: { objectclass: ['organizationalUnit'], ou: ['groups'] } },
      person('malik', 'Malik', 'Ferrand', 10001, 'ruche-malik-2027', 'Ab12Cd34'),
      person('ines', 'Ines', 'Morel', 10002, 'ruche-ines-2027', 'Ef56Gh78'),
      person('camille', 'Camille', 'Roux', 10003, 'ruche-camille-2026', 'Ij90Kl12'),
      {
        dn: `cn=equipe,ou=groups,${BASE}`,
        attrs: { objectclass: ['posixGroup'], cn: ['equipe'], gidnumber: ['10000'], memberuid: ['malik', 'ines', 'camille'] },
      },
      { dn: OFFICES, attrs: { objectclass: ['posixGroup'], cn: ['bureaux'], gidnumber: ['10010'], memberuid: ['malik', 'ines', 'camille'] } },
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

const INES_TEMPLATE = `# The entry for Ines (Sacha, 2026)
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

const people = (a: Directory) => a.inputs.filter((e) => (e.attrs.objectclass ?? []).some((c) => c.toLowerCase() === 'posixaccount'));
const sami = (a: Directory) =>
  a.inputs.find((e) => (e.attrs.uid ?? []).includes('sami') && normalise(e.dn).endsWith(normalise(`ou=people,${BASE}`)));
const members = (a: Directory, group: string) => find(a, group)?.attrs.memberuid ?? [];
const camilleTrace = (a: Directory) =>
  a.inputs.some((e) => (e.attrs.uid ?? []).includes('camille') || (e.attrs.memberuid ?? []).includes('camille'));
const uidDouble = (a: Directory) => {
  const n = people(a).map((e) => e.attrs.uidnumber?.[0]);
  return n.some((x, i) => n.indexOf(x) !== i);
};
const wordsInClear = (a: Directory) => a.inputs.some((e) => (e.attrs.userpassword ?? []).some(inClear));
const completeSami = (a: Directory) => {
  const e = sami(a);
  const classes = (e?.attrs.objectclass ?? []).map((c) => c.toLowerCase());
  return !!e && classes.includes('inetorgperson') && classes.includes('posixaccount') && (e.attrs.userpassword ?? []).length > 0;
};

const finished = (j: Game) => {
  const a = directory(j)!;
  return (
    systemd(j)?.services.slapd?.state === 'active' &&
    !camilleTrace(a) &&
    completeSami(a) &&
    !uidDouble(a) &&
    !wordsInClear(a) &&
    members(a, OFFICES).includes('sami')
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
      user: 'openldap',
      cpu: 0,
      mem: 0.4,
      command: '/usr/sbin/slapd -h ldap:/// ldapi:/// -g openldap -u openldap -F /etc/ldap/slapd.d',
    },
  ],
});

export const chapterDirectory: Chapter = {
  id: 'directory',
  number: 7,
  plan: hivePlan({ remoteWork: true, dmz: true, annex: true, directory: true }),
  commands: [
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
  home: M,
  welcome: 'email_malik.txt',
  names: true,
  final: 'fin',
  password: PASSWORD,
  accounts: () => {
    const c = hiveAccounts();
    c.users.openldap = { uid: 112, group: 'openldap', home: '/var/lib/ldap', shell: '/bin/false' };
    c.groups.openldap = { gid: 118, members: [] };
    return c;
  },
  state: () => {
    const sd = hiveSystemd({ 'wg-quick@wg0': serviceWg('wg0'), slapd: serviceSlapd() });
    for (const name of ['nftables', 'wg-quick@wg0']) Object.assign(sd.services[name], { active: true, state: 'active' });
    const l = lanWithDmz();
    return {
      lan: { ...l, flux: FLUX_DMZ.map(({ permitted: _, ...x }) => x), remotes: [MALIK, ANNEX] },
      systemd: sd,
      nft: { tables: [] },
      wg: {},
      ldap: departureDirectory(),
      ldapAdmin: MDP_ADMIN,
    };
  },
  initialise: (j) => {
    initialiseFirewall(j);
    mountWg(j, 'wg0', true);
  },
  createWorld: (t) =>
    hiveWorld({
      interfaces: INTERFACES_DMZ,
      dnsmasq: DNSMASQ_VLAN,
      nftables: NFTABLES_DMZ,
      sysctl: ROUTER_SYSCTL,
      etc: {
        wireguard: d({ 'wg0.conf': f(ANNEX_WG0, { lines: true, owner: 'root', mode: 'rw-------' }) }, undefined, {
          owner: 'root',
          mode: 'rwx------',
        }),
        ldap: d({ 'ldap.conf': f(LDAP_CONF, { lines: true, owner: 'root' }) }, undefined, { owner: 'root' }),
      },
      home: {
        'email_malik.txt': f(t('directory-courriel-malik', { admin: ADMIN, motdepasse: MDP_ADMIN })),
        'modele-ines.ldif': f(INES_TEMPLATE, { lines: true }),
        'malik-laptop.conf': f(MALIK_LAPTOP, { lines: true }),
      },
    }),
  events: [
    { id: 'clair', condition: (j) => wordsInClear(directory(j)!), message: (j) => j.t('directory-evenement-clair') },
    { id: 'uid-double', condition: (j) => uidDouble(directory(j)!), message: (j) => j.t('directory-evenement-uid-double') },
    {
      id: 'camille-reste',
      condition: (j) => {
        const a = directory(j)!;
        return !find(a, `uid=camille,ou=people,${BASE}`) && camilleTrace(a);
      },
      message: (j) => j.t('directory-evenement-camille-reste'),
    },
    {
      id: 'sami-seul',
      condition: (j) => completeSami(directory(j)!) && !members(directory(j)!, OFFICES).includes('sami'),
      message: (j) => j.t('directory-evenement-sami-seul'),
    },
    { id: 'arrete', condition: (j) => systemd(j)?.services.slapd?.state !== 'active', message: (j) => j.t('directory-evenement-arrete') },
    { id: 'fin', condition: finished, message: (j) => j.t('directory-evenement-fin') },
  ],
};
