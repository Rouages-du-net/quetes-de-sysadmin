// nft (nftables), sysctl (procps-ng) and conntrack (conntrack-tools), on the
// simulated router (../nftables.ts, ../lan.ts). Outputs in English, like the
// real tools.
// Sources: https://www.netfilter.org/projects/nftables/manpage.html,
// https://man7.org/linux/man-pages/man8/sysctl.8.html,
// https://man7.org/linux/man-pages/man5/sysctl.d.5.html,
// https://manpages.debian.org/trixie/conntrack/conntrack.8.en.html

import type { Game, Shell } from '../shell';
import type { Node } from '../world';
import { show, withCounters, NftError, runNft, formatError, logTraffic, nft, results } from '../nftables';
import { lan } from '../lan';
import { onlyPreview, previewTables } from '../nft-preview';
import { WORKSTATION } from '../machines';
import type { Command } from './index';
import { help } from './manual';

const NOT_NFT_ALLOWED = 'netlink: Error: cache initialization failed: Operation not permitted';
const CONNTRACK = 'conntrack v1.4.8 (conntrack-tools)';

function commandNft(game: Shell, args: string[]): string {
  const options: string[] = [];
  let file: string | null = null;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (rest.length) rest.push(a);
    else if (a === '-f' || a === '--file') file = args[++i] ?? '';
    else if (/^-[a-zA-Z]+$/.test(a)) options.push(...a.slice(1));
    else if (a.startsWith('--')) options.push(a);
    else rest.push(a);
  }
  if (options.includes('h')) return help('nft', NFTABLES.nft, game.t);
  if (options.includes('--version') || options.includes('v')) return 'nftables v1.1.3 (Commodore Bullseye #4)';
  const unknown = options.find((o) => !['c', 'a', 'n', 's', 'e', '--check', '--handle', '--numeric', '--echo'].includes(o));
  if (unknown) return game.error(`nft: invalid option -- '${unknown.replace(/^-+/, '')}'\nTry \`nft -h' for more information.`, 1);
  const check = options.includes('c') || options.includes('--check');
  const handshakes = options.includes('a') || options.includes('--handle');
  if (file === null && !rest.length) return game.error('Error: no command specified', 1);
  if (game.who !== 'root') return game.error(NOT_NFT_ALLOWED, 1);
  if (onlyPreview(game)) return preview(game, file === null ? rest : []);
  let text: string;
  let fileName: string | null = null;
  if (file !== null) {
    const read = game.read(file);
    if (read === null) return game.error(`Error: Could not open file "${file}": No such file or directory`, 1);
    text = read;
    fileName = file;
  } else text = rest.join(' '); // like nft: the arguments joined together (the shell has already removed the quotes)
  try {
    const { ruleset, lists } = runNft(game, text, nft(game));
    if (check) return '';
    const change = JSON.stringify(ruleset) !== JSON.stringify(nft(game));
    game.state.nft = ruleset;
    if (change) logTraffic(game);
    const seen = lists.length ? withCounters(game) : ruleset;
    return lists.map((l) => show(seen, l, handshakes)).join('\n');
  } catch (e) {
    if (!(e instanceof NftError)) throw e;
    const source = (e as { file?: string }).file;
    return game.error(formatError(e, fileName, source ? (game.read(source) ?? text) : text), 1);
  }
}

// On a machine where ufw and fail2ban hold the firewall: read their tables, without touching them.
function preview(game: Shell, words: string[]): string {
  const tables = previewTables(game);
  const [verb, object, family, name] = words;
  if (verb === 'list' && object === 'ruleset' && words.length === 2) return [...tables.values()].map((t) => t.join('\n')).join('\n');
  if (verb === 'list' && object === 'tables' && words.length === 2) return [...tables.keys()].map((k) => `table ${k}`).join('\n');
  if (verb === 'list' && object === 'table' && words.length === 4) {
    const t = tables.get(`${family} ${name}`);
    return t
      ? t.join('\n')
      : game.error(`Error: No such file or directory\nlist table ${family} ${name}\n${' '.repeat(12 + family.length)}${'^'.repeat(name.length)}`, 1);
  }
  return game.error(game.t('nft-preview-ufw'), 1);
}

// ——— sysctl ———

