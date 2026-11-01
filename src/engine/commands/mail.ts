// Les commandes du courrier : postconf, postfix, postqueue, mailq, postsuper
// (Postfix) et opendkim-genkey, opendkim-testkey (OpenDKIM). Messages
// d'après postconf(1), postfix(1), postqueue(1), postsuper(1),
// opendkim-genkey(8) et opendkim-testkey(8). Le moteur est dans courrier.ts.
// Écarts : postconf ne connaît qu'une partie des paramètres ; postfix
// start/stop/reload passent par systemd ; opendkim-testkey interroge le
// serveur DNS de la machine.

import type { Shell } from '../shell';
import type { Command } from './index';
import { start, stop, reload, systemd } from '../systemd';
import { dns, query, txtText } from '../dns';
import {
  showFile,
  tags,
  privateKey,
  publicKey,
  mail,
  dkimRecord,
  writeLog,
  readDkim,
  readMainCf,
  MAIN_CF,
  OPENDKIM_CONF,
  parameter,
  PARAMETERS,
  empty,
} from '../mail';

const reserve = (game: Shell, program: string) => game.error(`${program}: fatal: use of this command is reserved for the superuser`);

// postconf : lire et changer main.cf.
function postconf(game: Shell, args: string[]): string {
  const options = new Set(args.filter((a) => /^-[a-zA-Z]+$/.test(a)).flatMap((a) => [...a.slice(1)]));
  const badOption = [...options].find((o) => !'ndxeh'.includes(o));
  if (badOption) return game.error(`postconf: invalid option -- '${badOption}'\npostconf: fatal: usage: postconf [-abCdfhHlmMnoPtTvx] [-c config_dir] [-e] [-#] [parameter ...]`);
  const names = args.filter((a) => !a.startsWith('-'));
  const text = game.read(MAIN_CF) ?? '';
  const { values, unknown, order } = readMainCf(text);
  // nom=valeur (avec ou sans -e) : on modifie main.cf.
  const changes = names.filter((n) => n.includes('='));
  if (changes.length) {
    if (game.who !== 'root') return game.error(`postconf: fatal: open ${MAIN_CF}.tmp: Permission denied`);
    let fresh = text;
    for (const c of changes) {
      const [name, ...rest] = c.split('=');
      const line = `${name.trim()} = ${rest.join('=').trim()}`;
      const re = new RegExp(`^${name.trim()}\\s*=.*(\\n[ \\t].*)*`, 'm');
      fresh = re.test(fresh) ? fresh.replace(re, line) : `${fresh.replace(/\n*$/, '')}\n${line}\n`;
    }
    const n = game.find(MAIN_CF);
    if (n?.type === 'fichier') n.content = fresh;
    return '';
  }
  const warn = () => unknown.forEach((n) => game.error(`postconf: warning: ${MAIN_CF}: unused parameter: ${n}=${values[n]}`, 0));
  const show = (n: string) => `${n} = ${options.has('x') ? parameter(game, n) : options.has('d') ? (readDefault(n) ?? '') : (values[n] ?? readDefault(n) ?? '')}`.trimEnd();
  warn();
  if (names.length)
    return names
      .map((n) => {
        if (!PARAMETERS.includes(n) && !(n in values)) {
          game.error(`postconf: warning: ${n}: unknown parameter`, 0);
          return null;
        }
        return options.has('h') ? (options.has('x') ? parameter(game, n) : (values[n] ?? readDefault(n) ?? '')) : show(n);
      })
      .filter((x) => x !== null)
      .join('\n');
  if (options.has('n')) return [...order].sort().map(show).join('\n');
  return [...new Set([...PARAMETERS, ...order])].sort().map(show).join('\n');
}
const readDefault = (n: string) => (PARAMETERS.includes(n) ? (POSTERS_DEFAULTS[n] ?? '') : null);
const POSTERS_DEFAULTS: Record<string, string> = {
  myorigin: '$myhostname',
  mydestination: '$myhostname, localhost.$mydomain, localhost',
  inet_interfaces: 'all',
  inet_protocols: 'all',
  milter_default_action: 'tempfail',
  milter_protocol: '6',
  mynetworks: '127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128',
  alias_maps: 'hash:/etc/aliases',
  alias_database: 'hash:/etc/aliases',
  mailbox_size_limit: '0',
  smtpd_banner: '$myhostname ESMTP $mail_name (Debian/GNU)',
  mail_name: 'Postfix',
  biff: 'yes',
  append_dot_mydomain: 'no',
  readme_directory: 'no',
  compatibility_level: '3.6',
  smtpd_relay_restrictions: 'permit_mynetworks permit_sasl_authenticated defer_unauth_destination',
  maximal_queue_lifetime: '5d',
  queue_run_delay: '300s',
};

