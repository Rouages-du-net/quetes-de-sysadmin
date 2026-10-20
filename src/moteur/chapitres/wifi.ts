// Histoire « La Ruche » — chapitre « Le Wi-Fi des bureaux » : fini le mot de
// passe Wi-Fi commun, écrit sur un post-it. L'électricien a installé une
// borne Wi-Fi d'entreprise (WPA2-Entreprise, 802.1X) : chaque personne se
// connecte avec son compte de l'annuaire, et la borne la place dans le VLAN
// que le serveur RADIUS lui indique. Le serveur, c'est FreeRADIUS, sur le
// routeur ; il reste à le régler :
//   - laisser la borne lui parler : UDP 1812 dans la chaîne input ;
//   - la déclarer dans clients.conf (son adresse, le secret partagé) ;
//   - activer le module ldap (mods-enabled/ldap, un lien) et le régler :
//     base_dn, une identité qui a le droit de lire les mots de passe,
//     membership_filter (les groupes posixGroup n'ont pas de memberOf) ;
//   - le fichier users : Ldap-Group == "bureaux" → VLAN 10, les autres
//     comptes → VLAN 20 (l'ordre compte) ; et redémarrer freeradius.
// Objectif vérifié sur l'état : les demandes simulées de la borne (Malik,
// Inès, Sami → VLAN 10 ; Léo, de l'équipe du café → VLAN 20 ; Camille,
// partie → refusée) ont la bonne réponse, maintenant ET au démarrage.
// Sources : https://wiki.freeradius.org/modules/Rlm_ldap, https://wiki.freeradius.org/config/Users,
// https://www.rfc-editor.org/rfc/rfc3580, https://wiki.debian.org/FreeRADIUS

import { d, f, type Chapitre } from '../monde';
import type { Jeu } from '../shell';
import { BASE, MDP_ADMIN, annuaireDeDepart, serviceSlapd } from './annuaire';
import { hacherAvecSel, type Annuaire } from '../ldap';
import { dans } from '../lan';
import { auDemarrage, nft, traverser } from '../nftables';
import { chargerRadius, lireRadius, radius, traiter, vlanDe, type Demande } from '../radius';
import { serviceWg } from '../commandes/wireguard';
import { monterWg } from '../wireguard';
import { systemd } from '../systemd';
import { FLUX_DMZ } from './dmz';
import { ANNEXE, PORTABLE_MALIK, WG0_ANNEXE } from './annexe';
import { MALIK } from './vpn';
import { sshOuvert } from './zones';
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
} from './ruche';

const BORNE = '10.10.30.20';
export const SECRET_BORNE = 'Rk7-borne-2028';

/** L'annuaire à la fin de « L'annuaire » : Camille partie, Sami arrivé ; et Léo, de l'équipe du café. */
function annuaireDuWifi(): Annuaire {
  const a = annuaireDeDepart();
  a.entrees = a.entrees.filter((e) => !e.dn.startsWith('uid=camille'));
  for (const e of a.entrees) if (e.attrs.memberuid) e.attrs.memberuid = e.attrs.memberuid.filter((m) => m !== 'camille');
  const personne = (uid: string, prenom: string, nom: string, numero: number, mdp: string, sel: string) => ({
    dn: `uid=${uid},ou=people,${BASE}`,
    attrs: {
      objectclass: ['inetOrgPerson', 'posixAccount'],
      uid: [uid],
      cn: [`${prenom} ${nom}`],
      sn: [nom],
      givenname: [prenom],
      uidnumber: [String(numero)],
      gidnumber: ['10000'],
      homedirectory: [`/home/${uid}`],
      userpassword: [hacherAvecSel(mdp, sel)],
    },
  });
  a.entrees.push(
    personne('sami', 'Sami', 'Lemaire', 10004, 'choisi-par-sami', 'Mn34Op56'),
    personne('leo', 'Leo', 'Garnier', 10005, 'cafe-leo-2028', 'Qr78St90'),
  );
  for (const g of a.entrees.filter((e) => e.dn.startsWith('cn=equipe') || e.dn.startsWith('cn=bureaux'))) g.attrs.memberuid.push('sami');
  a.entrees.find((e) => e.dn.startsWith('cn=equipe'))!.attrs.memberuid.push('leo');
  return a;
}

