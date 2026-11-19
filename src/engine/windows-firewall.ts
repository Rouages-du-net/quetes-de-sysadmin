// Windows Defender Firewall on a Windows Server (state.windows.firewall):
//   - three profiles (Domain, Private, Public), each on or off, with its
//     default actions (NotConfigured: inbound blocked, outbound allowed);
//     the network adapter is in one of them (Domain on a machine of a
//     domain, Private or Public otherwise: Get-NetConnectionProfile);
//   - rules: name, display name, group, enabled, direction, action,
//     profiles, protocol, local and remote ports, remote addresses (Any,
//     LocalSubnet, an address, a range, a CIDR), from the local store or a
//     Group Policy object (PolicyStoreSource GroupPolicy);
//   - the decision for a connection: a matching block rule wins over a
//     matching allow rule; without a match, the profile's default action
//     (inbound blocked, outbound allowed); a profile turned off lets
//     everything through. ssh, smbclient, mount.cifs, Test-NetConnection and
//     ping reaching a Windows machine of the story go through it.
// The default rule set is Windows Server 2022's for what the game models:
// OpenSSH SSH Server (sshd), File and Printer Sharing (SMB-In, Echo
// Request: off), Remote Desktop (off), Windows Remote Management, and on a
// domain controller the rules of Active Directory Domain Services,
// Kerberos and DNS.
// Sources (Microsoft Learn): "Windows Firewall rules"
// (https://learn.microsoft.com/windows/security/operating-system-security/network-security/windows-firewall/rules:
// "block rules take precedence over allow rules"), "Configure Windows
// Firewall" and the default inbound behaviour
// (https://learn.microsoft.com/windows/security/operating-system-security/network-security/windows-firewall/configure),
// NetSecurity module (https://learn.microsoft.com/powershell/module/netsecurity/),
// "OpenSSH for Windows: get started" (the rule OpenSSH-Server-In-TCP,
// https://learn.microsoft.com/windows-server/administration/openssh/openssh_install_firstuse),
// "Service overview and network port requirements for Windows"
// (https://learn.microsoft.com/troubleshoot/windows-server/networking/service-overview-and-network-port-requirements).
// Simplifications (docs/SCENARIOS.md): no IPsec, no program or service
// conditions in the decision, no edge traversal, no logging to pfirewall.log,
// one adapter.

import type { Game, Shell } from './shell';
import { isWindows, windows } from './windows';
import { MACHINES, WORKSTATION } from './machines';

export type FwProfileName = 'Domain' | 'Private' | 'Public';
export const PROFILES: FwProfileName[] = ['Domain', 'Private', 'Public'];

export interface FwRule {
  // The rule's name (its id: OpenSSH-Server-In-TCP, or a GUID for one made without -Name).
  name: string;
  display: string;
  group?: string;
  description?: string;
  enabled: boolean;
  direction: 'Inbound' | 'Outbound';
  action: 'Allow' | 'Block';
  // The profiles it applies to (all three: Any).
  profiles: FwProfileName[];
  protocol: string;
  localPort: string[];
  remotePort: string[];
  remoteAddress: string[];
  localAddress?: string[];
  icmpType?: string;
  program?: string;
  // Where it comes from: the local store, or a Group Policy object (its name).
  gpo?: string;
}

export interface FwProfile {
  enabled: boolean;
  defaultInbound: 'NotConfigured' | 'Block' | 'Allow';
  defaultOutbound: 'NotConfigured' | 'Block' | 'Allow';
  logBlocked: boolean;
  logAllowed: boolean;
}

export interface Firewall {
  profiles: Record<FwProfileName, FwProfile>;
  rules: FwRule[];
  // The network adapter's category (Get-NetConnectionProfile).
  category: FwProfileName;
}

const ANY = ['Any'];
const rule = (name: string, display: string, group: string, protocol: string, localPort: string[], o: Partial<FwRule> = {}): FwRule => ({
  name,
  display,
  group,
  description: o.description ?? `Inbound rule for ${display.replace(/ \((TCP|UDP)-In\)$/, '')}.`,
  enabled: true,
  direction: 'Inbound',
  action: 'Allow',
  profiles: [...PROFILES],
  protocol,
  localPort,
  remotePort: ANY,
  remoteAddress: ANY,
  ...o,
});

