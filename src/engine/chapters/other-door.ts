// Story "The Ferry", chapter "The Other Door": islenet's monthly scan of
// its members' servers, now in IPv6 too, finds PostgreSQL (5432) and the
// booking app's admin pages (8080) open on quay. In IPv4 they are closed:
// Tevita's firewall is a "table ip filter", which IPv6 packets never
// cross; PostgreSQL listens on 0.0.0.0 and [::], the admin pages on *
// (both families). You compare the two views from lookout (nmap -6, nc -6),
// read the sockets (ss -tlnp) and the ruleset, and write one policy for
// both families: a "table inet", which needs ICMPv6 (neighbour discovery:
// without it, IPv6 dies on the link, RFC 4890), in /etc/nftables.conf and
// loaded.
// Objective checked on the state: with the ruleset loaded now and the one
// the file would load at boot, from the internet in IPv4 and IPv6: ssh, DNS
// and the site pass, PostgreSQL and the admin pages are not reachable;
// neighbour discovery passes; the harbour office still reads the database;
// the workstation still reaches ssh; IPv6 is not turned off.
// Sources: https://wiki.nftables.org/wiki-nftables/index.php/Nftables_families,
// https://wiki.nftables.org/wiki-nftables/index.php/Simple_ruleset_for_a_server,
// https://www.rfc-editor.org/rfc/rfc4890 (ICMPv6 filtering), https://nmap.org/book/man-ipv6.html

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { disabled6 } from '../ipv6';
import { systemd } from '../systemd';
import {
  M,
  NOW_2,
  PASSWORD,
  STATIC,
  ferryAccounts,
  ferryState,
  ferryWorld,
  initialiseFerry,
  lookoutHost,
  lookoutSaw,
  audit,
  auditOk,
  loadedRuleset,
  bootRuleset,
  v6Off,
  PUBLIC_PORTS,
  type Audit,
} from './ferry';

const now = (j: Game) => audit(j, loadedRuleset(j));
const boot = (j: Game) => audit(j, bootRuleset(j));
// Some IPv6 filtering is in place (a table ip6 or inet).
const filters6 = (j: Game) => loadedRuleset(j).tables.some((t) => t.family === 'ip6' || t.family === 'inet');
const stricter6 = (a: Audit) => a.nd && PUBLIC_PORTS.some((p) => a.passes[4][p] && !a.passes[6][p]);
const enabled = (j: Game) => systemd(j)?.services.nftables?.state === 'active';

export const otherDoor: Chapter = {
  id: 'other-door',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'cp', 'sudo', 'ip', 'ss', 'nft', 'sysctl', 'systemctl', 'journalctl', 'ping', 'ping6', 'nc', 'curl', 'ssh', 'exit'],
  home: M,
  welcome: 'message_from_amaru.txt',
  names: true,
  final: 'end',
  steps: ['scan6', 'scan4', 'sockets', 'ruleset', 'closed-now', 'closed-boot', 'end'],
  password: PASSWORD,
  accounts: ferryAccounts,
  state: (t) => ferryState(t, 2),
  initialise: initialiseFerry,
  hosts: { lookout: lookoutHost(NOW_2, (t) => t('ferry-lookout-readme')) },
  createWorld: (t) =>
    ferryWorld(t, 2, {
      'message_from_amaru.txt': f(t('other-door-message-amaru')),
      'scan_report.txt': f(t('other-door-scan-report', { address: STATIC }), { lines: true }),
    }),
  events: [
    { id: 'scan6', condition: (j) => /5432\/tcp +open/.test(lookoutSaw(j)) || /Connection to \S+ \(?2001:db8[^)]*\)? 5432 port/.test(lookoutSaw(j)), message: (j) => j.t('other-door-event-scan6') },
    {
      id: 'scan4',
      condition: (j) =>
        (/Nmap scan report for \S+ \(192\.0\.2\.52\)|Nmap scan report for 192\.0\.2\.52/.test(lookoutSaw(j)) && !/5432\/tcp +open/.test(lookoutSaw(j))) ||
        /192\.0\.2\.52\)? port 5432 \(tcp\) timed out/.test(lookoutSaw(j)),
      message: (j) => j.t('other-door-event-scan4'),
    },
    { id: 'sockets', condition: (j) => /\[::\]:(5432|postgresql)\b/.test(j.last.output) && /\*:(8080|http-alt)\b/.test(j.last.output), message: (j) => j.t('other-door-event-sockets') },
    { id: 'ruleset', condition: (j) => /table ip filter/.test(j.last.output), message: (j) => j.t('other-door-event-ruleset') },
    {
      id: 'disabled',
      condition: (j) => disabled6(j, 'eth0') || v6Off(j),
      message: (j) => j.t('other-door-event-disabled'),
    },
    { id: 'nd-dropped', condition: (j) => filters6(j) && !now(j).nd && !disabled6(j, 'eth0'), message: (j) => j.t('other-door-event-nd-dropped') },
    { id: 'v6-stricter', condition: (j) => stricter6(now(j)), message: (j) => j.t('other-door-event-v6-stricter') },
    { id: 'office-cut', condition: (j) => !now(j).office, message: (j) => j.t('other-door-event-office-cut') },
    { id: 'ssh-cut', condition: (j) => !now(j).workstation, message: (j) => j.t('other-door-event-ssh-cut') },
    { id: 'closed-now', condition: (j) => auditOk(now(j)) && !disabled6(j, 'eth0'), message: (j) => j.t('other-door-event-closed-now') },
    { id: 'not-saved', condition: (j) => auditOk(now(j)) && !auditOk(boot(j)) && (j.state.ferryChecked ?? 0) >= 2, message: (j) => j.t('other-door-event-not-saved') },
    { id: 'closed-boot', condition: (j) => auditOk(boot(j)) && enabled(j), message: (j) => j.t('other-door-event-closed-boot') },
    {
      id: 'end',
      condition: (j) => auditOk(now(j)) && auditOk(boot(j)) && enabled(j) && !v6Off(j),
      message: (j) => j.t('other-door-event-end'),
    },
  ],
  afterCommand: (j) => {
    // The fix is in place now: from the next command on, a file that doesn't follow is pointed out.
    if (auditOk(now(j))) j.state.ferryChecked = (j.state.ferryChecked ?? 0) + 1;
  },
};
