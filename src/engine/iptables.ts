// A machine's iptables (the classic Linux host firewall, the elder of
// nftables and the tool ufw drives underneath). state.iptables holds the
// filter table — the built-in chains INPUT, OUTPUT, FORWARD, their policy
// and their rules — read and written like iptables(8)
// (https://man7.org/linux/man-pages/man8/iptables.8.html). An incoming TCP
// connection is decided by walking the INPUT chain (see verdict), which
// ssh and the port scanners consult (ports.ts).
// Simplification: the filter table only (nat rules are parsed, stored and
// listed, but their packet rewriting is not simulated — a router's NAT is
// in nftables.ts); the common matches (-p, --dport, --sport, -s, -d, -i,
// -o, -m state/conntrack --state/--ctstate) and targets (ACCEPT, DROP,
// REJECT, LOG, RETURN, a jump to a user chain); counters stay at zero.

import { inNetwork, type Verdict } from './firewall';

export interface Rule {
  proto?: 'tcp' | 'udp' | 'icmp' | 'all';
  dport?: number;
  sport?: number;
  source?: string; // address or CIDR
  destination?: string;
  inFace?: string;
  outFace?: string;
  states?: string[]; // NEW, ESTABLISHED, RELATED (from -m state/conntrack)
  target: string; // ACCEPT, DROP, REJECT, LOG, RETURN, or a user chain
}

export interface Chain {
  // Built-in chains have a policy; user chains don't.
  policy?: 'ACCEPT' | 'DROP';
  rules: Rule[];
}

export interface Table {
  chains: Record<string, Chain>;
}

export interface Iptables {
  filter: Table;
  nat: Table;
}

const BUILTIN: Record<string, string[]> = { filter: ['INPUT', 'FORWARD', 'OUTPUT'], nat: ['PREROUTING', 'INPUT', 'OUTPUT', 'POSTROUTING'] };

/** A fresh iptables: the built-in chains, policy ACCEPT, no rule. */
export function newIptables(): Iptables {
  const table = (names: string[]): Table => ({ chains: Object.fromEntries(names.map((n) => [n, { policy: 'ACCEPT', rules: [] }])) });
  return { filter: table(BUILTIN.filter), nat: table(BUILTIN.nat) };
}

export const iptables = (state: Record<string, unknown>): Iptables | undefined => state.iptables as Iptables | undefined;

/** Does a rule match an incoming TCP/UDP connection to `port` from `source`? */
function matches(r: Rule, port: number, source: string, proto: 'tcp' | 'udp', isNew: boolean): boolean {
  if (r.proto && r.proto !== 'all' && r.proto !== proto) return false;
  if (r.dport !== undefined && r.dport !== port) return false;
  if (r.source && !inNetwork(source, r.source.includes('/') ? r.source : `${r.source}/32`)) return false;
  // -m state --state: an incoming new connection is NEW. A rule that only
  // accepts ESTABLISHED,RELATED must not match it (the classic stateful set-up).
  if (r.states && r.states.length && !r.states.includes(isNew ? 'NEW' : 'ESTABLISHED')) return false;
  return true;
}

/**
 * Walk the INPUT chain for a new incoming connection to `port` from `source`:
 * the first ACCEPT/DROP/REJECT decides, else the chain policy.
 * accepted | refused (REJECT) | blocked (DROP).
 */
export function verdict(ipt: Iptables, port: number, source: string, proto: 'tcp' | 'udp' = 'tcp'): Verdict {
  const seen = new Set<string>();
  const walk = (chainName: string): Verdict | null => {
    if (seen.has(chainName)) return null;
    seen.add(chainName);
    const chain = ipt.filter.chains[chainName];
    if (!chain) return null;
    for (const r of chain.rules) {
      if (!matches(r, port, source, proto, true)) continue;
      if (r.target === 'ACCEPT') return 'accepted';
      if (r.target === 'DROP') return 'blocked';
      if (r.target === 'REJECT') return 'refused';
      if (r.target === 'LOG') continue; // LOG doesn't decide, carry on
      if (r.target === 'RETURN') return null; // back to the calling chain's policy
      const sub = walk(r.target); // jump to a user chain
      if (sub) return sub;
    }
    return null;
  };
  const fromChain = walk('INPUT');
  if (fromChain) return fromChain;
  return ipt.filter.chains.INPUT?.policy === 'DROP' ? 'blocked' : 'accepted';
}

// ——— rendering ———

/** One rule as `iptables -S` prints it ("-A INPUT -p tcp --dport 22 -j ACCEPT"). */
export function ruleSpec(chain: string, r: Rule): string {
  const p: string[] = [`-A ${chain}`];
  if (r.source) p.push(`-s ${r.source.includes('/') ? r.source : `${r.source}/32`}`);
  if (r.destination) p.push(`-d ${r.destination}`);
  if (r.inFace) p.push(`-i ${r.inFace}`);
  if (r.outFace) p.push(`-o ${r.outFace}`);
  if (r.proto) p.push(`-p ${r.proto}`);
  if (r.states && r.states.length) p.push(`-m state --state ${r.states.join(',')}`);
  if (r.dport !== undefined) p.push(`--dport ${r.dport}`);
  if (r.sport !== undefined) p.push(`--sport ${r.sport}`);
  p.push(`-j ${r.target}`);
  return p.join(' ');
}

/** The `-L` line for a rule (target, prot, opt, source, destination, extra). */
export function ruleLine(r: Rule, verboseCounters: boolean): string {
  const prot = r.proto ?? 'all';
  const extra: string[] = [];
  if (r.states && r.states.length) extra.push(`state ${r.states.join(',')}`);
  if (r.dport !== undefined) extra.push(`${prot} dpt:${r.dport}`);
  if (r.sport !== undefined) extra.push(`${prot} spt:${r.sport}`);
  if (r.inFace) extra.push(`in:${r.inFace}`);
  if (r.outFace) extra.push(`out:${r.outFace}`);
  const cols = [r.target.padEnd(9), prot.padEnd(4), '--', (r.source ?? 'anywhere').padEnd(18), (r.destination ?? 'anywhere').padEnd(18), extra.join(' ')];
  return (verboseCounters ? '    0     0 ' : '') + cols.join(' ').trimEnd();
}
