// Story "The Hive" — chapter "The Directory": the team's accounts are in
// an OpenLDAP directory (slapd, on the router), installed by Sacha. Before
// the office Wi-Fi (which will rely on it), it needs putting straight:
//   - Camille left in December: delete her entry (ldapdelete)
//     AND remove her from the offices group (memberUid is not updated on
//     its own);
//   - Sami (the Annex) is arriving: an inetOrgPerson + posixAccount entry
//     (an LDIF, based on ines-template.ldif), with a free uidNumber, a hashed
//     password (slappasswd, or ldappasswd) rather than plain text, and
//     memberUid: sami in the offices group (ldapmodify).
// Objective checked on the directory's state: no trace of camille left,
// sami exists (classes, unique uidNumber, hashed password) and is in
// offices, slapd is running. The groups' names (offices, team) and the
// passwords are those of the language (name(), password()).
// Sources: https://www.openldap.org/doc/admin26/dbtools.html,
// https://manpages.debian.org/trixie/ldap-utils/ldapmodify.1.en.html,
// https://wiki.debian.org/LDAP/OpenLDAPSetup

import { d, f, name, password, type Chapter } from '../world';
import type { Translate } from '../../texts';
import type { Game } from '../shell';
import { directory, inClear, hashWithSalt, normalise, find, type Directory, type Input } from '../ldap';
import { serviceWg } from '../commands/wireguard';
import { mountWg } from '../wireguard';
import { systemd } from '../systemd';
import { FLUX_DMZ } from './dmz';
import { ANNEX, MALIK_LAPTOP, annexWg0 } from './annex';
import { fluxFor } from './zones';
import { MALIK } from './remote-work';
import {
  hiveAccounts,
  dnsmasqVlan,
  initialiseFirewall,
  interfacesDmz,
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
// The directory administrator's password (password(): honeycomb → rayon-de-miel).
export const ADMIN_PASSWORD = 'honeycomb';
/** A group of the directory, its name in the language (offices → bureaux, team → equipe). */
export const group = (t: Translate, cn: string) => `cn=${name(t, cn)},ou=groups,${BASE}`;
const offices = (j: Game) => group(j.t, 'offices');

const person = (t: Translate, uid: string, firstName: string, name: string, number: number, mdp: string, salt: string): Input => ({
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
    userpassword: [hashWithSalt(password(t, mdp), salt)],
  },
});

/** The Hive's directory, as Sacha left it. */
export function departureDirectory(t: Translate): Directory {
  return {
    base: BASE,
    admin: ADMIN,
    inputs: [
      { dn: BASE, attrs: { objectclass: ['top', 'dcObject', 'organization'], o: [t('directory-organisation')], dc: ['thehive'] } },
      { dn: `ou=people,${BASE}`, attrs: { objectclass: ['organizationalUnit'], ou: ['people'] } },
      { dn: `ou=groups,${BASE}`, attrs: { objectclass: ['organizationalUnit'], ou: ['groups'] } },
      person(t, 'malik', 'Malik', 'Ferrand', 10001, 'hive-malik-2027', 'Ab12Cd34'),
      person(t, 'ines', 'Ines', 'Morel', 10002, 'hive-ines-2027', 'Ef56Gh78'),
      person(t, 'camille', 'Camille', 'Roux', 10003, 'hive-camille-2026', 'Ij90Kl12'),
      {
        dn: group(t, 'team'),
        attrs: { objectclass: ['posixGroup'], cn: [name(t, 'team')], gidnumber: ['10000'], memberuid: ['malik', 'ines', 'camille'] },
      },
      {
        dn: group(t, 'offices'),
        attrs: { objectclass: ['posixGroup'], cn: [name(t, 'offices')], gidnumber: ['10010'], memberuid: ['malik', 'ines', 'camille'] },
      },
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

const inesTemplate = (t: Translate) => `# The entry for Ines (Sacha, 2026)
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
userPassword: ${password(t, 'hive-ines-2027')}`;

// ——— The directory's state ———

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
    members(a, offices(j)).includes('sami')
  );
};

/** The Hive's slapd service. */
export const serviceSlapd = () => ({
  description: 'LSB: OpenLDAP standalone server (Lightweight Directory Access Protocol)',
  active: true,
  executable: 'slapd',
  process: [
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
  final: 'end',
  password: PASSWORD,
  accounts: () => {
    const c = hiveAccounts();
    c.users.openldap = { uid: 112, group: 'openldap', home: '/var/lib/ldap', shell: '/bin/false' };
    c.groups.openldap = { gid: 118, members: [] };
    return c;
  },
  state: (t) => {
    const sd = hiveSystemd({ 'wg-quick@wg0': serviceWg('wg0'), slapd: serviceSlapd() });
    for (const name of ['nftables', 'wg-quick@wg0']) Object.assign(sd.services[name], { active: true, state: 'active' });
    const l = lanWithDmz(t);
    return {
      lan: { ...l, flux: fluxFor(t, FLUX_DMZ), remotes: [MALIK, ANNEX] },
      systemd: sd,
      nft: { tables: [] },
      wg: {},
      ldap: departureDirectory(t),
      ldapAdmin: password(t, ADMIN_PASSWORD),
    };
  },
  initialise: (j) => {
    initialiseFirewall(j);
    mountWg(j, 'wg0', true);
  },
  createWorld: (t) =>
    hiveWorld({
      interfaces: interfacesDmz(t),
      dnsmasq: dnsmasqVlan(t),
      nftables: NFTABLES_DMZ,
      sysctl: ROUTER_SYSCTL,
      etc: {
        wireguard: d({ 'wg0.conf': f(annexWg0(t), { lines: true, owner: 'root', mode: 'rw-------' }) }, undefined, {
          owner: 'root',
          mode: 'rwx------',
        }),
        ldap: d({ 'ldap.conf': f(LDAP_CONF, { lines: true, owner: 'root' }) }, undefined, { owner: 'root' }),
      },
      home: {
        'email_malik.txt': f(t('directory-email-malik', { admin: ADMIN, password: password(t, ADMIN_PASSWORD) })),
        'ines-template.ldif': f(inesTemplate(t), { lines: true }),
        'malik-laptop.conf': f(MALIK_LAPTOP, { lines: true }),
      },
    }),
  events: [
    { id: 'clear', condition: (j) => wordsInClear(directory(j)!), message: (j) => j.t('directory-event-clear') },
    { id: 'uid-double', condition: (j) => uidDouble(directory(j)!), message: (j) => j.t('directory-event-uid-double') },
    {
      id: 'camille-rest',
      condition: (j) => {
        const a = directory(j)!;
        return !find(a, `uid=camille,ou=people,${BASE}`) && camilleTrace(a);
      },
      message: (j) => j.t('directory-event-camille-rest'),
    },
    {
      id: 'sami-only',
      condition: (j) => completeSami(directory(j)!) && !members(directory(j)!, offices(j)).includes('sami'),
      message: (j) => j.t('directory-event-sami-only'),
    },
    { id: 'stopped', condition: (j) => systemd(j)?.services.slapd?.state !== 'active', message: (j) => j.t('directory-event-stopped') },
    { id: 'end', condition: finished, message: (j) => j.t('directory-event-end') },
  ],
};