const path = (key: string) => `/proc/sys/${key.replace(/\./g, '/')}`;
const keyFor = (text: string) =>
  text
    .trim()
    .replace(/^\/proc\/sys\//, '')
    .replace(/\//g, '.');
// The kernel links these two keys: writing one changes the other.
const LINKED: Record<string, string> = {
  'net.ipv4.ip_forward': 'net.ipv4.conf.all.forwarding',
  'net.ipv4.conf.all.forwarding': 'net.ipv4.ip_forward',
};

function writeKey(game: Game, key: string, value: string): string | null {
  const n = game.find(path(key));
  if (n?.type !== 'file') return `sysctl: cannot stat ${path(key)}: No such file or directory`;
  if (game.who !== 'root') return `sysctl: permission denied on key "${key}"`;
  if (!/^-?\d+$/.test(value) && ['net.ipv4.ip_forward', 'net.ipv4.conf.all.forwarding'].includes(key))
    return `sysctl: setting key "${key}": Invalid argument`;
  n.content = value;
  const linked = LINKED[key] && game.find(path(LINKED[key]));
  if (linked && linked.type === 'file') linked.content = value;
  return null;
}

/** The settings of a sysctl.conf file: "key = value" (lines starting with "-" ignore errors). */
export function sysctlLines(text: string): { key: string; value: string; tolerant: boolean }[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith(';') && l.includes('='))
    .map((l) => {
      const tolerant = l.startsWith('-');
      const [key, ...v] = l.replace(/^-/, '').split('=');
      return { key: keyFor(key), value: v.join('=').trim(), tolerant };
    });
}

const SYSCTL_DIRECTORIES = ['/etc/sysctl.d', '/run/sysctl.d', '/usr/local/lib/sysctl.d', '/usr/lib/sysctl.d'];

/** The files sysctl --system reads (and systemd-sysctl at boot), in order. */
export function sysctlFiles(game: Game): string[] {
  const byName = new Map<string, string>();
  for (const d of SYSCTL_DIRECTORIES) {
    const n = game.find(d);
    if (n?.type !== 'directory') continue;
    for (const name of Object.keys(n.children)) if (name.endsWith('.conf') && !byName.has(name)) byName.set(name, `${d}/${name}`);
  }
  const listing = [...byName.keys()].sort().map((n) => byName.get(n)!);
  if (game.exists('/etc/sysctl.conf')) listing.push('/etc/sysctl.conf');
  return listing;
}

/** At boot: the kernel's default values, then the files (systemd-sysctl). */
export function applySysctl(game: Game, defaults: Record<string, string>) {
  for (const [key, v] of Object.entries(defaults)) {
    const n = game.find(path(key));
    // The machine's name, in the language (ruche → hive).
    if (n?.type === 'file') n.content = key === 'kernel.hostname' ? game.hostName : v;
  }
  const who = game.who;
  game.who = 'root';
  for (const f of sysctlFiles(game)) for (const { key, value } of sysctlLines(game.read(f) ?? '')) writeKey(game, key, value);
  game.who = who;
}

/** The value this key would have after a reboot (the last one written by the files). */
export function sysctlToBoot(game: Game, key: string, fallback: string): string {
  let v = fallback;
  for (const f of sysctlFiles(game)) for (const l of sysctlLines(game.read(f) ?? '')) if (l.key === key || LINKED[key] === l.key) v = l.value;
  return v;
}

function keysAll(n: Node, prefix: string): string[] {
  if (n.type !== 'directory') return [prefix];
  return Object.keys(n.children)
    .sort()
    .flatMap((k) => keysAll(n.children[k], prefix ? `${prefix}.${k}` : k));
}

function sysctl(game: Shell, args: string[]): string {
  const outputs: string[] = [];
  let write = false;
  let onlyValue = false;
  let silence = false;
  const show = (key: string, v: string) => !silence && outputs.push(onlyValue ? v : `${key} = ${v}`);
  const applyFile = (f: string) => {
    const text = game.read(f);
    if (text === null) return game.error(`sysctl: cannot open "${f}": No such file or directory`, 255);
    for (const { key, value, tolerant } of sysctlLines(text)) {
      const e = writeKey(game, key, value);
      if (e && !tolerant) game.error(e, 255);
      else if (!e) show(key, value);
    }
  };
  if (!args.length) return game.error(game.t('sysctl-usage'), 255);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-h') return help('sysctl', NFTABLES.sysctl, game.t);
    if (a === '--system') {
      for (const f of sysctlFiles(game)) {
        outputs.push(`* Applying ${f} ...`);
        applyFile(f);
      }
    } else if (a === '-p' || a === '--load' || a.startsWith('-p') || a.startsWith('--load=')) {
      const f = a.startsWith('--load=')
        ? a.slice(7)
        : a.length > 2 && a.startsWith('-p')
          ? a.slice(2)
          : args[i + 1] && !args[i + 1].startsWith('-')
            ? args[++i]
            : '/etc/sysctl.conf';
      applyFile(f);
    } else if (a === '-a' || a === '-A' || a === '--all') {
      const root = game.find('/proc/sys');
      if (root) for (const key of keysAll(root, '')) show(key, game.read(path(key))?.trim() ?? '');
    } else if (a === '-w' || a === '--write') write = true;
    else if (a === '-n' || a === '--values') onlyValue = true;
    else if (a === '-q' || a === '--quiet') silence = true;
    else if (/^-[nqw]+$/.test(a)) {
      if (a.includes('n')) onlyValue = true;
      if (a.includes('q')) silence = true;
      if (a.includes('w')) write = true;
    } else if (a.startsWith('-')) return game.error(`sysctl: unknown option '${a}'\n${game.t('sysctl-usage')}`, 255);
    else if (a.includes('=')) {
      const [key, ...v] = a.split('=');
      const e = writeKey(game, keyFor(key), v.join('='));
      if (e) game.error(e, 255);
      else show(keyFor(key), v.join('='));
    } else if (write) game.error(`sysctl: "${a}" must be of the form name=value`, 255);
    else {
      const key = keyFor(a);
      const n = game.find(path(key));
      if (n?.type === 'directory') for (const k of keysAll(n, key)) show(k, game.read(path(k))?.trim() ?? '');
      else if (n?.type !== 'file') game.error(`sysctl: cannot stat ${path(key)}: No such file or directory`, 255);
      else show(key, game.read(path(key))!.trim());
    }
  }
  return outputs.join('\n');
}

