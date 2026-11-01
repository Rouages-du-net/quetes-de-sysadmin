// Histoire « La Rustine » — chapitre « Le cadenas » : Caddy, pour comparer
// avec nginx et certbot. L'atelier vélo associatif a un petit serveur neuf ;
// Inès y a installé Caddy « parce qu'il fait le HTTPS tout seul »… mais le
// site n'est servi qu'en HTTP : son Caddyfile commence par :80 (le modèle du
// paquet), et une adresse sans nom ne reçoit pas de certificat. Une fois le
// nom écrit, Caddy demande un certificat à Let's Encrypt, qui n'arrive pas
// à joindre la machine : le pare-feu ne laisse passer que ssh. Enfin, les
// affiches portent www.cycles.example.
// Commandes : systemctl status caddy, journalctl -u caddy, le Caddyfile,
// caddy validate, caddy fmt, systemctl reload caddy (ou caddy reload), ufw,
// curl -I, openssl x509.
// Objectif vérifié sur l'état : vu d'internet, https://cycles.example sert
// le site avec un certificat valable, http://cycles.example renvoie vers
// HTTPS, et https://www.cycles.example sert le site ou y renvoie ; Caddy
// tourne et démarrera avec la machine.
// Sources : https://caddyserver.com/docs/automatic-https,
// https://caddyserver.com/docs/caddyfile/concepts#addresses,
// https://caddyserver.com/docs/caddyfile/directives/redir,
// https://caddyserver.com/docs/running#linux-service,
// https://letsencrypt.org/docs/challenge-types/

import { d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd, start, systemd } from '../systemd';
import { stopCaddy, certificateFor, loadCaddy, caddyState, managedNames, PID, retry, caddyRequest, checkCaddy, type CaddyState, type CaddyResponse } from '../caddy';
import type { Firewall } from '../firewall';
import type { Listening } from '../commands/ss';

const M = '/home/you';
export const SITE = 'cycles.example';
export const WWW = `www.${SITE}`;
export const IP = '203.0.113.40';

const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    caddy: { uid: 999, group: 'caddy', home: '/var/lib/caddy', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    ines: { uid: 1001, group: 'ines' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you', 'ines'] },
    caddy: { gid: 999, members: [] },
    you: { gid: 1000, members: [] },
    ines: { gid: 1001, members: [] },
  },
});

// Le Caddyfile du paquet, où Inès a seulement changé le dossier du site.
export const CADDYFILE_INES = `# The Caddyfile is an easy way to configure your Caddy web server.
#
# Unless the file starts with a global options block, the first
# uncommented line is always the address of your site.
#
# To use your own domain name (with automatic HTTPS), first make
# sure your domain's A/AAAA DNS records are properly pointed to
# this machine's public IP, then replace ":80" below with your
# domain name.

:80 {
	# Set this path to your site's directory.
	root * /var/www/cycles

	# Enable the static file server.
	file_server

	# Another common task is to set up a reverse proxy:
	# reverse_proxy localhost:8080

	# Or serve a PHP site through php-fpm:
	# php_fastcgi localhost:9000
}

# Refer to the Caddy docs for more information:
# https://caddyserver.com/docs/caddyfile`;

const CADDY_WELCOME = `<!DOCTYPE html>
<html>
<head>
<title>Caddy works!</title>
</head>
<body>
<h1>Caddy works!</h1>
<p>This page indicates that Caddy is running. Customize this page by editing /usr/share/caddy/index.html, or edit your Caddyfile to serve your own site.</p>
</body>
</html>`;

// La machine : SSH, et Caddy (son API d'administration, et le port 80 du site :80).
const LISTENING: Listening[] = [
  { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 604 },
  { proto: 'tcp', address: '[::]', port: 22, process: 'sshd', pid: 604 },
];

const START = Date.UTC(2027, 3, 12, 18, 5, 0);
const NOW = Date.UTC(2027, 3, 13, 9, 40, 0);

const sd = (j: Game) => systemd(j)!;
const seen = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));
const curl = (j: Game) => j.last.commands.some((c) => c[0] === 'curl');
const site = (j: Game) => j.t('padlock-site');
const response = (r: CaddyResponse | null) => (r && !('tls' in r) ? r : null);
const place = (r: ReturnType<typeof response>) => r?.headers.find((e) => /^location: /i.test(e))?.replace(/^location: /i, '') ?? '';
const redirects = (r: ReturnType<typeof response>) => !!r && r.code >= 300 && r.code < 400 && /^https:\/\/cycles\.example(\/|$)/.test(place(r));

// Vu d'internet (le pare-feu compte), comme un visiteur.
const visit = (j: Game, name: string, port: number) => response(caddyRequest(j, name, '/', port, true));
export const servedHttps = (j: Game) => visit(j, SITE, 443)?.code === 200 && visit(j, SITE, 443)!.body === site(j);
export const redirectsHttp = (j: Game) => redirects(visit(j, SITE, 80));
export const servedWww = (j: Game) => {
  const r = visit(j, WWW, 443);
  return (r?.code === 200 && r.body === site(j)) || redirects(r);
};
const runningCaddy = (j: Game) => sd(j).services.caddy.state === 'active' && sd(j).services.caddy.active;
const load = (j: Game) => caddyState(j)?.load ?? null;

