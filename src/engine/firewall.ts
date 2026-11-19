// A machine's firewall, as ufw manages it (https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html):
// a default policy (incoming, outgoing) and an ordered list of
// rules; the FIRST matching rule decides, otherwise the default
// policy. Inactive firewall: everything goes through. Already established connections
// (like the current ssh session) are never cut.
// IPv6: /etc/default/ufw's IPV6 setting (read when ufw starts or reloads,
// and when a rule is added) decides whether ufw also writes ip6tables
// rules; with IPV6=no it leaves IPv6 alone, so everything goes through in
// IPv6. A rule added while IPV6=no exists for IPv4 only (no "(v6)" twin),
// even once IPV6=yes: it must be added again.
// Source: https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html (IPV6, /etc/default/ufw).
// Differences: no routing, logging or outgoing rules.

import { inPrefix6 } from './ipv6';

export type Action = 'allow' | 'deny' | 'reject' | 'limit';
export type Policy = 'allow' | 'deny' | 'reject';

export interface Rule {
  action: Action;
  // What ufw shows in the "To" column (22/tcp, 80, OpenSSH…).
  to: string;
  ports: number[];
  // Source address, or null for "anywhere".
  forEachOf: string | null;
  // Written for IPv6 too (its "(v6)" twin); absent: yes.
  v6?: boolean;
}

export interface Firewall {
  enabled: boolean;
  incoming: Policy;
  outgoing: Policy;
  rules: Rule[];
  // Number of ssh connections at activation time (to check
  // that a new connection still gets through).
  activationAlConnections?: number;
  // IPV6=yes in /etc/default/ufw when ufw was last started; absent: yes.
  ipv6?: boolean;
}

export const newFirewall = (): Firewall => ({ enabled: false, incoming: 'deny', outgoing: 'allow', rules: [] });

// Services from /etc/services and application profiles from /etc/ufw/applications.d.
export const SERVICES: Record<string, { ports: number[]; proto?: string }> = {
  ssh: { ports: [22], proto: 'tcp' },
  http: { ports: [80], proto: 'tcp' },
  https: { ports: [443], proto: 'tcp' },
  mysql: { ports: [3306], proto: 'tcp' },
  syslog: { ports: [514], proto: 'udp' },
  nfs: { ports: [2049], proto: 'tcp' },
  sunrpc: { ports: [111] },
  'microsoft-ds': { ports: [445], proto: 'tcp' },
};
export const APPLICATIONS: Record<string, number[]> = {
  'Nginx Full': [80, 443],
  'Nginx HTTP': [80],
  'Nginx HTTPS': [443],
  OpenSSH: [22],
  Samba: [137, 138, 139, 445],
};

export type Verdict = 'accepted' | 'refused' | 'blocked';

/** Does a new connection to this port, from this address, get through? */
/** Is this address in this network ("198.51.100.0/24") or equal to it? */
export function inNetwork(address: string, network: string): boolean {
  const [base, bits] = network.split('/');
  if (bits === undefined) return address === base;
  const n = (ip: string) => ip.split('.').reduce((t, x) => t * 256 + Number(x), 0);
  const mask = Number(bits) === 0 ? 0 : 2 ** 32 - 2 ** (32 - Number(bits));
  const and = (x: number) => Math.floor(x / 2 ** (32 - Number(bits))) * 2 ** (32 - Number(bits));
  return mask === 0 || and(n(address)) === and(n(base));
}

export function verdict(pf: Firewall, port: number, source: string): Verdict {
  if (!pf.enabled) return 'accepted';
  const v6 = source.includes(':');
  // IPV6=no: ufw writes no IPv6 rule at all, and the kernel's IPv6 policy stays ACCEPT.
  if (v6 && pf.ipv6 === false) return 'accepted';
  const r = pf.rules.find(
    (r) =>
      (r.ports.includes(port) || r.ports.length === 0) &&
      (v6 ? r.v6 !== false && (r.forEachOf === null || (r.forEachOf.includes(':') && inPrefix6(source, r.forEachOf))) : r.forEachOf === null || (!r.forEachOf.includes(':') && inNetwork(source, r.forEachOf))),
  );
  const action = r?.action ?? pf.incoming;
  return action === 'allow' || action === 'limit' ? 'accepted' : action === 'reject' ? 'refused' : 'blocked';
}
