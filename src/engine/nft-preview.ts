// What nft shows on a machine managed by ufw and fail2ban: ufw writes
// its rules with iptables, which on Debian goes through nftables (iptables-nft,
// table ip filter and ufw-* chains); fail2ban, with Debian's nftables
// action, adds its table inet f2b-table (one set of banned addresses
// per jail, and a rule that rejects them on the jail's ports).
// Sources: https://manpages.ubuntu.com/manpages/noble/man8/ufw-framework.8.html,
// https://wiki.nftables.org/wiki-nftables/index.php/Legacy_xtables_tools,
// /etc/fail2ban/action.d/nftables.conf (Debian 12's fail2ban package).
// Differences: a read-only preview (nft list ruleset, list tables,
// list table); neither the ip6 filter table, nor ufw's logging and
// routing chains; counters stay at zero; several ports of a
// profile (Nginx Full) in a single set { 80, 443 }.

import type { Game } from './shell';
import type { Firewall, Rule } from './firewall';
import { actives, bannedFor, type Fail2banState } from './fail2ban';
import { systemd } from './systemd';

const COUNTER = 'counter packets 0 bytes 0';

// The protocols of a ufw rule: "22/tcp", a profile (tcp), or a bare port (tcp and udp).
function protocols(r: Rule): string[] {
  const m = /\/(tcp|udp)$/.exec(r.to);
  if (m) return [m[1]];
  return /^\d+$/.test(r.to) ? ['tcp', 'udp'] : ['tcp'];
}

function ruleLines(r: Rule): string[] {
  const source = r.forEachOf ? `ip saddr ${r.forEachOf} ` : '';
  const verdict = { allow: 'accept', limit: 'accept', deny: 'drop', reject: 'reject' }[r.action];
  if (!r.ports.length) return [`${source}${COUNTER} ${verdict}`];
  return protocols(r).flatMap((p) => {
    const ports = r.ports.length > 1 ? `{ ${r.ports.join(', ')} }` : String(r.ports[0]);
    const filter = `${source}meta l4proto ${p} ${p} dport ${ports}`;
    // limit: ufw uses iptables' recent module, which nft only shows as "xt match".
    if (r.action === 'limit')
      return [
        `${filter} ct state new xt match "recent" ${COUNTER}`,
        `${filter} ct state new xt match "recent" ${COUNTER} jump ufw-user-limit`,
        `${filter} ${COUNTER} jump ufw-user-limit-accept`,
      ];
    return [`${filter} ${COUNTER} ${verdict}`];
  });
}

const string = (name: string, lines: string[]) => [`\tchain ${name} {`, ...lines.map((l) => `\t\t${l}`), '\t}'];

function tableUfw(pf: Firewall): string[] {
  const policy = pf.incoming === 'allow' ? 'accept' : 'drop';
  return [
    'table ip filter {',
    ...string('INPUT', [
      `type filter hook input priority filter; policy ${policy};`,
      `${COUNTER} jump ufw-before-input`,
      `${COUNTER} jump ufw-user-input`,
      `${COUNTER} jump ufw-after-input`,
      ...(pf.incoming === 'reject' ? [`${COUNTER} jump ufw-reject-input`] : []),
    ]),
    '',
    ...string('OUTPUT', [`type filter hook output priority filter; policy ${pf.outgoing === 'allow' ? 'accept' : 'drop'};`]),
    '',
    ...string('ufw-before-input', [
      `iifname "lo" ${COUNTER} accept`,
      `ct state related,established ${COUNTER} accept`,
      `ct state invalid ${COUNTER} drop`,
      `meta l4proto icmp icmp type echo-request ${COUNTER} accept`,
    ]),
    '',
    ...string('ufw-user-input', pf.rules.flatMap(ruleLines)),
    '',
    ...string('ufw-after-input', []),
    ...(pf.incoming === 'reject' ? ['', ...string('ufw-reject-input', [`${COUNTER} reject`])] : []),
    '}',
  ];
}

function tableFail2ban(f2b: Fail2banState): string[] {
  const jails = actives(f2b);
  const ensembles = jails.flatMap((p) => {
    const banned = bannedFor(f2b, p.name);
    return [`\tset addr-set-${p.name} {`, '\t\ttype ipv4_addr', ...(banned.length ? [`\t\telements = { ${banned.join(', ')} }`] : []), '\t}', ''];
  });
  // One rule per jail: its ports (or all of them, for banaction_allports), then the addresses of its set.
  const rules = jails.map(
    (p) =>
      `${p.ports.length ? `tcp dport { ${p.ports.join(', ')} } ` : 'meta l4proto { tcp } '}ip saddr @addr-set-${p.name} reject with icmp port-unreachable`,
  );
  return [
    'table inet f2b-table {',
    ...ensembles,
    ...string('f2b-chain', ['type filter hook input priority filter - 1; policy accept;', ...rules]),
    '}',
  ];
}

/** The tables ufw and fail2ban wrote, by "family name". */
export function previewTables(game: Game): Map<string, string[]> {
  const tables = new Map<string, string[]>();
  const pf = game.state.ufw as Firewall | undefined;
  if (pf?.enabled) tables.set('ip filter', tableUfw(pf));
  const f2b = game.state.fail2ban as Fail2banState | undefined;
  const service = systemd(game)?.services.fail2ban;
  if (f2b && actives(f2b).length && (!service || service.state === 'active')) tables.set('inet f2b-table', tableFail2ban(f2b));
  return tables;
}

/** A machine whose firewall goes through ufw or fail2ban, with no hand-written nftables rules. */
export const onlyPreview = (game: Game) => !game.state.lan && !game.state.nft && (!!game.state.ufw || !!game.state.fail2ban);
