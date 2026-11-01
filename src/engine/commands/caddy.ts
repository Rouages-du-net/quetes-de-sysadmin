// La commande caddy (https://caddyserver.com/docs/command-line) : version,
// validate, adapt, fmt, reload, run, start, stop. Les sous-commandes qui lisent
// une configuration prennent --config (sinon le Caddyfile du dossier courant).
// reload passe par l'API d'administration (localhost:2019) du Caddy qui
// tourne : le service, sans besoin d'être root. Les messages de la console
// suivent le format de zap (date, niveau, message, champs JSON).
// Écarts : run et start, quand le service est arrêté, le démarrent (au lieu de
// lancer un Caddy à part) ; adapt donne une configuration JSON simplifiée.

import type { Command } from './index';
import type { Shell } from '../shell';
import { stop, start, systemd } from '../systemd';
import { CADDYFILE, loadCaddy, formatValue, readConfigCaddy, note as logCaddy, VERSION, toJson, type ConfigCaddy } from '../caddy';

const USAGE = `Caddy is an extensible server platform written in Go.

At its core, Caddy merely manages configuration. Modules are plugged
in statically at compile-time to provide useful functionality. Caddy's
standard distribution includes common modules to serve HTTP, TLS,
and PKI applications, including the automation of certificates.

To run Caddy, use:

	- 'caddy run' to run Caddy in the foreground (recommended).
	- 'caddy start' to start Caddy in the background; only do this
	  if you will be keeping the terminal window open until you run
	  'caddy stop' to close the server.

When Caddy is started, it opens a locally-bound administrative socket
to which configuration can be POSTed via a restful HTTP API (see
https://caddyserver.com/docs/api).

Caddy's native configuration format is JSON. However, config adapters
can be used to convert other config formats to JSON when Caddy receives
its configuration. The Caddyfile is a built-in config adapter that is
popular for hand-written configurations due to its straightforward
syntax (see https://caddyserver.com/docs/caddyfile). Many third-party
adapters are available (see https://caddyserver.com/docs/config-adapters).
Use 'caddy adapt' to see how a config translates to JSON.

For convenience, the CLI can act as an HTTP client to give Caddy its
initial configuration for you. If a file named Caddyfile is in the
current working directory, it will do this automatically. Otherwise,
you can use the --config flag to specify the path to a config file.

Some special-purpose subcommands build and load a configuration file
for you directly from command line input; for example:

	- caddy file-server
	- caddy reverse-proxy
	- caddy respond

These commands disable the administration endpoint because their
configuration is specified solely on the command line.

In general, the most common way to run Caddy is simply:

	$ caddy run

Or, with a configuration file:

	$ caddy run --config caddy.json

If running interactively in a terminal, running Caddy in the
background may be more convenient:

	$ caddy start
	...
	$ caddy stop

This allows you to run other commands while Caddy stays running.
Be sure to stop Caddy before you close the terminal!

Depending on the system, Caddy may need permission to bind to low
ports. One way to do this on Linux is to use setcap:

	$ sudo setcap cap_net_bind_service=+ep $(which caddy)

Remember to run that command again after replacing the binary.

See the Caddy website for tutorials, configuration structure,
syntax, and module documentation: https://caddyserver.com/docs/

Custom Caddy builds are available on the Caddy download page at:
https://caddyserver.com/download

The xcaddy command can be used to build Caddy from source with or
without additional plugins: https://github.com/caddyserver/xcaddy

Where possible, Caddy should be installed using officially-supported
package installers: https://caddyserver.com/docs/install

Instructions for running Caddy in production are also available:
https://caddyserver.com/docs/running

Usage:
  caddy [command]

Examples:
  $ caddy run
  $ caddy run --config caddy.json
  $ caddy reload --config caddy.json
  $ caddy stop

Available Commands:
  adapt          Adapts a configuration to Caddy's native JSON
  fmt            Formats a Caddyfile
  help           Help about any command
  reload         Changes the config of the running Caddy instance
  run            Starts the Caddy process and blocks indefinitely
  start          Starts the Caddy process in the background and then returns
  stop           Gracefully stops a started Caddy process
  validate       Tests whether a configuration file is valid
  version        Prints the version

Flags:
  -h, --help      help for caddy
  -v, --version   version for caddy

Use "caddy [command] --help" for more information about a command.

Full documentation is available at:
https://caddyserver.com/docs/command-line`;