export const padlock: Chapter = {
  id: 'padlock',
  number: 1,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'find',
    'cp',
    'mv',
    'nano',
    'sudo',
    'systemctl',
    'journalctl',
    'curl',
    'ss',
    'ps',
    'ufw',
    'caddy',
    'openssl',
    'id',
    'whoami',
  ],
  home: M,
  welcome: 'message_from_ines.txt',
  names: true,
  final: 'end',
  steps: ['address', 'firewall', 'certificate', 'end'],
  password: 'spokes-2027',
  accounts,
  state: () => ({
    listening: LISTENING.map((e) => ({ ...e })),
    ufw: {
      enabled: true,
      incoming: 'deny',
      outgoing: 'allow',
      rules: [{ action: 'allow', to: 'OpenSSH', ports: [22], forEachOf: null }],
    } satisfies Firewall,
    systemd: newSystemd('patch', START, START, {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd' },
      ufw: { description: 'Uncomplicated firewall', active: true, executable: 'ufw', activeRest: true },
      caddy: {
        description: 'Caddy',
        state: 'inactive',
        active: true,
        executable: 'caddy',
        process: [{ pid: PID, user: 'caddy', cpu: 0.1, mem: 1.2, command: '/usr/bin/caddy run --environ --config /etc/caddy/Caddyfile' }],
        check: checkCaddy,
        load: loadCaddy,
        stop: stopCaddy,
        checkToReload: true,
      },
    }),
    process: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 604, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
    ],
    // Le DNS de cycles.example et de www.cycles.example mène déjà ici.
    caddy: {
      load: null,
      names: ['patch', SITE, WWW, IP],
      ip: IP,
      dns: { [SITE]: IP, [WWW]: IP },
      waiting: [],
      attempts: {},
    } satisfies CaddyState,
  }),
  initialise: (j) => {
    // Le service a démarré avec le Caddyfile d'Inès, hier soir.
    start(j, sd(j), 'caddy', true);
    sd(j).clock = NOW;
  },
  beforeCommand: (j) => retry(j),
  createWorld: (t) => {
    const root = { owner: 'root' };
    const directory = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    const caddy = { owner: 'caddy', group: 'caddy', mode: 'rwx------' };
    return directory({
      etc: directory({
        ...accountsFiles(),
        hostname: file('patch'),
        caddy: directory({ Caddyfile: file(CADDYFILE_INES) }),
      }),
      home: directory({
        you: d({ 'message_from_ines.txt': f(t('padlock-message-ines')) }),
        ines: directory({}, { owner: 'ines', mode: 'rwx------' }),
      }),
      usr: directory({
        bin: directory({ caddy: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 41_984_160 }) }),
        share: directory({ caddy: directory({ 'index.html': file(CADDY_WELCOME) }) }),
      }),
      var: directory({
        www: directory({ cycles: directory({ 'index.html': file(t('padlock-site'), { owner: 'ines' }) }, { owner: 'ines' }) }),
        lib: directory({
          caddy: directory(
            {
              '.local': directory({ share: directory({ caddy: directory({}, caddy) }, caddy) }, caddy),
              '.config': directory({ caddy: directory({}, caddy) }, caddy),
            },
            { owner: 'caddy', group: 'caddy', mode: 'rwxr-xr-x' },
          ),
        }),
      }),
    });
  },
  events: [
    {
      id: 'http-only',
      condition: (j) => seen(j, 'no automatic HTTPS will be applied') || (curl(j) && seen(j, 'port 443') && seen(j, "Couldn't connect")),
      message: (j) => j.t('padlock-event-http-only'),
    },
    {
      id: 'schema-http',
      condition: (j) => !!load(j)?.sites.some((s) => s.addresses.some((a) => a.host === SITE && a.schema === 'http')),
      message: (j) => j.t('padlock-event-schema-http'),
    },
    { id: 'address', condition: (j) => !!load(j) && managedNames(load(j)!).includes(SITE), message: (j) => j.t('padlock-event-address') },
    { id: 'firewall', condition: (j) => seen(j, 'Timeout during connect (likely firewall problem)'), message: (j) => j.t('padlock-event-firewall') },
    { id: 'alert', condition: (j) => curl(j) && seen(j, 'tlsv1 alert internal error'), message: (j) => j.t('padlock-event-alert') },
    { id: 'format', condition: (j) => seen(j, 'Caddyfile input is not formatted'), message: (j) => j.t('padlock-event-format') },
    { id: 'certificate', condition: (j) => !!certificateFor(j, SITE) && servedHttps(j), message: (j) => j.t('padlock-event-certificate') },
    {
      id: 'end',
      condition: (j) => runningCaddy(j) && servedHttps(j) && redirectsHttp(j) && servedWww(j),
      message: (j) => j.t('padlock-event-end'),
    },
  ],
};