// postfix start|stop|reload|status|check|flush : le script de contrôle.
function postfix(game: Shell, args: string[]): string {
  const action = args.find((a) => !a.startsWith('-'));
  const sd = systemd(game);
  const s = sd?.services.postfix;
  if (!action) return game.error('postfix: error: usage: postfix start (or stop, reload, abort, flush, check, status, set-permissions, upgrade-configuration)');
  if (action === 'status') {
    if (s?.state === 'active') return game.error('postfix/postfix-script: the Postfix mail system is running: PID: 1180', 0);
    return game.error('postfix/postfix-script: the Postfix mail system is not running', 1);
  }
  if (game.who !== 'root') return game.error('postfix: fatal: the postfix command is reserved for the superuser');
  if (action === 'check') {
    const { values, unknown } = readMainCf(game.read(MAIN_CF) ?? '');
    for (const n of unknown) game.error(`postconf: warning: ${MAIN_CF}: unused parameter: ${n}=${values[n]}`, 0);
    return '';
  }
  if (!sd || !s) return game.error('postfix: fatal: unknown command');
  if (action === 'reload') {
    if (s.state !== 'active') return game.error('postfix/postfix-script: fatal: the Postfix mail system is not running');
    reload(game, sd, 'postfix');
    return game.error('postfix/postfix-script: refreshing the Postfix mail system', 0);
  }
  if (action === 'start') {
    if (s.state === 'active') return game.error('postfix/postfix-script: fatal: the Postfix mail system is already running');
    start(game, sd, 'postfix');
    return game.error('postfix/postfix-script: starting the Postfix mail system', 0);
  }
  if (action === 'stop') {
    if (s.state !== 'active') return game.error('postfix/postfix-script: fatal: the Postfix mail system is not running');
    stop(game, sd, 'postfix');
    return game.error('postfix/postfix-script: stopping the Postfix mail system', 0);
  }
  if (action === 'flush') {
    empty(game);
    return '';
  }
  return game.error(`postfix: fatal: unknown command: '${action}'. Usage: postfix start (or stop, reload, abort, flush, check, status, set-permissions, upgrade-configuration)`);
}

function postqueue(game: Shell, args: string[]): string {
  if (!mail(game)) return game.error('postqueue: fatal: Queue report unavailable - mail system is down');
  const inWorks = systemd(game)?.services.postfix?.state === 'active';
  if (args.includes('-p')) return inWorks ? showFile(game) : game.error('postqueue: fatal: Queue report unavailable - mail system is down');
  if (args.includes('-f')) {
    if (!inWorks) return game.error('postqueue: fatal: Cannot flush mail queue - mail system is down');
    empty(game);
    return '';
  }
  return game.error('postqueue: fatal: usage: postqueue -f | postqueue -i queueid | postqueue -j | postqueue -p | postqueue -s site');
}

function postsuper(game: Shell, args: string[]): string {
  if (game.who !== 'root') return reserve(game, 'postsuper');
  const c = mail(game);
  const i = args.indexOf('-d');
  if (i < 0 || !args[i + 1]) return game.error('postsuper: fatal: usage: postsuper [-c config_dir] [-d queue_id (delete)] [-h queue_id (hold)] [-H queue_id (un-hold)] [-p (purge temporary files)] [-r queue_id (requeue)] [-s (structure fix)] [-S (structure fix)] [-v (verbose)] [queue...]');
  if (!c) return '';
  const target = args[i + 1];
  const removed = c.file.filter((m) => target === 'ALL' || m.id === target);
  c.file = c.file.filter((m) => !removed.includes(m));
  for (const m of removed) writeLog(game, 'postfix/postsuper', `${m.id}: removed`);
  const lines = removed.map((m) => `postsuper: ${m.id}: removed`);
  if (removed.length) lines.push(`postsuper: Deleted: ${removed.length} message${removed.length > 1 ? 's' : ''}`);
  return game.error(lines.join('\n'), 0);
}