const UNDER_COMMANDS = ['adapt', 'fmt', 'help', 'reload', 'run', 'start', 'stop', 'validate', 'version'];

// « 2026/11/20 09:31:02.123	INFO	message	{"champ": "valeur"} », comme la console de zap.
function consoleLine(game: Shell, level: string, msg: string, fields?: Record<string, unknown>): string {
  const d = new Date(systemd(game)?.clock ?? 0).toISOString();
  const when = `${d.slice(0, 10).replaceAll('-', '/')} ${d.slice(11, 23)}`;
  const next = fields ? `\t${JSON.stringify(fields).replace(/":/g, '": ').replace(/,"/g, ', "')}` : '';
  return `${when}\t${level}\t${msg}${next}`;
}

interface Options {
  config: string | null;
  adapter: string | null;
  pretty: boolean;
  overwrite: boolean;
  force: boolean;
  diff: boolean;
  files: string[];
}

function readOptions(game: Shell, under: string, args: string[]): Options | string {
  const o: Options = { config: null, adapter: null, pretty: false, overwrite: false, force: false, diff: false, files: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const [name, value] = a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, null];
    const next = () => value ?? args[++i] ?? null;
    if (name === '--config' || name === '-c') o.config = next();
    else if (name === '--adapter' || name === '-a') o.adapter = next();
    else if (name === '--pretty' || name === '-p') o.pretty = true;
    else if (name === '--overwrite' || name === '-w') o.overwrite = true;
    else if (name === '--force' || name === '-f') o.force = true;
    else if (name === '--diff' || name === '-d') o.diff = true;
    else if (['--environ', '-e', '--validate', '--resume', '--watch', '-w'].includes(name)) continue;
    else if (name === '--address') next();
    else if (a.startsWith('-')) return `Error: unknown flag: ${name}\nRun 'caddy ${under} --help' for usage.`;
    else o.files.push(a);
  }
  if (o.config === '') return `Error: flag needs an argument: --config\nRun 'caddy ${under} --help' for usage.`;
  void game;
  return o;
}

// Le fichier de configuration : --config, sinon le Caddyfile du dossier courant.
function configFile(game: Shell, o: Options): string | null {
  if (o.config) return o.config;
  return game.exists('Caddyfile') ? 'Caddyfile' : null;
}

// Lit et adapte la configuration ; les lignes de la console, ou l'erreur.
function adapter(game: Shell, o: Options): { lines: string[]; config: ConfigCaddy } | { error: string } {
  const file = configFile(game, o);
  if (!file) return { error: 'Error: no config file to load' };
  if (o.adapter && o.adapter !== 'caddyfile') return { error: `Error: unrecognized config adapter '${o.adapter}'` };
  const absolute = game.resolve(file);
  const n = game.find(absolute);
  if (!n) return { error: `Error: reading config from file: open ${file}: no such file or directory` };
  if (n.type === 'directory') return { error: `Error: reading config from file: read ${file}: is a directory` };
  if (!game.can(n, 'r')) return { error: `Error: reading config from file: open ${file}: permission denied` };
  const r = readConfigCaddy(game, absolute === CADDYFILE ? CADDYFILE : file);
  if ('error' in r) return { error: `Error: ${r.error}` };
  const lines = [consoleLine(game, 'INFO', 'using config from file', { file: file })];
  if (r.config.notFormatted !== null)
    lines.push(consoleLine(game, 'WARN', "Caddyfile input is not formatted; run 'caddy fmt --overwrite' to fix inconsistencies", { adapter: 'caddyfile', file: file, line: r.config.notFormatted }));
  lines.push(consoleLine(game, 'INFO', 'adapted config to JSON', { adapter: 'caddyfile' }));
  return { lines, config: r.config };
}

// Les lignes de journal de la console (sur la sortie d'erreur), sans faire échouer la commande.
function log(game: Shell, lines: string[]) {
  for (const l of lines) game.error(l);
  game.status = 0;
}

const service = (game: Shell) => systemd(game)?.services.caddy;

