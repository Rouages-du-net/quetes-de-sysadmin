// iptables, iptables-save and iptables-restore (the classic Linux host
// firewall), on the model of ../iptables.ts. After iptables(8).
// Differences: the filter table decides incoming TCP (ssh, the port
// scanners); nat rules are stored and listed but not applied; counters
// stay at zero; one -m match per rule; no ip6tables.

import type { Shell } from '../shell';
import type { Command } from './index';
import { iptables, newIptables, ruleLine, ruleSpec, type Chain, type Iptables, type Rule, type Table } from '../iptables';

const ipt = (game: Shell): Iptables => (game.state.iptables ??= newIptables()) as Iptables;
const NEEDS_ROOT = "iptables v1.8.9 (nf_tables): Permission denied (you must be root).\nPerhaps iptables or your kernel needs to be upgraded.";

/** Reads a rule's matches and its -j target from the words after the chain. */
function parseRule(words: string[]): Rule | string {
  const r: Rule = { target: '' };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const v = words[i + 1];
    if (w === '-p' || w === '--protocol') (r.proto = v as Rule['proto']), i++;
    else if (w === '--dport' || w === '--destination-port') (r.dport = Number(v)), i++;
    else if (w === '--sport' || w === '--source-port') (r.sport = Number(v)), i++;
    else if (w === '-s' || w === '--source') (r.source = v), i++;
    else if (w === '-d' || w === '--destination') (r.destination = v), i++;
    else if (w === '-i' || w === '--in-interface') (r.inFace = v), i++;
    else if (w === '-o' || w === '--out-interface') (r.outFace = v), i++;
    else if (w === '-m') i++; // the match extension name (state, conntrack, tcp…)
    else if (w === '--state' || w === '--ctstate') (r.states = (v ?? '').split(',').filter(Boolean)), i++;
    else if (w === '-j' || w === '--jump') (r.target = v ?? ''), i++;
    else return `iptables v1.8.9 (nf_tables): unknown option "${w}"`;
  }
  if (!r.target) return 'iptables: a rule needs a target (-j ACCEPT|DROP|REJECT|LOG|…).';
  return r;
}

function list(game: Shell, table: Table, only: string | undefined, o: { numbers: boolean; verbose: boolean }): string {
  const names = only ? [only] : Object.keys(table.chains);
  const out: string[] = [];
  for (const name of names) {
    const chain: Chain | undefined = table.chains[name];
    if (!chain) return game.error(`iptables: No chain/target/match by that name.`, 1);
    out.push(`Chain ${name} ${chain.policy ? `(policy ${chain.policy})` : '(0 references)'}`);
    const header = (o.verbose ? ' pkts bytes ' : '') + 'target     prot opt source               destination';
    out.push(o.numbers ? `num  ${header}` : header);
    chain.rules.forEach((r, i) => out.push((o.numbers ? `${String(i + 1).padEnd(4)} ` : '') + ruleLine(r, o.verbose)));
    out.push('');
  }
  return out.join('\n').trimEnd();
}