// ——— conntrack ———

function conntrack(game: Shell, args: string[]): string {
  if (args.includes('-h')) return help('conntrack', NFTABLES.conntrack, game.t);
  const action = args.find((a) => ['-L', '--dump', '-C', '--count', '-F', '--flush', '-E', '--event'].includes(a));
  if (!action) return game.error(`${CONNTRACK}: no command specified\nTry \`conntrack -h' or 'conntrack --help' for more information.`, 2);
  if (game.who !== 'root') return game.error(`${CONNTRACK}: Operation failed: Operation not permitted`, 1);
  if (action === '-E' || action === '--event') return game.error(game.t('conntrack-events'), 1);
  if (action === '-F' || action === '--flush') {
    // The ongoing exchanges are recreated at once: the devices keep talking.
    game.error(`${CONNTRACK}: connection tracking table has been emptied.`, 0);
    return '';
  }
  const after = (o: string[]) => {
    const k = args.findIndex((a) => o.includes(a));
    return k >= 0 ? args[k + 1] : undefined;
  };
  const proto = after(['-p', '--proto']);
  const source = after(['-s', '--src', '--orig-src']);
  const destination = after(['-d', '--dst', '--orig-dst']);
  const lines: string[] = [];
  // The game's ssh session, to the router itself.
  const ssh = {
    proto: 'tcp' as const,
    saddr: WORKSTATION.address,
    daddr: lan(game)?.interfaces.eth0?.addresses[0]?.split('/')[0] ?? '',
    sport: 52814,
    dport: 22,
  };
  const inputs = [
    ...(ssh.daddr ? [{ ...ssh, answered: true, view: ssh.saddr, ok: true }] : []),
    ...results(game)
      .filter((r) => r.go && (r.state === 'ok' || r.state === 'no-response'))
      .map((r) => ({ ...r.go!, answered: r.state === 'ok', view: r.translated ?? r.go!.saddr, ok: r.state === 'ok', real: r.destination })),
  ].filter((e) => (!proto || e.proto === proto) && (!source || e.saddr === source) && (!destination || e.daddr === destination));
  for (const e of inputs) {
    const number = e.proto === 'tcp' ? 6 : 17;
    const state = e.proto === 'tcp' ? (e.ok ? ' ESTABLISHED' : ' SYN_SENT') : '';
    const delay = e.proto === 'tcp' ? (e.ok ? 431999 : 119) : e.ok ? 119 : 29;
    const go = `src=${e.saddr} dst=${e.daddr} sport=${e.sport} dport=${e.dport}`;
    // The reply comes from the real destination (after dnat), to the address seen (after masquerade).
    const real = 'real' in e && e.real ? e.real : { address: e.daddr, port: e.dport };
    const back = `src=${real.address} dst=${e.view} sport=${real.port} dport=${e.sport}`;
    lines.push(
      `${e.proto.padEnd(8)} ${number} ${delay}${state} ${go} ${e.ok ? '' : '[UNREPLIED] '}${back} ${e.ok ? '[ASSURED] ' : ''}mark=0 use=1`,
    );
  }
  if (action === '-C' || action === '--count') return String(lines.length);
  game.error(`${CONNTRACK}: ${lines.length} flow entries have been shown.`, 0);
  return lines.join('\n');
}

export const NFTABLES: Record<string, Command> = {
  nft: { section: 8, ownOptions: true, launch: ({ args, game }) => commandNft(game, args) },
  sysctl: { section: 8, ownOptions: true, launch: ({ args, game }) => sysctl(game, args) },
  conntrack: { section: 8, ownOptions: true, launch: ({ args, game }) => conntrack(game, args) },
  // The manual page of the settings files (man 5 sysctl.d).
  'sysctl.d': { section: 5, launch: () => '' },
};
