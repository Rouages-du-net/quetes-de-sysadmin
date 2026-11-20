// Network clients: wget (GNU Wget 1.25, https://www.gnu.org/software/wget/manual/wget.html)
// on top of the game's curl (the same requests, the same answers), nslookup
// (BIND 9.20, https://bind9.readthedocs.io/en/stable/manpages.html#nslookup),
// and host on a machine without a simulated DNS. Like the real tools, host
// and nslookup ask the DNS servers of /etc/resolv.conf, never /etc/hosts.
// Differences: wget's progress bar is drawn once, finished; no recursion
// (-r, -m), no -c; the dates are the machine's.

import type { Command, Context } from './index';
import type { Shell } from '../shell';
import { dnsServers, resolveName } from './network';
import { dns, query, serverFor } from '../dns';
import { systemd, toUtc } from '../systemd';
import { nowOf } from '../time';

const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const LEFT = '\u2018';
const RIGHT = '\u2019';

// ——— wget ———

interface WgetOptions {
  output: string | null;
  quiet: boolean;
  spider: boolean;
  url: string | null;
  headers: string[];
}

function parseWget(args: string[]): WgetOptions | string {
  const o: WgetOptions = { output: null, quiet: false, spider: false, url: null, headers: [] };
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === '--spider') o.spider = true;
    else if (a === '-q' || a === '--quiet') o.quiet = true;
    else if (a === '-O' || a === '--output-document') o.output = args[++k] ?? '';
    else if (a.startsWith('--output-document=')) o.output = a.slice(18);
    else if (a === '--header') o.headers.push(args[++k] ?? '');
    else if (/^-q*O.*$/.test(a) && a.startsWith('-')) {
      // -qO- (quiet, to the standard output), -O-, -Ofile.
      if (a.includes('q')) o.quiet = true;
      const rest = a.slice(a.indexOf('O') + 1);
      o.output = rest || args[++k] || '';
    } else if (a === '--no-check-certificate' || a === '-nv' || a === '--no-verbose' || a === '-c' || a === '--continue') continue;
    else if (a.startsWith('--')) return `wget: unrecognized option '${a}'`;
    else if (a.startsWith('-') && a.length > 1) return `wget: invalid option -- '${a[1]}'`;
    else o.url = a;
  }
  return o;
}

