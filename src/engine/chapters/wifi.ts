// Story "The Hive", chapter "The Office Wi-Fi": no more shared Wi-Fi
// password written on a sticky note. The electrician installed an
// enterprise Wi-Fi access point (WPA2-Enterprise, 802.1X): each person
// connects with their directory account, and the access point puts them in the VLAN
// the RADIUS server tells it. The server is FreeRADIUS, on the
// router; it remains to configure it:
//   - let the access point talk to it: UDP 1812 in the input chain;
//   - declare it in clients.conf (its address, the shared secret);
//   - enable the ldap module (mods-enabled/ldap, a link) and configure it:
//     base_dn, an identity allowed to read passwords,
//     membership_filter (posixGroup groups have no memberOf);
//   - the users file: Ldap-Group == "bureaux" → VLAN 10, the other
//     accounts → VLAN 20 (order matters); and restart freeradius.
// Objective checked on the state: the access point's simulated requests (Malik,
// Inès, Sami → VLAN 10; Léo, from the café team → VLAN 20; Camille,
// who left → rejected) get the right answer, now AND at boot.
// Sources: https://wiki.freeradius.org/modules/Rlm_ldap, https://wiki.freeradius.org/config/Users,
// https://www.rfc-editor.org/rfc/rfc3580, https://wiki.debian.org/FreeRADIUS

import { d, f, type Chapter } from '../world';
import type { Game } from '../shell';
import { BASE, MDP_ADMIN, departureDirectory, serviceSlapd } from './directory';
import { hashWithSalt, type Directory } from '../ldap';
import { inside } from '../lan';
import { toBoot, nft, traverse } from '../nftables';
import { loadRadius, readRadius, radius, handle, vlanFor, type Request } from '../radius';
import { serviceWg } from '../commands/wireguard';
import { mountWg } from '../wireguard';
import { systemd } from '../systemd';
import { FLUX_DMZ } from './dmz';
import { ANNEX, MALIK_LAPTOP, ANNEX_WG0 } from './annex';
import { MALIK } from './remote-work';
import { openSsh } from './zones';
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

const BOUND = '10.10.30.20';
export const BOUND_SECRET = 'Rk7-borne-2028';

/** The directory at the end of "The Directory": Camille gone, Sami arrived; and Léo, from the café team. */
function wifiDirectory(): Directory {
  const a = departureDirectory();
  a.inputs = a.inputs.filter((e) => !e.dn.startsWith('uid=camille'));
  for (const e of a.inputs) if (e.attrs.memberuid) e.attrs.memberuid = e.attrs.memberuid.filter((m) => m !== 'camille');
  const person = (uid: string, firstName: string, name: string, number: number, mdp: string, salt: string) => ({
    dn: `uid=${uid},ou=people,${BASE}`,
    attrs: {
      objectclass: ['inetOrgPerson', 'posixAccount'],
      uid: [uid],
      cn: [`${firstName} ${name}`],
      sn: [name],
      givenname: [firstName],
      uidnumber: [String(number)],
      gidnumber: ['10000'],
      homedirectory: [`/home/${uid}`],
      userpassword: [hashWithSalt(mdp, salt)],
    },
  });
  a.inputs.push(
    person('sami', 'Sami', 'Lemaire', 10004, 'choisi-par-sami', 'Mn34Op56'),
    person('leo', 'Leo', 'Garnier', 10005, 'cafe-leo-2028', 'Qr78St90'),
  );
  for (const g of a.inputs.filter((e) => e.dn.startsWith('cn=equipe') || e.dn.startsWith('cn=bureaux'))) g.attrs.memberuid.push('sami');
  a.inputs.find((e) => e.dn.startsWith('cn=equipe'))!.attrs.memberuid.push('leo');
  return a;
}

// What the access point asks (each person with their password), and the expected answer.
const ATTEMPTS: { user: string; password: string; expected: number | 'refused' }[] = [
  { user: 'malik', password: 'ruche-malik-2027', expected: 10 },
  { user: 'ines', password: 'ruche-ines-2027', expected: 10 },
  { user: 'sami', password: 'choisi-par-sami', expected: 10 },
  { user: 'leo', password: 'cafe-leo-2028', expected: 20 },
  { user: 'camille', password: 'ruche-camille-2026', expected: 'refused' },
];
const request = (e: (typeof ATTEMPTS)[number]): Request => ({
  client: BOUND,
  iif: 'eth1.30',
  secret: BOUND_SECRET,
  user: e.user,
  password: e.password,
});
const REQUESTS = ATTEMPTS.map(request);

