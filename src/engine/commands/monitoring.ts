// La supervision : le courrier local (mail, de bsd-mailx) et trois plugins
// de monitoring-plugins (ceux de Nagios, Icinga, Shinken…) : check_disk,
// check_http, check_procs. Un plugin écrit une ligne (OK, WARNING,
// CRITICAL, UNKNOWN, puis les mesures après « | ») et rend un code de
// retour : 0, 1, 2 ou 3. D'après https://www.monitoring-plugins.org/doc/man/
// (check_disk, check_http, check_procs) et
// https://www.monitoring-plugins.org/doc/guidelines.html (codes de retour,
// seuils) ; mail d'après mailx(1) de bsd-mailx.
// Écarts : les plugins sont dans /usr/lib/nagios/plugins (hors du PATH,
// comme sur Debian) ; peu d'options ; mail sans mode interactif (il liste
// la boîte et rend la main) ; le courrier ne quitte pas la machine.

import type { Shell } from '../shell';
import type { Process } from './system';
import { appRequest } from '../nginx';
import { systemd } from '../systemd';
import { timeOfDay, machineTime } from '../time';
import type { Command } from './index';
import { submit } from '../mail';

export const PLUGINS = '/usr/lib/nagios/plugins';
const CODES = ['OK', 'WARNING', 'CRITICAL', 'UNKNOWN'];

export interface Mail {
  time: number;
  forEachOf: string;
  a: string;
  subject: string;
  body: string;
}

/** Les courriers remis sur cette machine (pour les histoires : qui a été prévenu, et quand). */
export const mails = (game: Shell): Mail[] => (game.state.mails ??= []);

// L'heure de la machine, et sa date au format des courriers.
const now = (game: Shell) => (timeOfDay(game) ? machineTime(game).wall : (systemd(game)?.clock ?? Date.UTC(2027, 0, 1)));
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateMbox = (ms: number) => {
  const d = new Date(ms);
  return `${DAYS[d.getUTCDay()]} ${MONTH[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${d.toISOString().slice(11, 19)} ${d.getUTCFullYear()}`;
};

/** À qui va un courrier : la partie locale de l'adresse, après /etc/aliases. */
function recipient(game: Shell, address: string): string {
  const local = address.replace(/@.*$/, '');
  const aliases = game.read('/etc/aliases') ?? '';
  const alias = new RegExp(`^${local}:\\s*(\\S+)`, 'm').exec(aliases)?.[1];
  return alias ? alias.replace(/@.*$/, '') : local;
}

export function send(game: Shell, addresses: string[], subject: string, body: string): void {
  const forEachOf = game.who;
  const host = systemd(game)?.host ?? 'localhost';
  for (const address of addresses) {
    const account = recipient(game, address);
    const time = now(game);
    mails(game).push({ time: systemd(game)?.clock ?? time, forEachOf, a: account, subject, body });
    if (!game.accounts.users[account]) continue;
    const message = [
      `From ${forEachOf}@${host} ${dateMbox(time)}`,
      `To: ${address}`,
      `Subject: ${subject}`,
      `From: ${forEachOf} <${forEachOf}@${host}>`,
      '',
      body,
      '',
    ].join('\n');
    const path = `/var/mail/${account}`;
    const n = game.find(path);
    if (n?.type === 'fichier') n.content = `${typeof n.content === 'string' && n.content ? n.content + '\n' : ''}${message}`;
    else if (game.find('/var/mail')?.type === 'dossier')
      (game.find('/var/mail') as { children: Record<string, unknown> }).children[account] = {
        type: 'fichier',
        content: message,
        lines: true,
        owner: account,
        group: 'mail',
        mode: 'rw-rw----',
      };
  }
}

// La boîte d'un compte, comme l'en-tête de mail sans argument.
function box(game: Shell): string {
  const text = game.read(`/var/mail/${game.who}`);
  const messages = (text ?? '').split(/^(?=From \S+ )/m).filter((m) => m.startsWith('From '));
  if (!messages.length) return game.error(`No mail for ${game.who}`);
  return [
    'Mail version 8.1.2 01/15/2001.  Type ? for help.',
    `"/var/mail/${game.who}": ${messages.length} message${messages.length > 1 ? 's' : ''} ${messages.length} new`,
    ...messages.map((m, i) => {
      const forEachOf = /^From (\S+)/.exec(m)![1];
      const date = /^From \S+ (\w+ \w+ +\d+ \d\d:\d\d)/.exec(m)?.[1] ?? '';
      const subject = /^Subject: (.*)$/m.exec(m)?.[1] ?? '';
      return `${i === 0 ? '>' : ' '}N ${String(i + 1).padStart(2)} ${forEachOf.padEnd(18)} ${date}  ${subject}`;
    }),
  ].join('\n');
}