/** The rules of a fresh Windows Server 2022 (a subset), and a domain controller's. */
export function defaultRules(dc = false): FwRule[] {
  const out: FwRule[] = [
    rule('OpenSSH-Server-In-TCP', 'OpenSSH SSH Server (sshd)', 'OpenSSH Server', 'TCP', ['22'], { description: 'Inbound rule for OpenSSH SSH Server (sshd)' }),
    rule('FPS-SMB-In-TCP', 'File and Printer Sharing (SMB-In)', 'File and Printer Sharing', 'TCP', ['445'], { description: 'Inbound rule for File and Printer Sharing to allow Server Message Block transmission and reception via Named Pipes. [TCP 445]' }),
    rule('FPS-ICMP4-ERQ-In', 'File and Printer Sharing (Echo Request - ICMPv4-In)', 'File and Printer Sharing', 'ICMPv4', ANY, { enabled: false, icmpType: '8', description: 'Echo Request messages are sent as ping requests to other nodes.' }),
    rule('RemoteDesktop-UserMode-In-TCP', 'Remote Desktop - User Mode (TCP-In)', 'Remote Desktop', 'TCP', ['3389'], { enabled: false, description: 'Inbound rule for the Remote Desktop service to allow RDP traffic. [TCP 3389]' }),
    rule('RemoteDesktop-UserMode-In-UDP', 'Remote Desktop - User Mode (UDP-In)', 'Remote Desktop', 'UDP', ['3389'], { enabled: false, description: 'Inbound rule for the Remote Desktop service to allow RDP traffic. [UDP 3389]' }),
    rule('WINRM-HTTP-In-TCP', 'Windows Remote Management (HTTP-In)', 'Windows Remote Management', 'TCP', ['5985'], { profiles: ['Domain', 'Private'], description: 'Inbound rule for Windows Remote Management via WS-Management. [TCP 5985]' }),
    rule('WINRM-HTTP-In-TCP-PUBLIC', 'Windows Remote Management (HTTP-In)', 'Windows Remote Management', 'TCP', ['5985'], { profiles: ['Public'], remoteAddress: ['LocalSubnet'], description: 'Inbound rule for Windows Remote Management via WS-Management. [TCP 5985]' }),
  ];
  if (dc)
    out.push(
      rule('ADDS-LDAP-TCP-In', 'Active Directory Domain Controller - LDAP (TCP-In)', 'Active Directory Domain Services', 'TCP', ['389']),
      rule('ADDS-LDAPS-TCP-In', 'Active Directory Domain Controller - Secure LDAP (TCP-In)', 'Active Directory Domain Services', 'TCP', ['636']),
      rule('ADDS-LDAPGC-TCP-In', 'Active Directory Domain Controller - LDAP for Global Catalog (TCP-In)', 'Active Directory Domain Services', 'TCP', ['3268']),
      rule('ADDS-NP-TCP-In', 'Active Directory Domain Controller - SAM/LSA (NP-TCP-In)', 'Active Directory Domain Services', 'TCP', ['445']),
      rule('Kerberos-Key-Distribution-Center-TCP-In', 'Kerberos Key Distribution Center (TCP-In)', 'Kerberos Key Distribution Center', 'TCP', ['88']),
      rule('Kerberos-Key-Distribution-Center-UDP-In', 'Kerberos Key Distribution Center (UDP-In)', 'Kerberos Key Distribution Center', 'UDP', ['88']),
      rule('DNSSrv-TCP-In', 'DNS (TCP, Incoming)', 'DNS Service', 'TCP', ['53']),
      rule('DNSSrv-UDP-In', 'DNS (UDP, Incoming)', 'DNS Service', 'UDP', ['53']),
    );
  return out;
}