type O = Parameters<typeof handle>[2];
const responses = (j: Game, o: O = {}) => ATTEMPTS.map((e) => ({ e, r: handle(j, request(e), o) }));
const compliant = (j: Game, o: O = {}) => responses(j, o).every(({ e, r }) => (e.expected === 'refused' ? r.what !== 'accept' : vlanFor(r) === e.expected));
// At the next boot: the files' configuration, nftables from its file, slapd and freeradius enabled.
const toRadiusBoot = (j: Game): O => {
  const sd = systemd(j);
  return {
    conf: readRadius(j).conf,
    ruleset: (sd?.services.nftables?.active && toBoot(j)) || { tables: [] },
    works: !!sd?.services.freeradius?.active,
  };
};

// Does the access point's packet get through the input chain?
const filteredBound = (j: Game) =>
  !traverse(nft(j), 'input', 'filter', {
    iif: 'eth1.30',
    oif: '',
    saddr: BOUND,
    daddr: '10.10.30.1',
    proto: 'udp',
    sport: 41234,
    dport: 1812,
    ct: 'new',
    size: 120,
  }).pass;
const load = (j: Game) => radius(j)?.conf ?? null;
const notReread = (j: Game) => JSON.stringify(readRadius(j).conf) !== JSON.stringify(load(j)) && !!readRadius(j).conf;
const malik = (j: Game) => responses(j)[0].r;

const CLIENTS = `# -*- text -*-
##
## clients.conf -- client configuration directives
##
#  Define RADIUS clients (usually a NAS, Access Point, etc.).

client localhost {
	ipaddr = 127.0.0.1
	proto = *
	secret = testing123
	require_message_authenticator = no
	nas_type = other
}

# IPv6 Client
client localhost_ipv6 {
	ipv6addr = ::1
	secret = testing123
}

#client private-network-1 {
#	ipaddr = 192.0.2.0/24
#	secret = testing123-1
#}`;

const MODULE_LDAP = `# -*- text -*-
##
##  ldap -- LDAP module configuration
##

ldap {
	#  Note that this needs to match the name(s) in the LDAP server
	#  certificate, if you're using ldaps.
	server = 'localhost'

	#  Administrator account for searching and possibly modifying.
	#  If using SASL + KRB5 these should be commented out.
#	identity = 'cn=admin,dc=example,dc=org'
#	password = mypass

	#  Unless overridden in another section, the dn from which all
	#  searches will start from.
	base_dn = 'dc=example,dc=org'

	user {
		base_dn = "\${..base_dn}"
		filter = "(uid=%{%{Stripped-User-Name}:-%{User-Name}})"
	}

	group {
		base_dn = "\${..base_dn}"
		filter = '(objectClass=posixGroup)'
		membership_attribute = 'memberOf'
#		membership_filter = "(|(member=%{control:\${..user_dn}})(memberUid=%{%{Stripped-User-Name}:-%{User-Name}}))"
	}
}`;

const AUTHORIZE = `#
# 	Configuration file for the rlm_files module.
# 	Please see rlm_files(5) manpage for more information.
#
#	The first field is a user's name, or DEFAULT. Then come the check
#	items, on the same line. The reply items follow, one per line,
#	each indented by a tab, separated by commas.
#
#	The first matching entry is used, unless it says Fall-Through = Yes.
#
#	For example:
#
#bob	Cleartext-Password := "hello"
#	Reply-Message := "Hello, %{User-Name}"
#`;

const SITE = `server default {
	listen {
		type = auth
		ipaddr = *
		port = 0
	}
	authorize {
		filter_username
		preprocess
		chap
		mschap
		suffix
		eap
		files
		-sql
		-ldap
		expiration
		logintime
		pap
	}
	authenticate {
		Auth-Type PAP {
			pap
		}
		eap
	}
}`;

const link = (target: string) => f('', { lines: true, link: target, owner: 'root', group: 'freerad' });
const conf = (text: string) => f(text, { lines: true, owner: 'freerad', group: 'freerad', mode: 'rw-r-----' });
const directory = (children: Parameters<typeof d>[0]) => d(children, undefined, { owner: 'freerad', group: 'freerad', mode: 'rwxr-s---' });