// Ce que la borne demande (chaque personne avec son mot de passe), et la réponse attendue.
const ESSAIS: { utilisateur: string; motDePasse: string; attendu: number | 'refus' }[] = [
  { utilisateur: 'malik', motDePasse: 'ruche-malik-2027', attendu: 10 },
  { utilisateur: 'ines', motDePasse: 'ruche-ines-2027', attendu: 10 },
  { utilisateur: 'sami', motDePasse: 'choisi-par-sami', attendu: 10 },
  { utilisateur: 'leo', motDePasse: 'cafe-leo-2028', attendu: 20 },
  { utilisateur: 'camille', motDePasse: 'ruche-camille-2026', attendu: 'refus' },
];
const demande = (e: (typeof ESSAIS)[number]): Demande => ({
  client: BORNE,
  iif: 'eth1.30',
  secret: SECRET_BORNE,
  utilisateur: e.utilisateur,
  motDePasse: e.motDePasse,
});
const DEMANDES = ESSAIS.map(demande);

type O = Parameters<typeof traiter>[2];
const reponses = (j: Jeu, o: O = {}) => ESSAIS.map((e) => ({ e, r: traiter(j, demande(e), o) }));
const conforme = (j: Jeu, o: O = {}) => reponses(j, o).every(({ e, r }) => (e.attendu === 'refus' ? r.quoi !== 'accept' : vlanDe(r) === e.attendu));
// Au prochain démarrage : la configuration des fichiers, nftables d'après son fichier, slapd et freeradius activés.
const auDemarrageRadius = (j: Jeu): O => {
  const sd = systemd(j);
  return {
    conf: lireRadius(j).conf,
    ruleset: (sd?.services.nftables?.active && auDemarrage(j)) || { tables: [] },
    marche: !!sd?.services.freeradius?.active,
  };
};

// Le paquet de la borne passe-t-il la chaîne input ?
const borneFiltree = (j: Jeu) =>
  !traverser(nft(j), 'input', 'filter', {
    iif: 'eth1.30',
    oif: '',
    saddr: BORNE,
    daddr: '10.10.30.1',
    proto: 'udp',
    sport: 41234,
    dport: 1812,
    ct: 'new',
    taille: 120,
  }).passe;
const charge = (j: Jeu) => radius(j)?.conf ?? null;
const pasRelu = (j: Jeu) => JSON.stringify(lireRadius(j).conf) !== JSON.stringify(charge(j)) && !!lireRadius(j).conf;
const malik = (j: Jeu) => reponses(j)[0].r;

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

const lien = (cible: string) => f('', { lignes: true, lien: cible, proprio: 'root', groupe: 'freerad' });
const conf = (texte: string) => f(texte, { lignes: true, proprio: 'freerad', groupe: 'freerad', mode: 'rw-r-----' });
const dossier = (enfants: Parameters<typeof d>[0]) => d(enfants, undefined, { proprio: 'freerad', groupe: 'freerad', mode: 'rwxr-s---' });