// opendkim-genkey : une paire de clés, NOM.private et NOM.txt (l'enregistrement à publier).
function genkey(game: Shell, args: string[]): string {
  let bits = 2048;
  let domain = 'example.com';
  let directory = '.';
  let selector = 'default';
  let verbose = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const value = () => args[++i] ?? '';
    if (a === '-b' || a === '--bits') bits = Number(value());
    else if (a.startsWith('--bits=')) bits = Number(a.slice(7));
    else if (a === '-d' || a === '--domain') domain = value();
    else if (a.startsWith('--domain=')) domain = a.slice(9);
    else if (a === '-D' || a === '--directory') directory = value();
    else if (a.startsWith('--directory=')) directory = a.slice(12);
    else if (a === '-s' || a === '--selector') selector = value();
    else if (a.startsWith('--selector=')) selector = a.slice(11);
    else if (a === '-v' || a === '--verbose') verbose = true;
    else if (a === '-r' || a === '--restrict') continue;
    else return game.error(`opendkim-genkey: unknown option '${a}'\nUsage: opendkim-genkey [options]`);
  }
  if (!Number.isInteger(bits) || bits < 1024) return game.error(`opendkim-genkey: invalid key size ${bits}`);
  const place = game.resolve(directory);
  if (game.find(place)?.type !== 'dossier') return game.error(`opendkim-genkey: ${directory}: No such file or directory`);
  const c = mail(game);
  const draw = (game.state.dkimKeys = (game.state.dkimKeys ?? 0) + 1);
  const isPrivate = privateKey(`${domain}:${selector}:${bits}:${draw}:${c?.ip ?? ''}`, bits);
  const output: string[] = [];
  if (verbose) output.push('opendkim-genkey: generating private key');
  const error = game.place('opendkim-genkey', `${place}/${selector}.private`, { type: 'fichier', content: isPrivate, lines: true, owner: game.who, group: game.who, mode: 'rw-------' });
  if (error) return game.error(`opendkim-genkey: ${selector}.private: Permission denied`);
  if (verbose) output.push(`opendkim-genkey: private key written to ${selector}.private`, 'opendkim-genkey: extracting public key');
  game.place('opendkim-genkey', `${place}/${selector}.txt`, {
    type: 'fichier',
    content: dkimRecord(selector, domain, publicKey(isPrivate)!),
    lines: true,
    owner: game.who,
    group: game.who,
    mode: 'rw-r--r--',
  });
  if (verbose) output.push(`opendkim-genkey: DNS TXT record written to ${selector}.txt`);
  return output.join('\n');
}

// opendkim-testkey : la clé publiée dans le DNS correspond-elle à la clé privée ?
function testkey(game: Shell, args: string[]): string {
  let domain = '';
  let selector = '';
  let key = '';
  let verbosity = 0;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-d') domain = args[++i] ?? '';
    else if (a === '-s') selector = args[++i] ?? '';
    else if (a === '-k') key = args[++i] ?? '';
    else if (/^-v+$/.test(a)) verbosity += a.length - 1;
    else return game.error(`opendkim-testkey: invalid option -- '${a.replace(/^-+/, '')}'\nusage: opendkim-testkey [options]`);
  }
  const lines: string[] = [];
  const conf = readDkim(game.read(OPENDKIM_CONF) ?? '');
  if (!key && game.find(OPENDKIM_CONF)) {
    if (verbosity >= 3) lines.push(`opendkim-testkey: using default configfile ${OPENDKIM_CONF}`);
    key = conf.key ?? '';
    domain ||= conf.domains[0] ?? '';
    selector ||= conf.selector ?? '';
  }
  if (!domain || !selector) return game.error('opendkim-testkey: selector and domain must be specified');
  const name = `${selector}._domainkey.${domain}`;
  if (verbosity >= 2) lines.push(`opendkim-testkey: checking key '${name}'`);
  // Le résolveur de la machine (le serveur DNS local).
  const d = dns(game);
  const r = d ? query(game, 'primary', name, 'TXT', systemd(game)?.clock ?? 0) : null;
  const record = r?.responses.filter((x) => x.type === 'TXT').map((x) => txtText(x.data))[0];
  if (!record) return game.error([...lines, `opendkim-testkey: '${name}' record not found`].join('\n'));
  const p = tags(record).p;
  if (!p) return game.error([...lines, `opendkim-testkey: '${name}' key revoked`].join('\n'));
  if (key) {
    const n = game.find(key);
    if (!n || n.type !== 'fichier') return game.error([...lines, `opendkim-testkey: ${key}: open(): No such file or directory`].join('\n'));
    if (!game.can(n, 'r')) return game.error([...lines, `opendkim-testkey: ${key}: open(): Permission denied`].join('\n'));
    if (publicKey(game.read(key) ?? '') !== p) return game.error([...lines, 'opendkim-testkey: key data does not match private key'].join('\n'));
  }
  // Sans DNSSEC, opendkim-testkey dit toujours « key not secure » : ce n'est pas une erreur.
  if (verbosity >= 1) lines.push('opendkim-testkey: key not secure', 'opendkim-testkey: key OK');
  return lines.join('\n');
}

export const MAIL: Record<string, Command> = {
  postconf: { section: 1, ownOptions: true, launch: ({ args, game }) => postconf(game, args) },
  postfix: { section: 1, ownOptions: true, launch: ({ args, game }) => postfix(game, args) },
  postqueue: { section: 1, ownOptions: true, launch: ({ args, game }) => postqueue(game, args) },
  mailq: { section: 1, ownOptions: true, launch: ({ game }) => postqueue(game, ['-p']) },
  postsuper: { section: 1, ownOptions: true, launch: ({ args, game }) => postsuper(game, args) },
  'opendkim-genkey': { section: 8, ownOptions: true, launch: ({ args, game }) => genkey(game, args) },
  'opendkim-testkey': { section: 8, ownOptions: true, launch: ({ args, game }) => testkey(game, args) },
};
