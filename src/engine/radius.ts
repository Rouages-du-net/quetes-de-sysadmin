// FreeRADIUS 3 sur une machine (etat.radius) : le serveur qui dit oui ou non
// aux bornes Wi-Fi d'entreprise (802.1X), d'après l'annuaire LDAP.
//   - la configuration (/etc/freeradius/3.0) : clients.conf (les bornes qui
//     ont le droit de poser des questions, et leur secret partagé), le module
//     ldap (mods-enabled/ldap, un lien vers mods-available/ldap), le fichier
//     des réponses (mods-config/files/authorize, « users ») ; lue au
//     démarrage du service, comme radiusd ;
//   - une demande (Access-Request) : la borne doit être un client connu, avec
//     le bon secret ; le module ldap trouve la personne (uid) et son
//     userPassword, pap compare le mot de passe ; le fichier users ajoute
//     les réponses (le VLAN : Tunnel-Private-Group-Id), d'après Ldap-Group.
// Sources : https://www.freeradius.org/documentation/freeradius-server/3.2.8/,
// https://wiki.freeradius.org/modules/Rlm_ldap, https://wiki.freeradius.org/config/Users,
// https://www.rfc-editor.org/rfc/rfc3580 (VLAN par RADIUS)
// Écarts : pas d'EAP simulé (les bornes parlent PAP, comme EAP-TTLS/PAP
// dans le tunnel), pas de comptabilité (accounting), ni de sites autres que
// default ; une syntaxe de configuration simplifiée (sections, clé = valeur).

import type { Jeu } from './shell';
import { annuaire, normaliser, trouver as trouverLdap, verifier, type Annuaire, type Entree } from './ldap';
import { dans, estIp } from './lan';
import { nft, traverser, type Ruleset } from './nftables';
import { journaliser, systemd } from './systemd';

export const DOSSIER = '/etc/freeradius/3.0';

// ——— La syntaxe des fichiers de configuration ———

export interface Section {
  nom: string;
  args: string[];
  valeurs: Record<string, string>;
  sections: Section[];
}