function run(game: Shell, args: string[]): string {
  let table: 'filter' | 'nat' = 'filter';
  const rest: string[] = [];
  const flags = { numbers: false, verbose: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-t' || a === '--table') {
      const t = args[++i];
      if (t !== 'filter' && t !== 'nat') return game.error(`iptables v1.8.9 (nf_tables): can't initialize iptables table \`${t}': Table does not exist (do you need to insmod?)`, 3);
      table = t;
    } else if (a === '--line-numbers') flags.numbers = true;
    else if (a === '-n' || a === '--numeric') void 0;
    else if (a === '-v' || a === '--verbose') flags.verbose = true;
    else rest.push(a);
  }
  const t = ipt(game)[table];

  // -L / -S read; everything else writes. All of it needs root.
  const action = rest[0];
  const readOnly = action === '-L' || action === '--list' || action === '-S' || action === '--list-rules';
  if (game.who !== 'root') return game.error(NEEDS_ROOT, 4);

  if (action === '-L' || action === '--list') return list(game, t, rest[1], flags);
  if (action === '-S' || action === '--list-rules') {
    const names = rest[1] ? [rest[1]] : Object.keys(t.chains);
    return names.flatMap((n) => [t.chains[n]?.policy ? `-P ${n} ${t.chains[n].policy}` : `-N ${n}`, ...(t.chains[n]?.rules ?? []).map((r) => ruleSpec(n, r))]).join('\n');
  }

  const chain = rest[1];
  const chainObj = chain ? t.chains[chain] : undefined;
  const needChain = (): Chain | string => (chainObj ? chainObj : `iptables: No chain/target/match by that name.`);

  if (action === '-P' || action === '--policy') {
    const c = needChain();
    if (typeof c === 'string') return game.error(c, 1);
    const pol = rest[2];
    if (pol !== 'ACCEPT' && pol !== 'DROP') return game.error(`iptables: Bad policy name. Run \`iptables -h' for more information.`, 2);
    c.policy = pol;
    return '';
  }
  if (action === '-F' || action === '--flush') {
    if (chainObj) chainObj.rules = [];
    else for (const c of Object.values(t.chains)) c.rules = [];
    return '';
  }
  if (action === '-N' || action === '--new-chain') {
    if (!chain) return game.error('iptables: a chain name is required.', 2);
    if (t.chains[chain]) return game.error(`iptables: Chain already exists.`, 1);
    t.chains[chain] = { rules: [] };
    return '';
  }
  if (action === '-X' || action === '--delete-chain') {
    if (chain) delete t.chains[chain];
    return '';
  }
  if (action === '-A' || action === '--append' || action === '-I' || action === '--insert' || action === '-R' || action === '--replace' || action === '-D' || action === '--delete') {
    const c = needChain();
    if (typeof c === 'string') return game.error(c, 1);
    // -I/-R/-D may take a rule number right after the chain.
    const insert = action === '-I' || action === '--insert';
    const replace = action === '-R' || action === '--replace';
    const del = action === '-D' || action === '--delete';
    let pos: number | null = null;
    let words = rest.slice(2);
    if ((insert || replace || del) && /^\d+$/.test(words[0] ?? '')) {
      pos = Number(words[0]);
      words = words.slice(1);
    }
    if (del && pos !== null) {
      if (pos < 1 || pos > c.rules.length) return game.error(`iptables: Index of deletion too big.`, 2);
      c.rules.splice(pos - 1, 1);
      return '';
    }
    const r = parseRule(words);
    if (typeof r === 'string') return game.error(r, 2);
    if (del) {
      const i = c.rules.findIndex((x) => ruleSpec(chain!, x) === ruleSpec(chain!, r));
      if (i < 0) return game.error(`iptables: Bad rule (does a matching rule exist in that chain?).`, 1);
      c.rules.splice(i, 1);
    } else if (replace) c.rules[(pos ?? 1) - 1] = r;
    else if (insert) c.rules.splice((pos ?? 1) - 1, 0, r);
    else c.rules.push(r);
    return '';
  }
  if (readOnly) return '';
  return game.error(`iptables v1.8.9 (nf_tables): no command specified\nTry \`iptables -h' or 'iptables --help' for more information.`, 2);
}

function save(game: Shell): string {
  if (game.who !== 'root') return game.error(NEEDS_ROOT, 4);
  const i = ipt(game);
  const out: string[] = [];
  for (const [name, table] of [['filter', i.filter], ['nat', i.nat]] as const) {
    out.push(`*${name}`);
    for (const [c, chain] of Object.entries(table.chains)) out.push(`:${c} ${chain.policy ?? '-'} [0:0]`);
    for (const [c, chain] of Object.entries(table.chains)) for (const r of chain.rules) out.push(ruleSpec(c, r));
    out.push('COMMIT');
  }
  return out.join('\n');
}

export const IPTABLES: Record<string, Command> = {
  iptables: { section: 8, ownOptions: true, launch: ({ args, game }) => run(game, args) },
  'iptables-save': { section: 8, ownOptions: true, launch: ({ game }) => save(game) },
};
