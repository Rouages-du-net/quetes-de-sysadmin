// certbot et openssl : les certificats TLS de Let's Encrypt.
//
// certbot (https://eff-certbot.readthedocs.io/en/stable/using.html) garde
// chaque certificat dans /etc/letsencrypt/live/<nom>/ et la façon de le
// renouveler dans /etc/letsencrypt/renewal/<nom>.conf. Avec le module
// webroot, il dépose un fichier « défi » dans le dossier du site
// (<webroot>/.well-known/acme-challenge/) ; l'autorité de certification va
// le chercher en HTTP, sur le port 80 : ici, c'est le nginx simulé qui
// répond (nginx.ts). Les deploy hooks tournent après un renouvellement
// réussi (jamais pendant --dry-run). L'autorité est simulée, sans réseau.
//
// openssl (https://docs.openssl.org/3.5/man1/) : x509 pour lire un
// certificat, s_client pour voir celui que présente un serveur.
//
// Écarts : un seul certificat géré (celui du chapitre) ; les fichiers de
// live/ sont réécrits au lieu d'être des liens vers archive/ ; s_client
// rend la main tout de suite ; le module nginx de certbot ne modifie pas la
// configuration (il sert seulement le défi et recharge nginx).

import type { Shell } from '../shell';
import { reload, systemd, toUtc } from '../systemd';
import { httpRequest } from '../nginx';
import { dateCertbot, dateOpenssl, DURATION, read, pem, subject, type Certificate } from '../tls';
import { checkCertificate } from './network';
import type { Command } from './index';

export const FOR = '/etc/letsencrypt';
const DASHES = '- '.repeat(40).trim();
const DAY = 86_400_000;
const LOG = 'Saving debug log to /var/log/letsencrypt/letsencrypt.log';

// ——— Fichier de renouvellement (format ConfigObj de certbot) ———

export interface Renewal {
  // Les lignes du début (chemins des fichiers) et celles de [renewalparams].
  header: Record<string, string>;
  params: Record<string, string>;
  // [[webroot_map]] : le dossier du défi pour chaque nom.
  map: Record<string, string>;
}