// Un seuil en pourcentage de libre (« 20% ») : le statut quand il reste `libre` %.
const pctThreshold = (text: string | undefined) => (text && /^\d+(\.\d+)?%$/.test(text) ? Number(text.slice(0, -1)) : null);

function checkDisk(game: Shell, args: string[]): string {
  const value = (o: string) => (args.includes(o) ? args[args.indexOf(o) + 1] : undefined);
  const w = pctThreshold(value('-w'));
  const c = pctThreshold(value('-c'));
  const wi = pctThreshold(value('-W'));
  const self = pctThreshold(value('-K'));
  const paths = args.flatMap((a, i) => (a === '-p' ? [args[i + 1]] : []));
  if (w === null || c === null || !paths.length) {
    game.status = 3;
    return 'Usage:\ncheck_disk -w limit -c limit [-W limit] [-K limit] {-p path | -x device}';
  }
  let worst = 0;
  const texts: string[] = [];
  const measures: string[] = [];
  for (const path of paths) {
    const absolute = game.resolve(path);
    const m = game.mount(absolute) as { path: string; capacity: number; inodes?: number; inodesBase?: number } | null;
    if (!game.find(absolute) || !m) {
      game.status = 3;
      return `DISK UNKNOWN - ${path} does not exist`;
    }
    const place = game.find(m.path)!;
    const taken = Math.min(m.capacity, game.size(place));
    const freeMem = m.capacity - taken;
    const pct = Math.floor((100 * freeMem) / m.capacity);
    const totalInodes = m.inodes ?? Math.round(m.capacity / 16384);
    const inodePct = Math.floor((100 * (totalInodes - Math.min(totalInodes, game.usedInodes(m)))) / totalInodes);
    let state = pct < c ? 2 : pct < w ? 1 : 0;
    if (self !== null && inodePct < self) state = 2;
    else if (wi !== null && inodePct < wi) state = Math.max(state, 1);
    worst = Math.max(worst, state);
    const mo = (o: number) => Math.round(o / 1048576);
    texts.push(`${m.path} ${mo(freeMem)} MB (${pct}% inode=${inodePct}%);`);
    measures.push(`${m.path}=${mo(taken)}MB;${mo(m.capacity * (1 - w / 100))};${mo(m.capacity * (1 - c / 100))};0;${mo(m.capacity)}`);
  }
  game.status = worst;
  return `DISK ${CODES[worst]} - free space: ${texts.join(' ')}| ${measures.join(' ')}`;
}