/** Lit un fichier de configuration de FreeRADIUS ; lève une erreur au format de radiusd. */
export function lireConfRadius(texte: string, fichier: string): Section {
  const racine: Section = { nom: '', args: [], valeurs: {}, sections: [] };
  const pile = [racine];
  texte.split('\n').forEach((brute, i) => {
    const ligne = brute.replace(/(^|\s)#.*$/, '').trim();
    if (!ligne) return;
    const lieu = `${fichier}[${i + 1}]`;
    if (ligne === '}') {
      if (pile.length === 1) throw new Error(`${lieu}: Too many closing braces`);
      pile.pop();
      return;
    }
    const ouvre = /^([\w.-]+)((?:\s+[^\s{]+)*)\s*\{$/.exec(ligne);
    if (ouvre) {
      const s: Section = { nom: ouvre[1], args: ouvre[2].trim().split(/\s+/).filter(Boolean), valeurs: {}, sections: [] };
      pile.at(-1)!.sections.push(s);
      pile.push(s);
      return;
    }
    const kv = /^([\w.:-]+)\s*(\+?=|:=)\s*(.*)$/.exec(ligne);
    if (kv) {
      const valeur = kv[3].trim().replace(/^(['"])(.*)\1$/, '$2');
      if (!valeur) throw new Error(`${lieu}: Syntax error: Expected value after "${kv[1]} ="`);
      pile.at(-1)!.valeurs[kv[1]] = valeur;
      return;
    }
    if (/^[\w.-]+(\s+[\w.-]+)*$/.test(ligne)) {
      // Un nom seul (un module listé dans authorize { … }), ou une section sans accolade.
      if (/^(client|ldap|user|group)\b/.test(ligne) && pile.length === 1)
        throw new Error(`${lieu}: Expecting section start brace '{' after "${ligne}"`);
      pile.at(-1)!.valeurs[ligne] = '';
      return;
    }
    throw new Error(`${lieu}: Parse error after "${ligne.split(/\s+/)[0]}"`);
  });
  if (pile.length > 1) throw new Error(`${fichier}[${texte.split('\n').length}]: Section "${pile.at(-1)!.nom}" is missing a closing brace`);
  return racine;
}

// ——— Le fichier users (mods-config/files/authorize) ———

export interface EntreeUsers {
  nom: string;
  verifications: { attr: string; op: string; valeur: string }[];
  reponses: { attr: string; op: string; valeur: string }[];
  suite: boolean;
}

const COUPLE = /^([\w-]+(?::\d+)?)\s*(==|:=|=|\+=|!=|=~)\s*("[^"]*"|[^,\s]+)$/;

export function lireUsers(texte: string, fichier: string): EntreeUsers[] {
  const entrees: EntreeUsers[] = [];
  let courante: EntreeUsers | null = null;
  texte.split('\n').forEach((brute, i) => {
    if (/^\s*#/.test(brute) || !brute.trim()) return;
    const lieu = `${fichier}[${i + 1}]`;
    const couples = (bout: string) =>
      bout
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => {
          const m = COUPLE.exec(x);
          if (!m)
            throw new Error(
              `${lieu}: Parse error (${courante ? 'reply' : 'check'}) for entry ${courante?.nom ?? x.split(/\s+/)[0]}: Expected end of line or comma`,
            );
          return { attr: m[1], op: m[2], valeur: m[3].replace(/^"(.*)"$/, '$1') };
        });
    if (!/^\s/.test(brute)) {
      const [nom, ...reste] = brute.trim().split(/\s+/);
      courante = { nom, verifications: [], reponses: [], suite: false };
      entrees.push(courante);
      courante.verifications = couples(reste.join(' '));
      return;
    }
    if (!courante) throw new Error(`${lieu}: Entry does not begin with a user name`);
    const r = couples(brute);
    for (const c of r) {
      if (c.attr === 'Fall-Through') courante.suite = /^(yes|1)$/i.test(c.valeur);
      else courante.reponses.push(c);
    }
  });
  return entrees;
}

// ——— La configuration chargée ———

export interface ConfRadius {
  clients: { nom: string; reseau: string; secret: string }[];
  ldap: null | { serveur: string; identite?: string; motDePasse?: string; base: string; userBase: string; groupeBase: string; parMemberUid: boolean };
  users: EntreeUsers[];
}

/** Lit toute la configuration, comme radiusd au démarrage (ou freeradius -XC) ; les erreurs en lignes. */
export function lireRadius(j: Jeu): { conf: ConfRadius | null; erreurs: string[] } {
  const lire = (f: string) => j.lire(`${DOSSIER}/${f}`);
  try {
    const clients = lireConfRadius(lire('clients.conf') ?? '', `${DOSSIER}/clients.conf`)
      .sections.filter((s) => s.nom === 'client')
      .map((s) => {
        const ip = s.valeurs.ipaddr ?? s.valeurs.ipv4addr ?? s.valeurs.ipv6addr ?? '';
        if (!s.valeurs.secret) throw new Error(`${DOSSIER}/clients.conf: No 'secret' was specified for client ${s.args[0] ?? ''}`);
        return { nom: s.args[0] ?? '', reseau: ip.includes('/') || !estIp(ip) ? ip : `${ip}/32`, secret: s.valeurs.secret };
      });
    let ldap: ConfRadius['ldap'] = null;
    const texteLdap = lire('mods-enabled/ldap');
    if (texteLdap !== null) {
      const s = lireConfRadius(texteLdap, `${DOSSIER}/mods-enabled/ldap`).sections.find((x) => x.nom === 'ldap');
      if (s) {
        const base = s.valeurs.base_dn ?? '';
        const remplacer = (v: string | undefined) => (v ?? '${..base_dn}').replace('${..base_dn}', base);
        const user = s.sections.find((x) => x.nom === 'user');
        const groupe = s.sections.find((x) => x.nom === 'group');
        ldap = {
          serveur: s.valeurs.server ?? 'localhost',
          identite: s.valeurs.identity,
          motDePasse: s.valeurs.password,
          base,
          userBase: remplacer(user?.valeurs.base_dn),
          groupeBase: remplacer(groupe?.valeurs.base_dn),
          parMemberUid: /memberUid=/.test(groupe?.valeurs.membership_filter ?? ''),
        };
      }
    }
    const users = lireUsers(lire('mods-config/files/authorize') ?? '', `${DOSSIER}/mods-config/files/authorize`);
    return { conf: { clients, ldap, users }, erreurs: [] };
  } catch (e) {
    return { conf: null, erreurs: [(e as Error).message, `Errors reading or parsing ${DOSSIER}/radiusd.conf`] };
  }
}

export const radius = (j: Jeu) => j.etat.radius as { conf: ConfRadius | null } | undefined;
export const enMarche = (j: Jeu) => systemd(j)?.services.freeradius?.etat === 'active';

// ——— Une demande ———

export interface Demande {
  // D'où vient la demande : la borne (son adresse et l'interface du routeur), ou le routeur lui-même (radtest).
  client: string;
  iif: string;
  secret: string;
  utilisateur: string;
  motDePasse: string;
}

export interface Reponse {
  // accept, reject, ou rien (la demande est ignorée : pas de réponse du tout).
  quoi: 'accept' | 'reject' | 'rien';
  attributs: { attr: string; valeur: string }[];
  // Ce que radiusd écrit (journal, ou radiusd -X).
  journal: string[];
}

const groupeDe = (a: Annuaire, conf: NonNullable<ConfRadius['ldap']>, uid: string, user: Entree, groupe: string): boolean => {
  const g = a.entrees.find(
    (e) =>
      (e.attrs.objectclass ?? []).some((c) => c.toLowerCase() === 'posixgroup') &&
      normaliser(e.dn).endsWith(normaliser(conf.groupeBase)) &&
      ((e.attrs.cn ?? []).includes(groupe) || normaliser(e.dn) === normaliser(groupe)),
  );
  if (!g) return false;
  // Par défaut, rlm_ldap cherche l'attribut memberOf de l'utilisateur ; membership_filter permet memberUid.
  if (conf.parMemberUid) return (g.attrs.memberuid ?? []).includes(uid);
  return (user.attrs.memberof ?? []).some((m) => normaliser(m) === normaliser(g.dn));
};

/** Ce que répond radiusd à une demande, avec cette configuration chargée. */
export function traiter(j: Jeu, d: Demande, o: { conf?: ConfRadius | null; ruleset?: Ruleset; marche?: boolean } = {}): Reponse {
  const conf = o.conf !== undefined ? o.conf : (radius(j)?.conf ?? null);
  const marche = o.marche ?? enMarche(j);
  const journal: string[] = [];
  const rien = (): Reponse => ({ quoi: 'rien', attributs: [], journal });
  if (!marche || !conf) return rien();
  // La chaîne input du pare-feu : UDP 1812 vers le routeur.
  const paquet = {
    iif: d.iif,
    oif: '',
    saddr: d.client,
    daddr: '10.10.30.1',
    proto: 'udp' as const,
    sport: 41234,
    dport: 1812,
    ct: 'new' as const,
    taille: 120,
  };
  if (d.iif !== 'lo' && !traverser(o.ruleset ?? nft(j), 'input', 'filter', paquet).passe) return rien();
  const client = conf.clients.find((c) => (c.reseau.includes('/') ? dans(d.client, c.reseau) : c.reseau === d.client));
  if (!client) {
    journal.push(`Ignoring request to auth address * port 1812 bound to server default from unknown client ${d.client} port 41234 proto udp`);
    return rien();
  }
  if (client.secret !== d.secret) {
    journal.push(
      `Dropping packet without response because of error: Received packet from ${d.client} with invalid Message-Authenticator!  (Shared secret is incorrect.)`,
    );
    return rien();
  }
  const refus = (raison: string): Reponse => {
    journal.push(`Auth: (0) Login incorrect (${raison}): [${d.utilisateur}] (from client ${client.nom} port 0)`);
    return { quoi: 'reject', attributs: [], journal };
  };
  // Le module ldap : se présenter, trouver la personne, lire son userPassword.
  const l = conf.ldap;
  const a = annuaire(j);
  let entree: Entree | undefined;
  if (l) {
    if (!a || systemd(j)?.services.slapd?.etat !== 'active') {
      journal.push(`rlm_ldap (ldap): Bind with ${l.identite ?? '(anonymous)'} to ldap://${l.serveur}:389 failed: Can't contact LDAP server`);
      return refus('ldap: module failed');
    }
    if (
      l.identite &&
      !(normaliser(l.identite) === normaliser(a.admin)
        ? verifier(String(j.etat.ldapAdmin ?? ''), l.motDePasse ?? '')
        : (trouverLdap(a, l.identite)?.attrs.userpassword ?? []).some((v) => verifier(v, l.motDePasse ?? '')))
    ) {
      journal.push(`rlm_ldap (ldap): Bind with ${l.identite} to ldap://${l.serveur}:389 failed: Invalid credentials`);
      return refus('ldap: module failed');
    }
    entree = a.entrees.find(
      (e) => (e.attrs.uid ?? []).includes(d.utilisateur) && normaliser(e.dn).endsWith(normaliser(l.userBase)) && l.userBase !== '',
    );
    if (!entree) {
      journal.push(`(0) ldap: User object not found`);
      return refus('No Auth-Type found: rejecting the user via Post-Auth-Type = Reject');
    }
  }
  // Le mot de passe « connu » : seulement si l'identité du module a le droit de lire userPassword.
  const admin = !!l?.identite && normaliser(l.identite) === normaliser(a?.admin ?? '');
  const connus = entree && admin ? (entree.attrs.userpassword ?? []) : [];
  if (!connus.length) {
    journal.push('(0) pap: WARNING: No "known good" password found for the user.  Not setting Auth-Type');
    return refus('No Auth-Type found: rejecting the user via Post-Auth-Type = Reject');
  }
  if (!connus.some((v) => verifier(v, d.motDePasse))) return refus('pap: Password comparison failed');
  // Le fichier users : la première entrée qui correspond (et les suivantes si Fall-Through).
  const attributs: Reponse['attributs'] = [];
  for (const u of conf.users) {
    if (u.nom !== 'DEFAULT' && u.nom !== d.utilisateur) continue;
    const ok = u.verifications.every((v) => {
      if (v.attr.toLowerCase() === 'ldap-group') {
        const membre = !!l && !!a && !!entree && groupeDe(a, l, d.utilisateur, entree, v.valeur);
        return v.op === '!=' ? !membre : membre;
      }
      if (v.attr === 'Auth-Type') return true;
      return false;
    });
    if (!ok) continue;
    if (u.verifications.some((v) => v.attr === 'Auth-Type' && v.valeur === 'Reject')) return refus('Auth-Type = Reject');
    for (const r of u.reponses) {
      const i = attributs.findIndex((x) => x.attr === r.attr);
      if (i >= 0 && r.op !== '+=') attributs[i] = { attr: r.attr, valeur: r.valeur };
      else attributs.push({ attr: r.attr, valeur: r.valeur });
    }
    if (!u.suite) break;
  }
  journal.push(`Auth: (0) Login OK: [${d.utilisateur}] (from client ${client.nom} port 0)`);
  return { quoi: 'accept', attributs, journal };
}

/** Le VLAN qu'une réponse donne (Tunnel-Private-Group-Id), s'il est complet (avec Tunnel-Type et Tunnel-Medium-Type). */
export function vlanDe(r: Reponse): number | null {
  const v = (n: string) => r.attributs.find((x) => x.attr.replace(/:\d+$/, '') === n)?.valeur;
  if (r.quoi !== 'accept' || v('Tunnel-Type') !== 'VLAN' || !['IEEE-802', '6'].includes(v('Tunnel-Medium-Type') ?? '')) return null;
  const id = Number(v('Tunnel-Private-Group-Id'));
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Au démarrage de freeradius : la configuration est lue (et gardée) ; les demandes des bornes sont journalisées. */
export function chargerRadius(j: Jeu, demandes: Demande[] = []) {
  const { conf } = lireRadius(j);
  j.etat.radius = { conf };
  const sd = systemd(j);
  if (!sd) return;
  journaliser(sd, 'freeradius.service', 'freeradius', 1630, 'Ready to process requests');
  for (const d of demandes) for (const l of traiter(j, d).journal) journaliser(sd, 'freeradius.service', 'freeradius', 1630, l);
}