export function readRenewal(text: string): Renewal {
  const r: Renewal = { header: {}, params: {}, map: {} };
  let section: Record<string, string> = r.header;
  for (const rawValue of text.split('\n')) {
    const line = rawValue.trim();
    if (!line || line.startsWith('#')) continue;
    if (line === '[renewalparams]') section = r.params;
    else if (line === '[[webroot_map]]') section = r.map;
    else if (line.startsWith('[')) section = {};
    else {
      const i = line.indexOf('=');
      if (i > 0) section[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return r;
}

export function writeRenewal(r: Renewal): string {
  const lines = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k} = ${v}`);
  return [
    '# renew_before_expiry = 30 days',
    ...lines(r.header),
    '',
    '# Options used in the renewal process',
    '[renewalparams]',
    ...lines(r.params),
    ...(Object.keys(r.map).length ? ['[[webroot_map]]', ...lines(r.map)] : []),
  ].join('\n');
}

// ——— Le certificat géré ———

const files = (name: string) => ({
  conf: `${FOR}/renewal/${name}.conf`,
  cert: `${FOR}/live/${name}/cert.pem`,
  string: `${FOR}/live/${name}/chain.pem`,
  complet: `${FOR}/live/${name}/fullchain.pem`,
  key: `${FOR}/live/${name}/privkey.pem`,
});

/** Le certificat intermédiaire de Let's Encrypt (pour chain.pem). */
export const INTERMEDIATE = pem({
  cn: 'E6',
  names: [],
  issuer: 'C=US, O=Internet Security Research Group, CN=ISRG Root X1',
  serial: 'b0573e9173972770dbb487cb3a452b38',
  start: Date.UTC(2024, 2, 13),
  end: Date.UTC(2027, 2, 12, 23, 59, 59),
});

/** Une clé privée ECDSA (factice), au format PEM. */
export const privateKey = (seed: string) =>
  ['-----BEGIN PRIVATE KEY-----', ...btoa(`quetes-cle:${seed}:`.padEnd(138, '0')).match(/.{1,64}/g)!, '-----END PRIVATE KEY-----'].join('\n');

/** Les fichiers d'un certificat, à poser dans live/<nom>/. */
export function certificateFiles(c: Certificate) {
  const cert = pem(c);
  return { 'cert.pem': cert, 'chain.pem': INTERMEDIATE, 'fullchain.pem': `${cert}\n${INTERMEDIATE}`, 'privkey.pem': privateKey(c.serial) };
}

const now = (game: Shell) => toUtc(systemd(game)?.clock ?? 0);

// Le nom du certificat géré : le seul fichier de renewal/.
function managedCertificate(game: Shell): string | null {
  const n = game.find(`${FOR}/renewal`);
  if (n?.type !== 'dossier') return null;
  return (
    Object.keys(n.children)
      .find((f) => f.endsWith('.conf'))
      ?.replace(/\.conf$/, '') ?? null
  );
}

// ——— Options de la ligne de commande ———

interface Options {
  dryRun: boolean;
  force: boolean;
  webroot: boolean;
  paths: string[];
  domains: string[];
  hook: string | null;
  certName: string | null;
  plugin: 'nginx' | 'standalone' | null;
  unknown: string | null;
}

function parse(args: string[]): Options {
  const o: Options = {
    dryRun: false,
    force: false,
    webroot: false,
    paths: [],
    domains: [],
    hook: null,
    certName: null,
    plugin: null,
    unknown: null,
  };
  for (let i = 0; i < args.length; i++) {
    const [a, egal] =
      args[i].startsWith('--') && args[i].includes('=')
        ? [args[i].slice(0, args[i].indexOf('=')), args[i].slice(args[i].indexOf('=') + 1)]
        : [args[i], undefined];
    const value = () => egal ?? args[++i] ?? '';
    if (a === '--dry-run') o.dryRun = true;
    else if (a === '--force-renewal' || a === '--renew-by-default') o.force = true;
    else if (a === '--webroot') o.webroot = true;
    else if (a === '-w' || a === '--webroot-path') o.paths.push(value().replace(/\/$/, ''));
    else if (a === '-d' || a === '--domains' || a === '--domain') o.domains.push(...value().split(',').filter(Boolean));
    else if (a === '--deploy-hook' || a === '--renew-hook') o.hook = value();
    else if (a === '--cert-name') o.certName = value();
    else if (a === '--nginx') o.plugin = 'nginx';
    else if (a === '--standalone') o.plugin = 'standalone';
    else if (a === '-m' || a === '--email') value();
    // Options sans effet ici (questions, discrétion).
    else if (
      !['-n', '--non-interactive', '--agree-tos', '-q', '--quiet', '--no-random-sleep-on-renew', '--keep-until-expiring', '--keep'].includes(a)
    )
      o.unknown ??= a;
  }
  return o;
}

// ——— Le défi HTTP-01 ———

// Le jeton du défi, comme ceux de Let's Encrypt (base64url, 43 caractères).
const token = (seed: string) => btoa(seed.padEnd(32, '-')).replace(/[+/=]/g, '').slice(0, 43).padEnd(43, 'Q');

/**
 * L'autorité vient chercher le défi de chaque nom, sur le port 80. Renvoie
 * les erreurs au format de certbot (vide : tout est bon). `effets` : sinon,
 * on ne fait que vérifier (pas de fichier déposé, rien d'écrit).
 */
export function challenges(game: Shell, r: Renewal, names: string[], trial: number, trace = true): string[] {
  const errors: string[] = [];
  // Le module nginx de certbot sert lui-même le défi, quel que soit le dossier du site.
  if (r.params.authenticator === 'nginx') return game.find('/usr/lib/python3/dist-packages/certbot_nginx') ? [] : ['plugin'];
  for (const name of names) {
    const directory = (r.map[name] ?? r.params.webroot_path ?? '').replace(/,$/, '').replace(/\/$/, '');
    const place = game.find(directory);
    if (!directory || place?.type !== 'dossier') {
      errors.push(`webroot:${directory}`);
      continue;
    }
    const t = token(`${name}-${trial}`);
    const path = `/.well-known/acme-challenge/${t}`;
    // certbot (root) crée les dossiers et dépose le fichier, lisible par tous.
    const before = game.who;
    game.who = 'root';
    let challengePlace = directory;
    for (const p of ['.well-known', 'acme-challenge']) {
      challengePlace = `${challengePlace}/${p}`;
      if (!game.exists(challengePlace)) game.place('certbot', challengePlace, { type: 'dossier', children: {}, owner: 'root' });
    }
    game.place('certbot', directory + path, { type: 'fichier', content: `${t}.cle-du-compte`, owner: 'root', lines: true });
    const response = httpRequest(game, name, path, 80, trace);
    game.erase(directory + path);
    game.who = before;
    if (!response) errors.push(`  Domain: ${name}\n  Type:   connection\n  Detail: 192.0.2.11: Fetching http://${name}${path}: Connection refused`);
    else if (response.code !== 200 || response.body !== `${t}.cle-du-compte`)
      errors.push(`  Domain: ${name}\n  Type:   unauthorized\n  Detail: 192.0.2.11: Invalid response from http://${name}${path}: ${response.code}`);
  }
  return errors;
}

/** Le renouvellement automatique (celui du timer) réussirait-il, avec la configuration actuelle ? */
export function possibleRenewal(game: Shell): boolean {
  const name = managedCertificate(game);
  if (!name) return false;
  const r = readRenewal(game.read(files(name).conf) ?? '');
  const c = read(game.read(files(name).complet));
  return !!c && challenges(game, r, c.names, 0, false).length === 0;
}

// Ce qui relance nginx dans une commande ou un script.
const RELOAD = /(systemctl\s+(reload|restart|reload-or-restart)\s+nginx|nginx\s+-s\s+reload|service\s+nginx\s+(reload|restart))/;

/** Après un renouvellement, nginx sera-t-il rechargé tout seul (deploy hook, ou module nginx) ? */
export function automaticReload(game: Shell): boolean {
  const name = managedCertificate(game);
  if (!name) return false;
  const r = readRenewal(game.read(files(name).conf) ?? '');
  if (r.params.installer === 'nginx' || RELOAD.test(r.params.renew_hook ?? '')) return true;
  return deploymentScripts(game).some((s) => s.executable && RELOAD.test(s.content));
}

function deploymentScripts(game: Shell) {
  const directory = `${FOR}/renewal-hooks/deploy`;
  const n = game.find(directory);
  if (n?.type !== 'dossier') return [];
  return Object.keys(n.children)
    .sort()
    .map((name) => {
      const f = n.children[name];
      return {
        path: `${directory}/${name}`,
        executable: f.type === 'fichier' && (f.mode ?? 'rw-r--r--')[2] === 'x',
        content: game.read(`${directory}/${name}`) ?? '',
      };
    });
}

// Lance les deploy hooks (en root, comme certbot), et le rechargement du module nginx.
function deployer(game: Shell, r: Renewal, sec: boolean): string[] {
  const lines: string[] = [];
  const execute = (command: string) => {
    const before = game.who;
    game.who = 'root';
    try {
      const output = game.runTask(command);
      if (output) lines.push(`Output from deploy-hook command ${command.split(/\s+/)[0]}:`, output);
    } finally {
      game.who = before;
    }
  };
  for (const s of deploymentScripts(game)) {
    if (!s.executable) lines.push(`Skipping deploy-hook '${s.path}' as it is not executable.`);
    else if (sec) lines.push(`Dry run: skipping deploy hook command: ${s.path}`);
    else {
      lines.push(`Running deploy-hook command: ${s.path}`);
      for (const l of s.content.split('\n').map((x) => x.trim())) if (l && !l.startsWith('#')) execute(l);
    }
  }
  if (r.params.renew_hook) {
    if (sec) lines.push(`Dry run: skipping deploy hook command: ${r.params.renew_hook}`);
    else {
      lines.push(`Running deploy-hook command: ${r.params.renew_hook}`);
      execute(r.params.renew_hook);
    }
  }
  const sd = systemd(game);
  if (!sec && r.params.installer === 'nginx' && sd?.services.nginx?.state === 'active') reload(game, sd, 'nginx');
  return lines;
}

// Un nouveau certificat de 90 jours (Let's Encrypt antidate d'une heure).
function issue(game: Shell, name: string, old: Certificate) {
  const start = Math.floor((now(game) - 3600_000) / 1000) * 1000;
  const n = (game.state.certbotIssued = (game.state.certbotIssued ?? 0) + 1);
  // Un nouveau numéro de série (hexadécimal, tiré du précédent).
  const serial = [...`${old.serial}${n}`].reduce((h, car) => Math.imul(h ^ car.charCodeAt(0), 0x01000193) >>> 0, 0x811c9dc5);
  const hexSerial = Array.from({ length: 5 }, (_, i) => ((Math.imul(serial, i + 7) >>> 0) ^ (serial >>> i)).toString(16).padStart(8, '0'))
    .join('')
    .slice(0, 36);
  const c: Certificate = { ...old, serial: `0${hexSerial.slice(1)}`, start, end: start + DURATION - 1000 };
  const f = files(name);
  const contents = certificateFiles(c);
  const before = game.who;
  game.who = 'root';
  for (const [file, text] of Object.entries(contents)) {
    const path = { 'cert.pem': f.cert, 'chain.pem': f.string, 'fullchain.pem': f.complet, 'privkey.pem': f.key }[file]!;
    const oldNode = game.find(path);
    game.place('certbot', path, {
      type: 'fichier',
      content: text,
      lines: true,
      owner: 'root',
      mode: oldNode?.mode ?? (file === 'privkey.pem' ? 'rw-------' : 'rw-r--r--'),
    });
  }
  game.who = before;
  return c;
}

const namesList = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]);