function checkHttp(game: Shell, args: string[]): string {
  const value = (o: string) => (args.includes(o) ? args[args.indexOf(o) + 1] : undefined);
  const host = value('-H') ?? value('-I');
  const port = Number(value('-p') ?? 80);
  const uri = value('-u') ?? '/';
  if (!host) {
    game.status = 3;
    return 'check_http: You must specify a server address or host name\nUsage:\ncheck_http -H <vhost> | -I <IP-address> [-u <uri>] [-p <port>]';
  }
  const local = ['localhost', '127.0.0.1', systemd(game)?.host ?? ''].includes(host);
  const r = local ? appRequest(game, port, uri) : null;
  if (!r) {
    game.status = 2;
    return `connect to address ${host} and port ${port}: Connection refused\nHTTP CRITICAL - Unable to open TCP socket`;
  }
  const reasons: Record<number, string> = {
    200: 'OK',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  const state = r.code >= 500 ? 2 : r.code >= 400 ? 1 : 0;
  game.status = state;
  const size = r.body.length;
  return `HTTP ${CODES[state]}: HTTP/1.1 ${r.code} ${reasons[r.code] ?? ''} - ${size} bytes in 0.004 second response time |time=0.004000s;;;0.000000 size=${size}B;;;0`;
}

// « 1: » (au moins 1), « :5 » (au plus 5), « 2:3 », « 4 » (de 0 à 4) : hors de la plage, alerte.
function inRange(n: number, range: string): boolean {
  const m = /^(\d*):(\d*)$/.exec(range);
  if (m) return (m[1] === '' || n >= Number(m[1])) && (m[2] === '' || n <= Number(m[2]));
  return n >= 0 && n <= Number(range);
}

function checkProcs(game: Shell, args: string[]): string {
  const value = (o: string) => (args.includes(o) ? args[args.indexOf(o) + 1] : undefined);
  const name = value('-C');
  const w = value('-w');
  const c = value('-c');
  const listing: Process[] = (game.state.process ?? []).filter((p: Process) => !p.zombie);
  const n = listing.filter((p) => !name || p.command.split(/\s+/)[0].split('/').at(-1) === name).length;
  const state = c && !inRange(n, c) ? 2 : w && !inRange(n, w) ? 1 : 0;
  game.status = state;
  const what = `${n} process${n === 1 ? '' : 'es'}${name ? ` with command name '${name}'` : ''}`;
  return `PROCS ${CODES[state]}: ${what} | procs=${n};${w ?? ''};${c ?? ''};0;`;
}

/** Une connexion passée ou en cours (pour last), décrite par l'histoire. */
export interface Connection {
  account: string;
  tty: string;
  since: string;
  start: number;
  end: number | null;
}

// last : les connexions, de la plus récente à la plus ancienne (d'après /var/log/wtmp).
function last(game: Shell, args: string[]): string {
  const i = args.indexOf('-n');
  const max = i >= 0 ? Number(args[i + 1]) : Infinity;
  const accounts = args.filter((a, k) => !a.startsWith('-') && args[k - 1] !== '-n');
  const listing: Connection[] = [...((game.state.pastConnections ?? []) as Connection[])]
    .filter((c) => !accounts.length || accounts.includes(c.account))
    .sort((a, b) => b.start - a.start)
    .slice(0, max);
  const short = (ms: number) => dateMbox(ms).slice(0, 16);
  const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16);
  const lines = listing.map((c) => {
    const start = `${c.account.padEnd(8)} ${c.tty.padEnd(12)} ${c.since.padEnd(16)} ${short(c.start)}`;
    if (c.end === null) return `${start}   still logged in`;
    const minutes = Math.round((c.end - c.start) / 60_000);
    return `${start} - ${hhmm(c.end)}  (${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')})`;
  });
  const first = systemd(game)?.log[0]?.time ?? 0;
  return [...lines, '', `wtmp begins ${dateMbox(first)}`].join('\n');
}

export const SUPERVISION: Record<string, Command> = {
  last: { options: ['n'], launch: ({ args, game }) => last(game, args) },
  mail: {
    ownOptions: true,
    launch: ({ args, input, game }) => {
      let subject = '';
      let forbiddenEmpty = false;
      const addresses: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-s') subject = args[++i] ?? '';
        else if (args[i] === '-E') forbiddenEmpty = true;
        else if (args[i].startsWith('-'))
          return game.error(`mail: illegal option -- ${args[i].slice(1)}\nUsage: mail [-EiInv] [-s subject] [-c cc-addr] [-b bcc-addr] to-addr ...`);
        else addresses.push(args[i]);
      }
      if (!addresses.length) return box(game);
      const body = (input ?? '').replace(/\n+$/, '');
      // -E : pas de courrier vide (pratique : n'envoyer que s'il y a quelque chose à dire).
      if (!body) {
        if (forbiddenEmpty) return '';
        game.error('Null message body; hope that\u0027s ok');
      }
      // Une machine avec Postfix (courrier.ts) : le message part par la file d'attente, vers la machine ou au-dehors.
      if (game.state.mail) {
        submit(game, game.who, addresses, subject, body, game.accounts.users[game.who]?.uid ?? 1000);
        return '';
      }
      send(game, addresses, subject, body);
      return '';
    },
  },
  // La page de manuel des timers (section 5), pas une commande.
  'systemd.timer': { section: 5, launch: () => '' },
  check_disk: { directory: PLUGINS, ownOptions: true, launch: ({ args, game }) => checkDisk(game, args) },
  check_http: { directory: PLUGINS, ownOptions: true, launch: ({ args, game }) => checkHttp(game, args) },
  check_procs: { directory: PLUGINS, ownOptions: true, launch: ({ args, game }) => checkProcs(game, args) },
};