const PROFILE = (): FwProfile => ({ enabled: true, defaultInbound: 'NotConfigured', defaultOutbound: 'NotConfigured', logBlocked: false, logAllowed: false });

/** A new firewall: every profile on, the default rules. */
export function newFirewall(o: { dc?: boolean; category?: FwProfileName; rules?: FwRule[] } = {}): Firewall {
  return {
    profiles: { Domain: PROFILE(), Private: PROFILE(), Public: PROFILE() },
    rules: [...defaultRules(o.dc), ...(o.rules ?? []).map((r) => ({ ...r }))],
    category: o.category ?? 'Private',
  };
}

/** The machine's firewall (created with the defaults the first time: a story's machine built by hand has one too). */
export function firewall(game: Game): Firewall {
  const w = windows(game);
  const domain = w.domain as { netbios?: string } | undefined;
  return (w.firewall ??= newFirewall({ dc: !!game.state.ad, category: domain || game.state.ad ? 'Domain' : 'Private' })) as Firewall;
}

// ——— Matching ———

const toInt = (a: string) => a.split('.').reduce((n, o) => n * 256 + Number(o), 0);
const isIp = (a: string) => /^\d+\.\d+\.\d+\.\d+$/.test(a);

/** Does an address match one of a rule's remote addresses (Any, LocalSubnet, an address, a range, a CIDR, a mask)? */
export function addressMatches(game: Game, list: string[], address: string): boolean {
  if (!list.length || list.some((x) => x.toLowerCase() === 'any' || x === '*')) return true;
  if (!isIp(address)) return false;
  const a = toInt(address);
  const own = windows(game).network;
  return list.some((entry) => {
    const e = entry.trim();
    if (/^localsubnet$/i.test(e)) {
      if (!own) return false;
      const mask = toInt(own.mask);
      return (toInt(own.address) & mask) >>> 0 === (a & mask) >>> 0;
    }
    if (/^(defaultgateway)$/i.test(e)) return own?.gateway === address;
    if (/^(dns)$/i.test(e)) return own?.dns === address;
    const range = /^(\d+\.\d+\.\d+\.\d+)-(\d+\.\d+\.\d+\.\d+)$/.exec(e);
    if (range) return a >= toInt(range[1]) && a <= toInt(range[2]);
    const cidr = /^(\d+\.\d+\.\d+\.\d+)\/(\d+(?:\.\d+\.\d+\.\d+)?)$/.exec(e);
    if (cidr) {
      const mask = cidr[2].includes('.') ? toInt(cidr[2]) : Number(cidr[2]) === 0 ? 0 : (0xffffffff << (32 - Number(cidr[2]))) >>> 0;
      return (toInt(cidr[1]) & mask) >>> 0 === (a & mask) >>> 0;
    }
    return e === address;
  });
}

/** Does a port match a rule's ports (Any, 445, 49152-65535, a list)? */
export function portMatches(list: string[], port: number | null): boolean {
  if (!list.length || list.some((x) => /^any$/i.test(x))) return true;
  if (port === null) return false;
  return list.some((x) => {
    const r = /^(\d+)-(\d+)$/.exec(x);
    return r ? port >= Number(r[1]) && port <= Number(r[2]) : Number(x) === port;
  });
}

export interface Connection {
  protocol: 'TCP' | 'UDP' | 'ICMPv4';
  // The local port (inbound) or remote port (outbound); null for ICMP.
  port: number | null;
  // The other side's address.
  remote: string;
  direction?: 'Inbound' | 'Outbound';
}

/** The rules that match a connection under the active profile. */
export function matchingRules(game: Game, c: Connection): FwRule[] {
  const fw = firewall(game);
  const dir = c.direction ?? 'Inbound';
  return fw.rules.filter(
    (r) =>
      r.enabled &&
      r.direction === dir &&
      r.profiles.includes(fw.category) &&
      (/^any$/i.test(r.protocol) || r.protocol.toLowerCase() === c.protocol.toLowerCase()) &&
      (c.protocol === 'ICMPv4' ? !r.icmpType || r.icmpType === '8' || /^any$/i.test(r.icmpType) : portMatches(dir === 'Inbound' ? r.localPort : r.remotePort, c.port)) &&
      addressMatches(game, r.remoteAddress, c.remote),
  );
}