/**
 * Un renouvellement (renew, certonly, reconfigure, ou le timer) : renvoie la
 * sortie, et si c'est réussi. `cli` : les options de la ligne de commande,
 * qui remplacent celles du fichier (et y sont enregistrées si ça réussit).
 */
function renew(
  game: Shell,
  name: string,
  o: Options,
  mode: 'renew' | 'certonly' | 'reconfigure',
): { lines: string[]; ok: boolean; error?: string } {
  const f = files(name);
  const old = read(game.read(f.complet));
  const text = game.read(f.conf);
  if (!old || text === null) return { lines: [], ok: false, error: `Renewal configuration file ${f.conf} is broken.` };
  const r = readRenewal(text);
  // Les options données ici remplacent celles du fichier.
  const fresh: Renewal = { header: { ...r.header }, params: { ...r.params }, map: { ...r.map } };
  if (o.plugin === 'nginx') {
    fresh.params.authenticator = 'nginx';
    fresh.params.installer = 'nginx';
    fresh.map = {};
    delete fresh.params.webroot_path;
  } else if (o.paths.length) {
    fresh.params.authenticator = 'webroot';
    fresh.params.webroot_path = `${o.paths.join(', ')},`;
    // -w s'applique aux -d qui le suivent ; sans -d, à tous les noms.
    fresh.map = Object.fromEntries(old.names.map((n) => [n, o.paths.at(-1)!]));
  }
  if (o.hook !== null) fresh.params.renew_hook = o.hook;
  const due = old.end - now(game) < 30 * DAY;
  const lines: string[] = [];
  if (mode === 'renew') lines.push(DASHES, `Processing ${f.conf}`, DASHES);
  if (!due && !o.force && !o.dryRun && mode !== 'reconfigure') {
    if (mode === 'certonly') return { lines: ['Certificate not yet due for renewal; no action taken.'], ok: true };
    lines.push(
      `Certificate not yet due for renewal`,
      '',
      DASHES,
      'The following certificates are not due for renewal yet:',
      `  ${f.complet} expires on ${dateCertbot(old.end).slice(0, 10)} (skipped)`,
      'No renewals were attempted.',
      DASHES,
    );
    return { lines, ok: true };
  }
  const sec = o.dryRun || mode === 'reconfigure';
  lines.push(`${sec ? 'Simulating renewal of' : 'Renewing'} an existing certificate for ${namesList(old.names)}`);
  const errors = challenges(game, fresh, old.names, (game.state.certbotAttempts = (game.state.certbotAttempts ?? 0) + 1));
  if (errors.includes('plugin')) return { lines: [], ok: false, error: 'The requested nginx plugin does not appear to be installed' };
  const absent = errors.find((e) => e.startsWith('webroot:'));
  if (absent) return { lines, ok: false, error: `--webroot-path ${absent.slice(8) || '(none)'} does not exist or is not a directory` };
  if (errors.length) {
    game.state.certbotChallengeFailed = true;
    lines.push(
      '',
      `Certbot failed to authenticate some domains (authenticator: ${fresh.params.authenticator}). The Certificate Authority reported these problems:`,
      ...errors,
      '',
      'Hint: The Certificate Authority failed to download the temporary challenge files created by Certbot. Ensure that the listed domains serve their content from the provided --webroot-path/-w and that files created there can be downloaded from the internet.',
      '',
    );
    if (mode === 'renew')
      lines.push(
        `Failed to renew certificate ${name} with error: Some challenges have failed.`,
        '',
        DASHES,
        `All ${sec ? 'simulated renewals' : 'renewals'} failed. The following certificates could not be renewed:`,
        `  ${f.complet} (failure)`,
        DASHES,
        '1 renew failure(s), 0 parse failure(s)',
      );
    else lines.push('Some challenges have failed.');
    lines.push(
      'Ask for help or search for solutions at https://community.letsencrypt.org. See the logfile /var/log/letsencrypt/letsencrypt.log or re-run Certbot with -v for more details.',
    );
    return { lines, ok: false };
  }
  if (!sec) issue(game, name, old);
  // Réussi : certbot réécrit le fichier de renouvellement avec les options utilisées.
  if (!o.dryRun) {
    const before = game.who;
    game.who = 'root';
    const n = game.find(f.conf);
    if (n?.type === 'fichier') n.content = writeRenewal(fresh);
    game.who = before;
  }
  const hooks = deployer(game, fresh, sec);
  if (mode === 'reconfigure') lines.push('', ...hooks, 'Successfully updated configuration.', 'Changes will apply when the certificate renews.');
  else if (mode === 'certonly' && !sec) {
    const c = read(game.read(f.complet))!;
    lines.push(
      '',
      'Successfully received certificate.',
      `Certificate is saved at: ${f.complet}`,
      `Key is saved at:         ${f.key}`,
      `This certificate expires on ${dateCertbot(c.end).slice(0, 10)}.`,
      'These files will be updated when the certificate renews.',
      'Certbot has set up a scheduled task to automatically renew this certificate in the background.',
      ...hooks,
    );
  } else if (mode === 'certonly') lines.push('The dry run was successful.', ...hooks);
  else
    lines.push(
      ...hooks,
      '',
      DASHES,
      `Congratulations, all ${sec ? 'simulated renewals' : 'renewals'} succeeded: `,
      `  ${f.complet} (success)`,
      DASHES,
    );
  return { lines, ok: true };
}

