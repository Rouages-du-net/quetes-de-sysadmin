// A machine's firewall, as ufw manages it (https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html):
// a default policy (incoming, outgoing) and an ordered list of
// rules; the FIRST matching rule decides, otherwise the default
// policy. Inactive firewall: everything goes through. Already established connections
// (like the current ssh session) are never cut.
// Differences: IPv4 and IPv6 merged (the "(v6)" lines are shown for
// form's sake), no routing, logging or outgoing rules.

export type Action = 'allow' | 'deny' | 'reject' | 'limit';
export type Policy = 'allow' | 'deny' | 'reject';

export interface Rule {
  action: Action;
  // What ufw shows in the "To" column (22/tcp, 80, OpenSSH…).
  to: string;
  ports: number[];
  // Source address, or null for "anywhere".
  forEachOf: string | null;
}

export interface Firewall {
  enabled: boolean;
  incoming: Policy;
  outgoing: Policy;
  rules: Rule[];
  // Number of ssh connections at activation time (to check
  // that a new connection still gets through).
  activationAlConnections?: number;
}

export const newFirewall = (): Firewall => ({ enabled: false, incoming: 'deny', outgoing: 'allow', rules: [] });

// Services from /etc/services and application profiles from /etc/ufw/applications.d.
export const SERVICES: Record<string, { ports: number[]; proto?: string }> = {
  ssh: { ports: [22], proto: 'tcp' },
  http: { ports: [80], proto: 'tcp' },
  https: { ports: [443], proto: 'tcp' },
  mysql: { ports: [3306], proto: 'tcp' },
  syslog: { ports: [514], proto: 'udp' },
};
export const APPLICATIONS: Record<string, number[]> = {
  'Nginx Full': [80, 443],
  'Nginx HTTP': [80],
  'Nginx HTTPS': [443],
  OpenSSH: [22],
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
  const r = pf.rules.find((r) => (r.ports.includes(port) || r.ports.length === 0) && (r.forEachOf === null || inNetwork(source, r.forEachOf)));
  const action = r?.action ?? pf.incoming;
  return action === 'allow' || action === 'limit' ? 'accepted' : action === 'reject' ? 'refused' : 'blocked';
}
