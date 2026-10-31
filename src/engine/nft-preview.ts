// Ce que nft montre sur une machine gérée par ufw et fail2ban : ufw écrit
// ses règles avec iptables, qui sur Debian passe par nftables (iptables-nft,
// table ip filter et chaînes ufw-*) ; fail2ban, avec l'action nftables de
// Debian, ajoute sa table inet f2b-table (un ensemble d'adresses bannies
// par prison, et une règle qui les rejette sur les ports de la prison).
// Sources : https://manpages.ubuntu.com/manpages/noble/man8/ufw-framework.8.html,
// https://wiki.nftables.org/wiki-nftables/index.php/Legacy_xtables_tools,
// /etc/fail2ban/action.d/nftables.conf (paquet fail2ban de Debian 12).
// Écarts : un aperçu en lecture seule (nft list ruleset, list tables,
// list table) ; ni la table ip6 filter, ni les chaînes de journalisation et
// de routage de ufw ; les compteurs restent à zéro ; plusieurs ports d'un
// profil (Nginx Full) en un seul ensemble { 80, 443 }.

import type { Jeu } from './shell';
import type { PareFeu, Regle } from './firewall';
import { actives, bannisDe, type EtatFail2ban } from './fail2ban';
import { systemd } from './systemd';

const COMPTEUR = 'counter packets 0 bytes 0';

// Les protocoles d'une règle de ufw : « 22/tcp », un profil (tcp), ou un port nu (tcp et udp).
function protocoles(r: Regle): string[] {
  const m = /\/(tcp|udp)$/.exec(r.vers);
  if (m) return [m[1]];
  return /^\d+$/.test(r.vers) ? ['tcp', 'udp'] : ['tcp'];
}

function lignesRegle(r: Regle): string[] {
  const source = r.de ? `ip saddr ${r.de} ` : '';
  const verdict = { allow: 'accept', limit: 'accept', deny: 'drop', reject: 'reject' }[r.action];
  if (!r.ports.length) return [`${source}${COMPTEUR} ${verdict}`];
  return protocoles(r).flatMap((p) => {
    const ports = r.ports.length > 1 ? `{ ${r.ports.join(', ')} }` : String(r.ports[0]);
    const filtre = `${source}meta l4proto ${p} ${p} dport ${ports}`;
    // limit : ufw passe par le module recent d'iptables, que nft n'affiche qu'en « xt match ».
    if (r.action === 'limit')
      return [
        `${filtre} ct state new xt match "recent" ${COMPTEUR}`,
        `${filtre} ct state new xt match "recent" ${COMPTEUR} jump ufw-user-limit`,
        `${filtre} ${COMPTEUR} jump ufw-user-limit-accept`,
      ];
    return [`${filtre} ${COMPTEUR} ${verdict}`];
  });
}

const chaine = (nom: string, lignes: string[]) => [`\tchain ${nom} {`, ...lignes.map((l) => `\t\t${l}`), '\t}'];

function tableUfw(pf: PareFeu): string[] {
  const politique = pf.entrant === 'allow' ? 'accept' : 'drop';
  return [
    'table ip filter {',
    ...chaine('INPUT', [
      `type filter hook input priority filter; policy ${politique};`,
      `${COMPTEUR} jump ufw-before-input`,
      `${COMPTEUR} jump ufw-user-input`,
      `${COMPTEUR} jump ufw-after-input`,
      ...(pf.entrant === 'reject' ? [`${COMPTEUR} jump ufw-reject-input`] : []),
    ]),
    '',
    ...chaine('OUTPUT', [`type filter hook output priority filter; policy ${pf.sortant === 'allow' ? 'accept' : 'drop'};`]),
    '',
    ...chaine('ufw-before-input', [
      `iifname "lo" ${COMPTEUR} accept`,
      `ct state related,established ${COMPTEUR} accept`,
      `ct state invalid ${COMPTEUR} drop`,
      `meta l4proto icmp icmp type echo-request ${COMPTEUR} accept`,
    ]),
    '',
    ...chaine('ufw-user-input', pf.regles.flatMap(lignesRegle)),
    '',
    ...chaine('ufw-after-input', []),
    ...(pf.entrant === 'reject' ? ['', ...chaine('ufw-reject-input', [`${COMPTEUR} reject`])] : []),
    '}',
  ];
}

function tableFail2ban(f2b: EtatFail2ban): string[] {
  const prisons = actives(f2b);
  const ensembles = prisons.flatMap((p) => {
    const bannis = bannisDe(f2b, p.nom);
    return [`\tset addr-set-${p.nom} {`, '\t\ttype ipv4_addr', ...(bannis.length ? [`\t\telements = { ${bannis.join(', ')} }`] : []), '\t}', ''];
  });
  // Une règle par prison : ses ports (ou tous, pour banaction_allports), puis les adresses de son ensemble.
  const regles = prisons.map(
    (p) =>
      `${p.ports.length ? `tcp dport { ${p.ports.join(', ')} } ` : 'meta l4proto { tcp } '}ip saddr @addr-set-${p.nom} reject with icmp port-unreachable`,
  );
  return [
    'table inet f2b-table {',
    ...ensembles,
    ...chaine('f2b-chain', ['type filter hook input priority filter - 1; policy accept;', ...regles]),
    '}',
  ];
}

/** Les tables que ufw et fail2ban ont écrites, par « famille nom ». */
export function tablesApercu(jeu: Jeu): Map<string, string[]> {
  const tables = new Map<string, string[]>();
  const pf = jeu.etat.ufw as PareFeu | undefined;
  if (pf?.actif) tables.set('ip filter', tableUfw(pf));
  const f2b = jeu.etat.fail2ban as EtatFail2ban | undefined;
  const service = systemd(jeu)?.services.fail2ban;
  if (f2b && actives(f2b).length && (!service || service.etat === 'active')) tables.set('inet f2b-table', tableFail2ban(f2b));
  return tables;
}

/** Une machine dont le pare-feu passe par ufw ou fail2ban, sans règles nftables écrites à la main. */
export const apercuSeulement = (jeu: Jeu) => !jeu.etat.lan && !jeu.etat.nft && (!!jeu.etat.ufw || !!jeu.etat.fail2ban);