/** Pour systemd : le service certbot (lancé par certbot.timer) renouvelle ce qui doit l'être. */
export function serviceCertbot(game: Shell): string[] | null {
  const name = managedCertificate(game);
  if (!name) return null;
  const before = game.who;
  game.who = 'root';
  try {
    const { lines, ok, error } = renew(game, name, parse([]), 'renew');
    if (ok) return null;
    return [error ?? lines.find((l) => l.startsWith('Failed to renew')) ?? 'Some challenges have failed.'];
  } finally {
    game.who = before;
  }
}

export const CERTBOT: Record<string, Command> = {
  certbot: {
    ownOptions: true,
    launch: ({ args, game }) => {
      if (!game.find('/usr/bin/certbot')) return game.error(game.t('command-missing', { command: 'certbot' }));
      const [action = 'run', ...rest] = args[0]?.startsWith('-') ? ['run', ...args] : args;
      const o = parse(rest);
      if (o.unknown)
        return game.error(
          `usage: \n  certbot [SUBCOMMAND] [options] [-d DOMAIN] [-d DOMAIN] ...\n\ncertbot: error: unrecognized arguments: ${o.unknown}`,
        );
      if (game.who !== 'root')
        return game.error(
          "The following error was encountered:\n[Errno 13] Permission denied: '/var/log/letsencrypt/.certbot.lock'\nEither run as root, or set --config-dir, --work-dir, and --logs-dir to writeable paths.",
        );
      const name = managedCertificate(game);
      if (action === 'certificates') {
        if (!name) return `${LOG}\nNo certificates found.`;
        const f = files(name);
        const c = read(game.read(f.complet));
        if (!c) return game.error(`${LOG}\nRenewal configuration file ${f.conf} produced an unexpected error: the certificate cannot be read.`);
        const rest = c.end - now(game);
        const validity = rest <= 0 ? 'INVALID: EXPIRED' : `VALID: ${Math.floor(rest / DAY)} day${Math.floor(rest / DAY) === 1 ? '' : 's'}`;
        return [
          LOG,
          '',
          DASHES,
          'Found the following certs:',
          `  Certificate Name: ${name}`,
          `    Serial Number: ${c.serial.replace(/^0+/, '')}`,
          '    Key Type: ECDSA',
          `    Domains: ${c.names.join(' ')}`,
          `    Expiry Date: ${dateCertbot(c.end)} (${validity})`,
          `    Certificate Path: ${f.complet}`,
          `    Private Key Path: ${f.key}`,
          DASHES,
        ].join('\n');
      }
      if (action === 'renew' || action === 'certonly' || action === 'reconfigure') {
        if (o.plugin === 'standalone')
          return game.error(
            `${LOG}\nCould not bind TCP port 80 because it is already in use by another process on this system (such as a web server). Please stop the program in question and then try again.`,
          );
        if (!name) return game.error(`${LOG}\n${game.t('certbot-none-certificate')}`);
        if (action === 'certonly') {
          if (!o.plugin && !o.webroot && !o.paths.length) return game.error(`${LOG}\n${game.t('certbot-authenticator')}`);
          if (o.webroot && !o.paths.length) return game.error(`${LOG}\n${game.t('certbot-webroot-without-path')}`);
          const c = read(game.read(files(name).complet));
          const wanted = [...new Set(o.domains.map((d) => d.toLowerCase()))].sort();
          if (!wanted.length) return game.error(`${LOG}\n${game.t('certbot-without-domain')}`);
          if (c && wanted.join(' ') !== [...c.names].sort().join(' '))
            return game.error(`${LOG}\n${game.t('certbot-other-domains', { names: c.names.join(', ') })}`);
        }
        if (action === 'reconfigure' && o.certName && o.certName !== name)
          return game.error(`${LOG}\nThe certificate name ${o.certName} was not found.`);
        const { lines, ok, error } = renew(game, name, o, action);
        if (error) return game.error([LOG, ...lines, error].join('\n'));
        const output = [LOG, '', ...lines].join('\n');
        return ok ? output : game.error(output);
      }
      return game.error(game.t('certbot-usage'));
    },
  },

  openssl: {
    ownOptions: true,
    launch: ({ args, input, game }) => {
      const [under, ...rest] = args;
      if (under === 'version') return 'OpenSSL 3.5.1 1 Jul 2025 (Library: OpenSSL 3.5.1 1 Jul 2025)';
      if (under === 'x509') {
        let file: string | null = null;
        let endIn: number | null = null;
        const requests: string[] = [];
        let withoutText = false;
        for (let i = 0; i < rest.length; i++) {
          const a = rest[i];
          if (a === '-in') file = rest[++i] ?? '';
          else if (a === '-checkend') endIn = Number(rest[++i]);
          else if (a === '-noout') withoutText = true;
          else if (['-dates', '-enddate', '-startdate', '-subject', '-issuer', '-serial', '-ext'].includes(a)) {
            requests.push(a);
            if (a === '-ext') i++;
          } else return game.error(`x509: Unknown option or message digest: ${a.replace(/^-/, '')}\nx509: Use -help for summary.`);
        }
        let text = input;
        if (file !== null) {
          const n = game.find(file);
          if (!n || n.type !== 'fichier')
            return game.error(`Could not open file or uri for loading certificate from ${file}: No such file or directory`);
          if (!game.traverses(file) || !game.can(n, 'r'))
            return game.error(`Could not open file or uri for loading certificate from ${file}: Permission denied`);
          text = game.read(file);
        }
        const c = read(text);
        if (!c) return game.error('Could not find certificate from <stdin>\nUnable to load certificate'.replace('<stdin>', file ?? '<stdin>'));
        const lines: string[] = [];
        for (const d of requests) {
          if (d === '-dates' || d === '-startdate') lines.push(`notBefore=${dateOpenssl(c.start)}`);
          if (d === '-dates' || d === '-enddate') lines.push(`notAfter=${dateOpenssl(c.end)}`);
          if (d === '-subject') lines.push(`subject=${subject(c)}`);
          if (d === '-issuer') lines.push(`issuer=${c.issuer}`);
          if (d === '-serial') lines.push(`serial=${c.serial.toUpperCase()}`);
          if (d === '-ext') lines.push('X509v3 Subject Alternative Name: ', `    ${c.names.map((n) => `DNS:${n}`).join(', ')}`);
        }
        if (endIn !== null) {
          const expires = c.end < now(game) + endIn * 1000;
          lines.push(expires ? 'Certificate will expire' : 'Certificate will not expire');
        }
        if (!withoutText) lines.push(pem(c));
        return lines.filter((l) => l !== '').join('\n');
      }
      if (under === 's_client') {
        let target = '';
        let sni: string | null = null;
        for (let i = 0; i < rest.length; i++) {
          if (rest[i] === '-connect') target = rest[++i] ?? '';
          else if (rest[i] === '-servername') sni = rest[++i] ?? '';
          else if (!['-showcerts', '-quiet', '-brief'].includes(rest[i]))
            return game.error(`s_client: Unknown option: ${rest[i]}\ns_client: Use -help for summary.`);
        }
        const [host, port = '443'] = target.split(':');
        if (!host) return game.error('s_client: -connect host:port is required');
        const localNames = ['localhost', '127.0.0.1', ...(game.state.nginx?.names ?? [])];
        if (!localNames.includes(host.toLowerCase())) return game.error(`BIO_lookup_ex: ${host}: Name or service not known\nconnect:errno=0`);
        const r = httpRequest(game, sni ?? host, '/', Number(port));
        if (!r?.certificate) return game.error(`connect to ${host} port ${port} failed: Connection refused\nconnect:errno=111`);
        const c = read(r.certificate)!;
        const problem = checkCertificate(game, r.certificate, sni ?? host);
        const code = !problem
          ? '0 (ok)'
          : problem.includes('expired')
            ? '10 (certificate has expired)'
            : problem.includes('not yet')
              ? '9 (certificate is not yet valid)'
              : '62 (hostname mismatch)';
        return [
          'CONNECTED(00000003)',
          `depth=0 ${subject(c)}`,
          ...(problem?.includes('expired') ? ['verify error:num=10:certificate has expired', `notAfter=${dateOpenssl(c.end)}`] : []),
          'verify return:1',
          '---',
          'Certificate chain',
          ` 0 s:${subject(c)}`,
          `   i:${c.issuer}`,
          '   a:PKEY: id-ecPublicKey, 256 (bit); sigalg: ecdsa-with-SHA384',
          `   v:NotBefore: ${dateOpenssl(c.start)}; NotAfter: ${dateOpenssl(c.end)}`,
          '---',
          'Server certificate',
          pem(c),
          `subject=${subject(c)}`,
          `issuer=${c.issuer}`,
          '---',
          'SSL handshake has read 2563 bytes and written 404 bytes',
          `Verify return code: ${code}`,
          '---',
          'DONE',
        ].join('\n');
      }
      if (!under) return game.error(game.t('openssl-usage'));
      return game.error(`Invalid command '${under}'; type "help" for a list.`);
    },
  },
};

// Pour les chapitres : le certificat présenté par nginx pour ce nom est-il bon maintenant ?
export const goodServedCertificate = (game: Shell, name: string) => {
  const r = httpRequest(game, name, '/', 443, false);
  return !!r?.certificate && checkCertificate(game, r.certificate, name) === null;
};