export const wifi: Chapter = {
  id: 'wifi',
  number: 8,
  plan: hivePlan({ remoteWork: true, dmz: true, annex: true, directory: true, wifi: true }),
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
    'ln',
    'sudo',
    'id',
    'whoami',
    'systemctl',
    'journalctl',
    'reboot',
    'nft',
    'ldapsearch',
    'ldapwhoami',
    'freeradius',
    'radtest',
  ],
  home: M,
  welcome: 'email_malik.txt',
  names: true,
  final: 'end',
  password: PASSWORD,
  accounts: () => {
    const c = hiveAccounts();
    c.users.openldap = { uid: 112, group: 'openldap', home: '/var/lib/ldap', shell: '/bin/false' };
    c.users.freerad = { uid: 113, group: 'freerad', home: '/etc/freeradius', shell: '/bin/false' };
    c.groups.openldap = { gid: 118, members: [] };
    c.groups.freerad = { gid: 119, members: [] };
    return c;
  },
  state: () => {
    const sd = hiveSystemd({
      'wg-quick@wg0': serviceWg('wg0'),
      slapd: serviceSlapd(),
      freeradius: {
        description: 'FreeRADIUS multi-protocol policy server',
        active: true,
        executable: 'freeradius',
        process: [{ pid: 1630, user: 'freerad', cpu: 0, mem: 0.6, command: '/usr/sbin/freeradius -f' }],
        check: (j) => {
          const { errors } = readRadius(j);
          return errors.length ? errors : null;
        },
        load: (j) => loadRadius(j, REQUESTS),
      },
    });
    for (const name of ['nftables', 'wg-quick@wg0']) Object.assign(sd.services[name], { active: true, state: 'active' });
    return {
      lan: { ...lanWithDmz(), flux: FLUX_DMZ.map(({ permitted: _, ...x }) => x), remotes: [MALIK, ANNEX] },
      systemd: sd,
      nft: { tables: [] },
      wg: {},
      ldap: wifiDirectory(),
      ldapAdmin: MDP_ADMIN,
      radiusRequests: REQUESTS,
    };
  },
  initialise: (j) => {
    initialiseFirewall(j);
    mountWg(j, 'wg0', true);
    loadRadius(j, REQUESTS);
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
        freeradius: d(
          {
            '3.0': directory({
              'clients.conf': conf(CLIENTS),
              'mods-available': directory({
                ldap: conf(MODULE_LDAP),
                eap: conf('eap {\n\tdefault_eap_type = ttls\n}'),
                files: conf('files {\n}'),
                pap: conf('pap {\n}'),
              }),
              'mods-enabled': directory({
                eap: link('../mods-available/eap'),
                files: link('../mods-available/files'),
                pap: link('../mods-available/pap'),
              }),
              'mods-config': directory({ files: directory({ authorize: conf(AUTHORIZE) }) }),
              'sites-enabled': directory({ default: conf(SITE) }),
            }),
          },
          undefined,
          { owner: 'root' },
        ),
      },
      home: {
        'email_malik.txt': f(t('wifi-email-malik')),
        'ap-offices.txt': f(t('wifi-bound', { secret: BOUND_SECRET, address: BOUND }), { lines: true }),
        'malik-laptop.conf': f(MALIK_LAPTOP, { lines: true }),
      },
    }),
  events: [
    {
      // As soon as the access point is declared: its requests don't get through the input chain.
      id: 'filter',
      condition: (j) => filteredBound(j) && !!readRadius(j).conf?.clients.some((c) => inside(BOUND, c.network)),
      message: (j) => j.t('wifi-event-filter'),
    },
    { id: 'not-reread', condition: (j) => !filteredBound(j) && notReread(j), message: (j) => j.t('wifi-event-not-reread') },
    {
      id: 'unknown',
      condition: (j) => !filteredBound(j) && !notReread(j) && malik(j).what === 'nothing' && systemd(j)?.services.freeradius?.state === 'active',
      message: (j) => j.t('wifi-event-unknown'),
    },
    {
      id: 'without-ldap',
      condition: (j) => !notReread(j) && malik(j).what === 'reject' && !load(j)?.ldap,
      message: (j) => j.t('wifi-event-without-ldap'),
    },
    {
      id: 'anonymous',
      condition: (j) => !notReread(j) && malik(j).what === 'reject' && !!load(j)?.ldap && !load(j)?.ldap?.identity,
      message: (j) => j.t('wifi-event-anonymous'),
    },
    {
      id: 'groups',
      condition: (j) => !notReread(j) && malik(j).what === 'accept' && vlanFor(malik(j)) !== 10 && !load(j)?.ldap?.byMemberUid,
      message: (j) => j.t('wifi-event-groups'),
    },
    {
      id: 'order',
      condition: (j) => !notReread(j) && vlanFor(malik(j)) === 20 && !!load(j)?.ldap?.byMemberUid,
      message: (j) => j.t('wifi-event-order'),
    },
    { id: 'ssh', condition: (j) => !openSsh(nft(j)), message: (j) => j.t('zones-event-ssh') },
    { id: 'in-place', condition: (j) => compliant(j) && !compliant(j, toRadiusBoot(j)), message: (j) => j.t('wifi-event-in-place') },
    { id: 'end', condition: (j) => compliant(j) && openSsh(nft(j)) && compliant(j, toRadiusBoot(j)), message: (j) => j.t('wifi-event-end') },
  ],
};