export const wifi: Chapitre = {
  id: 'wifi',
  numero: 8,
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
  maison: M,
  accueil: 'courriel_malik.txt',
  noms: true,
  final: 'fin',
  motDePasse: MOT_DE_PASSE,
  comptes: () => {
    const c = comptesRuche();
    c.utilisateurs.openldap = { uid: 112, groupe: 'openldap', maison: '/var/lib/ldap', shell: '/bin/false' };
    c.utilisateurs.freerad = { uid: 113, groupe: 'freerad', maison: '/etc/freeradius', shell: '/bin/false' };
    c.groupes.openldap = { gid: 118, membres: [] };
    c.groupes.freerad = { gid: 119, membres: [] };
    return c;
  },
  etat: () => {
    const sd = systemdRuche({
      'wg-quick@wg0': serviceWg('wg0'),
      slapd: serviceSlapd(),
      freeradius: {
        description: 'FreeRADIUS multi-protocol policy server',
        active: true,
        executable: 'freeradius',
        processus: [{ pid: 1630, utilisateur: 'freerad', cpu: 0, mem: 0.6, commande: '/usr/sbin/freeradius -f' }],
        verifier: (j) => {
          const { erreurs } = lireRadius(j);
          return erreurs.length ? erreurs : null;
        },
        charger: (j) => chargerRadius(j, DEMANDES),
      },
    });
    for (const nom of ['nftables', 'wg-quick@wg0']) Object.assign(sd.services[nom], { active: true, etat: 'active' });
    return {
      lan: { ...lanAvecDmz(), flux: FLUX_DMZ.map(({ permis: _, ...x }) => x), distants: [MALIK, ANNEXE] },
      systemd: sd,
      nft: { tables: [] },
      wg: {},
      ldap: annuaireDuWifi(),
      ldapAdmin: MDP_ADMIN,
      radiusDemandes: DEMANDES,
    };
  },
  initialiser: (j) => {
    initialiserPareFeu(j);
    monterWg(j, 'wg0', true);
    chargerRadius(j, DEMANDES);
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
        freeradius: d(
          {
            '3.0': dossier({
              'clients.conf': conf(CLIENTS),
              'mods-available': dossier({
                ldap: conf(MODULE_LDAP),
                eap: conf('eap {\n\tdefault_eap_type = ttls\n}'),
                files: conf('files {\n}'),
                pap: conf('pap {\n}'),
              }),
              'mods-enabled': dossier({
                eap: lien('../mods-available/eap'),
                files: lien('../mods-available/files'),
                pap: lien('../mods-available/pap'),
              }),
              'mods-config': dossier({ files: dossier({ authorize: conf(AUTHORIZE) }) }),
              'sites-enabled': dossier({ default: conf(SITE) }),
            }),
          },
          undefined,
          { proprio: 'root' },
        ),
      },
      maison: {
        'courriel_malik.txt': f(t('wifi-courriel-malik')),
        'borne-bureaux.txt': f(t('wifi-borne', { secret: SECRET_BORNE, adresse: BORNE }), { lignes: true }),
        'portable-malik.conf': f(PORTABLE_MALIK, { lignes: true }),
      },
    }),
  evenements: [
    {
      // Dès que la borne est déclarée : ses demandes ne passent pas la chaîne input.
      id: 'filtre',
      condition: (j) => borneFiltree(j) && !!lireRadius(j).conf?.clients.some((c) => dans(BORNE, c.reseau)),
      message: (j) => j.t('wifi-evenement-filtre'),
    },
    { id: 'pas-relu', condition: (j) => !borneFiltree(j) && pasRelu(j), message: (j) => j.t('wifi-evenement-pas-relu') },
    {
      id: 'inconnue',
      condition: (j) => !borneFiltree(j) && !pasRelu(j) && malik(j).quoi === 'rien' && systemd(j)?.services.freeradius?.etat === 'active',
      message: (j) => j.t('wifi-evenement-inconnue'),
    },
    {
      id: 'sans-ldap',
      condition: (j) => !pasRelu(j) && malik(j).quoi === 'reject' && !charge(j)?.ldap,
      message: (j) => j.t('wifi-evenement-sans-ldap'),
    },
    {
      id: 'anonyme',
      condition: (j) => !pasRelu(j) && malik(j).quoi === 'reject' && !!charge(j)?.ldap && !charge(j)?.ldap?.identite,
      message: (j) => j.t('wifi-evenement-anonyme'),
    },
    {
      id: 'groupes',
      condition: (j) => !pasRelu(j) && malik(j).quoi === 'accept' && vlanDe(malik(j)) !== 10 && !charge(j)?.ldap?.parMemberUid,
      message: (j) => j.t('wifi-evenement-groupes'),
    },
    {
      id: 'ordre',
      condition: (j) => !pasRelu(j) && vlanDe(malik(j)) === 20 && !!charge(j)?.ldap?.parMemberUid,
      message: (j) => j.t('wifi-evenement-ordre'),
    },
    { id: 'ssh', condition: (j) => !sshOuvert(nft(j)), message: (j) => j.t('zones-evenement-ssh') },
    { id: 'en-place', condition: (j) => conforme(j) && !conforme(j, auDemarrageRadius(j)), message: (j) => j.t('wifi-evenement-en-place') },
    { id: 'fin', condition: (j) => conforme(j) && sshOuvert(nft(j)) && conforme(j, auDemarrageRadius(j)), message: (j) => j.t('wifi-evenement-fin') },
  ],
};