const caddy: Command = {
  section: 8,
  ownOptions: true,
  launch: ({ args, game }) => {
    const under = args[0];
    if (!under || under === 'help' || under === '-h') return USAGE;
    if (under === 'version' || under === '-v' || under === '--version') return VERSION;
    if (!UNDER_COMMANDS.includes(under)) return game.error(`Error: unknown command "${under}" for "caddy"\nRun 'caddy --help' for usage.`);
    const o = readOptions(game, under, args.slice(1));
    if (typeof o === 'string') return game.error(o);

    if (under === 'fmt') {
      const file = o.files[0] ?? 'Caddyfile';
      const n = game.find(file);
      if (!n || n.type !== 'file') return game.error(`Error: reading input file: open ${file}: no such file or directory`);
      if (!game.can(n, 'r')) return game.error(`Error: reading input file: open ${file}: permission denied`);
      const text = game.read(file) ?? '';
      const own = formatValue(text);
      if (o.overwrite) {
        if (own === text.replace(/\n+$/, '')) return '';
        if (!game.can(n, 'w')) return game.error(`Error: open ${file}: permission denied`);
        n.content = `${own}\n`;
        return '';
      }
      if (o.diff) {
        const a = text.replace(/\n+$/, '').split('\n');
        const b = own.split('\n');
        return a.map((l, k) => (l === b[k] ? `  ${l}` : `- ${l}\n+ ${b[k] ?? ''}`)).join('\n');
      }
      return own;
    }

    if (under === 'validate' || under === 'adapt') {
      const r = adapter(game, o);
      if ('error' in r) return game.error(r.error);
      if (under === 'adapt') {
        log(game, r.lines);
        return JSON.stringify(toJson(r.config), null, o.pretty ? '\t' : undefined);
      }
      log(game, r.lines);
      return 'Valid configuration';
    }

    const s = service(game);
    const sd = systemd(game);
    const unreachable = 'Error: sending configuration to instance: performing request: Post "http://localhost:2019/load": dial tcp [::1]:2019: connect: connection refused';

    if (under === 'reload') {
      const r = adapter(game, o);
      if ('error' in r) return game.error(r.error);
      log(game, r.lines);
      if (!sd || s?.state !== 'active') return game.error(unreachable, 1);
      // Caddy charge la configuration envoyée : on la relit depuis le même fichier.
      logCaddy(game, 'info', 'admin.api', 'received request', { method: 'POST', host: 'localhost:2019', uri: '/load', remote_ip: '127.0.0.1', remote_port: '43122', headers: { 'Content-Type': ['application/json'], 'User-Agent': ['Go-http-client/1.1'] } });
      const absolute = game.resolve(configFile(game, o)!);
      if (absolute !== CADDYFILE) {
        // Une autre configuration que celle du service : Caddy la prend quand même.
        const text = game.read(absolute) ?? '';
        const kept = game.read(CADDYFILE);
        const n = game.find(CADDYFILE);
        if (n?.type === 'file') n.content = text;
        loadCaddy(game);
        if (n?.type === 'file') n.content = kept ?? '';
      } else loadCaddy(game);
      logCaddy(game, 'info', 'admin.api', 'load complete');
      return '';
    }

    if (under === 'stop') {
      if (!sd || s?.state !== 'active') return game.error('Error: performing request: Post "http://localhost:2019/stop": dial tcp [::1]:2019: connect: connection refused');
      stop(game, sd, 'caddy');
      return '';
    }

    // run, start : le service tient déjà les ports.
    if (s?.state === 'active') {
      // Sans fichier, Caddy démarre avec une configuration vide… et bute aussi sur l'API d'administration.
      const r = configFile(game, o) ? adapter(game, o) : { lines: [] };
      if ('error' in r) return game.error(r.error);
      return game.error([...r.lines, 'Error: loading initial config: loading new config: starting caddy administration endpoint: listen tcp 127.0.0.1:2019: bind: address already in use'].join('\n'));
    }
    if (!sd || !s) return game.error('Error: no config file to load');
    if (game.who !== 'root') return game.error('Error: loading initial config: loading new config: http app module: start: listening on :80: listen tcp :80: bind: permission denied');
    return start(game, sd, 'caddy') ? '' : game.error(`Error: ${(readConfigCaddy(game) as { error?: string }).error ?? 'loading initial config'}`);
  },
};

export const CADDY: Record<string, Command> = { caddy };