/**
 * Does the firewall let this connection through? Off: yes. A matching block
 * rule: no (it wins over allow rules). A matching allow rule: yes. Neither:
 * the profile's default (inbound blocked, outbound allowed).
 */
export function firewallAllows(game: Game, c: Connection): boolean {
  if (!isWindows(game)) return true;
  const fw = firewall(game);
  const p = fw.profiles[fw.category];
  if (!p.enabled) return true;
  const rules = matchingRules(game, c);
  if (rules.some((r) => r.action === 'Block')) return false;
  if (rules.some((r) => r.action === 'Allow')) return true;
  const dir = c.direction ?? 'Inbound';
  const def = dir === 'Inbound' ? p.defaultInbound : p.defaultOutbound;
  return def === 'NotConfigured' ? dir === 'Outbound' : def === 'Allow';
}

// ——— The machines of the story's network ———

/** A machine's address: the workstation's, an internal host's, a story machine's, or its Windows network. */
export function shellAddress(sh: Shell): string | null {
  if (sh.host === WORKSTATION.name) return WORKSTATION.address;
  const internal = sh.parent ? sh.principal.chapter.hosts?.[sh.host]?.address : undefined;
  if (internal) return internal;
  const m = MACHINES.find((x) => x.name === sh.host);
  if (m) return m.address;
  if (isWindows(sh)) return windows(sh).network?.address ?? null;
  // A Linux machine of a test or a story: its own name in its /etc/hosts.
  for (const line of (sh.read('/etc/hosts') ?? '').split('\n')) {
    const [address, ...names] = line.replace(/#.*/, '').trim().split(/\s+/);
    if (names.includes(sh.host) && !address.startsWith('127.')) return address;
  }
  return null;
}

/** The story's machines (its main one and its internal hosts): name, address, and the domain names. */
export function storyMachines(game: Shell): { name: string; address: string; names: string[] }[] {
  const p = game.principal;
  const out: { name: string; address: string; names: string[] }[] = [];
  const main = shellAddress(p);
  if (main) out.push({ name: p.host, address: main, names: [p.host, ...(isWindows(p) ? [windows(p).computer] : [])] });
  for (const [name, h] of Object.entries(p.chapter.hosts ?? {})) out.push({ name, address: h.address, names: [name, h.domain] });
  return out;
}

/** The story's machine at an address (its session), or null. */
export function machineAt(game: Shell, address: string): Shell | null {
  const p = game.principal;
  if (shellAddress(p) === address) return p;
  const h = Object.entries(p.chapter.hosts ?? {}).find(([, x]) => x.address === address);
  return h ? p.internal(h[0]) : null;
}

/** A name of the story's network (dc01, dc01.school.internal, the computer's NetBIOS name) → its address. */
export function storyAddress(game: Shell, name: string): string | null {
  const low = name.toLowerCase();
  for (const m of storyMachines(game)) if (m.names.some((n) => n.toLowerCase() === low || n.toLowerCase().split('.')[0] === low)) return m.address;
  // A Windows machine's own NetBIOS name (FILES), as its computer name.
  for (const [hn] of Object.entries(game.principal.chapter.hosts ?? {})) {
    const sh = game.principal.internal(hn);
    if (sh && isWindows(sh) && windows(sh).computer.toLowerCase() === low) return shellAddress(sh);
  }
  return null;
}

/** May a client reach a Windows machine on this port (TCP) or by ping (port null)? */
export function reaches(client: Shell, server: Shell, port: number | null, protocol: 'TCP' | 'UDP' = 'TCP'): boolean {
  if (!isWindows(server)) return true;
  const from = shellAddress(client) ?? '0.0.0.0';
  return firewallAllows(server, port === null ? { protocol: 'ICMPv4', port: null, remote: from } : { protocol, port, remote: from });
}