function wget({ args, game, last }: Context): string {
  const o = parseWget(args);
  if (typeof o === 'string') return game.error(`${o}\nUsage: wget [OPTION]... [URL]...\n\nTry \`wget --help' for more options.`, 2);
  if (!o.url) return game.error("wget: missing URL\nUsage: wget [OPTION]... [URL]...\n\nTry `wget --help' for more options.", 1);
  const url = /^[a-z]+:\/\//i.test(o.url) ? o.url : `http://${o.url}`;
  const m = /^(https?):\/\/([^/:]+)(?::(\d+))?(\/[^?#]*)?/i.exec(url);
  if (!m) return game.error(`${o.url}: Invalid URL ${o.url}: Unsupported scheme`, 1);
  const host = m[2];
  const port = m[3] ?? (m[1] === 'https' ? '443' : '80');
  const now = nowOf(game);
  const log: string[] = [`--${stamp(now)}--  ${url}`];
  // The request itself: the game's curl, with its headers.
  const before = game.errorCount();
  const raw = game.run(['curl', '-s', '-i', ...o.headers.flatMap((h) => ['-H', h]), url], null, false);
  const all = game.recoverErrors();
  for (const e of all.slice(0, before)) game.error(e);
  const errors = all.slice(before);
  const curlError = errors.join('\n');
  const finish = (code: number) => {
    if (!o.quiet) game.error(log.join('\n'));
    game.status = code;
    return '';
  };
  if (/\(6\) Could not resolve host/.test(curlError)) {
    log.push(`Resolving ${host} (${host})... failed: Name or service not known.`, `wget: unable to resolve host address ${LEFT}${host}${RIGHT}`);
    return finish(4);
  }
  const address = host === 'localhost' ? '127.0.0.1' : ('ip' in resolveName(game, host) ? (resolveName(game, host) as { ip: string }).ip : /^\d+(\.\d+){3}$/.test(host) ? host : '127.0.1.1');
  if (!/^\d+(\.\d+){3}$/.test(host)) log.push(`Resolving ${host} (${host})... ${address}`);
  if (/\(7\)|\(52\)|\(35\)|\(60\)/.test(curlError) || (!raw && curlError)) {
    if (/\(60\)|\(35\)/.test(curlError)) {
      log.push(`Connecting to ${host} (${host})|${address}|:${port}... connected.`, `ERROR: cannot verify ${host}'s certificate, issued by ${LEFT}CN=Unknown${RIGHT}:`, '  Unable to locally verify the issuer\'s authority.', `To connect to ${host} insecurely, use \`--no-check-certificate'.`);
      return finish(5);
    }
    log.push(`Connecting to ${host} (${host})|${address}|:${port}... failed: Connection refused.`);
    return finish(4);
  }
  log.push(`Connecting to ${host} (${host})|${address}|:${port}... connected.`);
  // The answer: its status line, its headers, its body.
  const split = raw.indexOf('\n\n');
  const head = split >= 0 ? raw.slice(0, split) : raw;
  const body = split >= 0 ? raw.slice(split + 2) : '';
  const status = /^HTTP\/[\d.]+ (\d{3})(?: (.*))?$/m.exec(head);
  const code = Number(status?.[1] ?? 200);
  const reason = status?.[2] ?? 'OK';
  log.push(`HTTP request sent, awaiting response... ${code} ${reason}`);
  if (code >= 400) {
    log.push(`${stamp(now)} ERROR ${code}: ${reason}.`);
    return finish(8);
  }
  const type = /^content-type:\s*([^;\r\n]+)/im.exec(head)?.[1] ?? 'text/html';
  const length = new TextEncoder().encode(body ? `${body}\n` : '').length;
  log.push(`Length: ${length} [${type}]`);
  if (o.spider) {
    log.splice(0, 0, 'Spider mode enabled. Check if remote file exists.');
    log.push('Remote file exists and could contain further links,', 'but recursion is disabled -- not retrieving.');
    return finish(0);
  }
  // -O -: the body to the standard output; otherwise a file named after the URL.
  if (o.output === '-') {
    log.push(`Saving to: ${LEFT}STDOUT${RIGHT}`, '', `-                   100%[===================>] ${String(length).padStart(7)}  --.-KB/s    in 0s      `, '', `${stamp(now)} (12.4 MB/s) - written to stdout [${length}/${length}]`, '');
    if (!o.quiet) game.error(log.join('\n'));
    game.status = 0;
    return body;
  }
  let name = o.output ?? decodeURIComponent((m[4] ?? '/').split('/').at(-1) ?? '') ?? '';
  if (!name) name = 'index.html';
  // Without -O, an existing name gets .1, .2…
  if (!o.output && game.find(name)) {
    let k = 1;
    while (game.find(`${name}.${k}`)) k++;
    name = `${name}.${k}`;
  }
  log.push(`Saving to: ${LEFT}${name}${RIGHT}`, '');
  const there = game.find(name);
  let refused: string | null = null;
  if (there?.type === 'directory') refused = 'Is a directory';
  else if (there) {
    if (!game.can(there, 'w')) refused = 'Permission denied';
    else Object.assign(there, { content: body, lines: true, size: undefined, mtime: now });
  } else if (game.place('wget', name, { type: 'file', content: body, lines: true, owner: game.who, mtime: now })) refused = game.find(name + '/..') ? 'Permission denied' : 'No such file or directory';
  if (refused) {
    return game.error(`${name}: ${refused}`, 3);
  }
  log.push(`${name.padEnd(20).slice(0, 20)}100%[===================>] ${String(length).padStart(7)}  --.-KB/s    in 0s      `, '', `${stamp(now)} (12.4 MB/s) - ${LEFT}${name}${RIGHT} saved [${length}/${length}]`, '');
  void last;
  return finish(0);
}

// ——— nslookup, and host without a simulated DNS ———

/** What the machine's DNS answers for a name, through the story's model. */
function lookup(game: Shell, name: string, server?: string): { server: string; address?: string; nxdomain?: boolean; timeout?: boolean } {
  const target = server ?? dnsServers(game)[0] ?? '127.0.0.1';
  const d = dns(game);
  if (d) {
    const s = serverFor(d, target);
    if (!s) return { server: target, timeout: true };
    const r = query(game, s, name, 'A', toUtc(systemd(game)?.clock ?? 0));
    if (r.status === 'NXDOMAIN') return { server: target, nxdomain: true };
    const a = r.responses.find((x) => x.type === 'A');
    return { server: target, address: a?.data, nxdomain: !a };
  }
  const res = resolveName(game, name, server);
  if ('ip' in res) return { server: target, address: res.ip };
  // No simulated network, or a server that doesn't answer: the query times out.
  return { server: target, timeout: res.error === 'timeout' || !game.state.network, nxdomain: res.error === 'unknown' && !!game.state.network };
}

function nslookup({ args, game }: Context): string {
  const words = args.filter((a) => !a.startsWith('-'));
  const [name, server] = words;
  if (!name) return game.error('> (interactive mode is not simulated: give a name, nslookup NAME [SERVER])', 1);
  if (/^\d+(\.\d+){3}$/.test(name)) {
    const r = lookup(game, name, server);
    if (r.timeout) return game.error(`;; communications error to ${r.server}#53: timed out\n;; communications error to ${r.server}#53: timed out\n;; communications error to ${r.server}#53: timed out\n;; no servers could be reached`, 1);
    return game.error(`** server can't find ${name.split('.').reverse().join('.')}.in-addr.arpa: NXDOMAIN`, 1);
  }
  const r = lookup(game, name, server);
  if (r.timeout)
    return game.error(`;; communications error to ${r.server}#53: timed out\n;; communications error to ${r.server}#53: timed out\n;; communications error to ${r.server}#53: timed out\n;; no servers could be reached\n`, 1);
  const header = [`Server:\t\t${r.server}`, `Address:\t${r.server}#53`, ''];
  if (r.nxdomain || !r.address) {
    game.status = 1;
    return [...header, `** server can't find ${name}: NXDOMAIN`].join('\n');
  }
  return [...header, 'Non-authoritative answer:', `Name:\t${name.replace(/\.$/, '')}`, `Address: ${r.address}`].join('\n');
}

/** host on a machine without the simulated DNS (dns.ts): the story's network, else no server answers. */
export function hostWithoutDns(game: Shell, name: string, server?: string): string {
  const r = lookup(game, name, server);
  if (r.timeout) return game.error(`;; communications error to ${r.server}#53: timed out\n;; communications error to ${r.server}#53: timed out\n;; no servers could be reached`, 1);
  if (r.nxdomain || !r.address) return game.error(`Host ${name} not found: 3(NXDOMAIN)`, 1);
  return `${name.replace(/\.$/, '')} has address ${r.address}`;
}

export const NET_CLIENTS: Record<string, Command> = {
  wget: { ownOptions: true, launch: wget },
  nslookup: { ownOptions: true, launch: nslookup },
};

