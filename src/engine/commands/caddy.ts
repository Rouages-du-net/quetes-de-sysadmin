// La commande caddy (https://caddyserver.com/docs/command-line) : version,
// validate, adapt, fmt, reload, run, start, stop. Les sous-commandes qui lisent
// une configuration prennent --config (sinon le Caddyfile du dossier courant).
// reload passe par l'API d'administration (localhost:2019) du Caddy qui
// tourne : le service, sans besoin d'être root. Les messages de la console
// suivent le format de zap (date, niveau, message, champs JSON).
// Écarts : run et start, quand le service est arrêté, le démarrent (au lieu de
// lancer un Caddy à part) ; adapt donne une configuration JSON simplifiée.

import type { Commande } from './index';
import type { Shell } from '../shell';
import { arreter, demarrer, systemd } from '../systemd';
import { CADDYFILE, chargerCaddy, formater, lireConfigCaddy, noter as journaliserCaddy, VERSION, versJson, type ConfigCaddy } from '../caddy';

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

const SOUS_COMMANDES = ['adapt', 'fmt', 'help', 'reload', 'run', 'start', 'stop', 'validate', 'version'];

// « 2026/11/20 09:31:02.123	INFO	message	{"champ": "valeur"} », comme la console de zap.
function ligneConsole(jeu: Shell, niveau: string, msg: string, champs?: Record<string, unknown>): string {
  const d = new Date(systemd(jeu)?.horloge ?? 0).toISOString();
  const quand = `${d.slice(0, 10).replaceAll('-', '/')} ${d.slice(11, 23)}`;
  const suite = champs ? `\t${JSON.stringify(champs).replace(/":/g, '": ').replace(/,"/g, ', "')}` : '';
  return `${quand}\t${niveau}\t${msg}${suite}`;
}

interface Options {
  config: string | null;
  adapter: string | null;
  pretty: boolean;
  overwrite: boolean;
  force: boolean;
  diff: boolean;
  fichiers: string[];
}

function lireOptions(jeu: Shell, sous: string, args: string[]): Options | string {
  const o: Options = { config: null, adapter: null, pretty: false, overwrite: false, force: false, diff: false, fichiers: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const [nom, valeur] = a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, null];
    const suivante = () => valeur ?? args[++i] ?? null;
    if (nom === '--config' || nom === '-c') o.config = suivante();
    else if (nom === '--adapter' || nom === '-a') o.adapter = suivante();
    else if (nom === '--pretty' || nom === '-p') o.pretty = true;
    else if (nom === '--overwrite' || nom === '-w') o.overwrite = true;
    else if (nom === '--force' || nom === '-f') o.force = true;
    else if (nom === '--diff' || nom === '-d') o.diff = true;
    else if (['--environ', '-e', '--validate', '--resume', '--watch', '-w'].includes(nom)) continue;
    else if (nom === '--address') suivante();
    else if (a.startsWith('-')) return `Error: unknown flag: ${nom}\nRun 'caddy ${sous} --help' for usage.`;
    else o.fichiers.push(a);
  }
  if (o.config === '') return `Error: flag needs an argument: --config\nRun 'caddy ${sous} --help' for usage.`;
  void jeu;
  return o;
}

// Le fichier de configuration : --config, sinon le Caddyfile du dossier courant.
function fichierConfig(jeu: Shell, o: Options): string | null {
  if (o.config) return o.config;
  return jeu.existe('Caddyfile') ? 'Caddyfile' : null;
}

// Lit et adapte la configuration ; les lignes de la console, ou l'erreur.
function adapter(jeu: Shell, o: Options): { lignes: string[]; config: ConfigCaddy } | { erreur: string } {
  const fichier = fichierConfig(jeu, o);
  if (!fichier) return { erreur: 'Error: no config file to load' };
  if (o.adapter && o.adapter !== 'caddyfile') return { erreur: `Error: unrecognized config adapter '${o.adapter}'` };
  const absolu = jeu.resoudre(fichier);
  const n = jeu.trouver(absolu);
  if (!n) return { erreur: `Error: reading config from file: open ${fichier}: no such file or directory` };
  if (n.type === 'dossier') return { erreur: `Error: reading config from file: read ${fichier}: is a directory` };
  if (!jeu.peut(n, 'r')) return { erreur: `Error: reading config from file: open ${fichier}: permission denied` };
  const r = lireConfigCaddy(jeu, absolu === CADDYFILE ? CADDYFILE : fichier);
  if ('erreur' in r) return { erreur: `Error: ${r.erreur}` };
  const lignes = [ligneConsole(jeu, 'INFO', 'using config from file', { file: fichier })];
  if (r.config.nonFormate !== null)
    lignes.push(ligneConsole(jeu, 'WARN', "Caddyfile input is not formatted; run 'caddy fmt --overwrite' to fix inconsistencies", { adapter: 'caddyfile', file: fichier, line: r.config.nonFormate }));
  lignes.push(ligneConsole(jeu, 'INFO', 'adapted config to JSON', { adapter: 'caddyfile' }));
  return { lignes, config: r.config };
}

// Les lignes de journal de la console (sur la sortie d'erreur), sans faire échouer la commande.
function journal(jeu: Shell, lignes: string[]) {
  for (const l of lignes) jeu.erreur(l);
  jeu.statut = 0;
}

const service = (jeu: Shell) => systemd(jeu)?.services.caddy;

const caddy: Commande = {
  section: 8,
  propresOptions: true,
  lancer: ({ args, jeu }) => {
    const sous = args[0];
    if (!sous || sous === 'help' || sous === '-h') return USAGE;
    if (sous === 'version' || sous === '-v' || sous === '--version') return VERSION;
    if (!SOUS_COMMANDES.includes(sous)) return jeu.erreur(`Error: unknown command "${sous}" for "caddy"\nRun 'caddy --help' for usage.`);
    const o = lireOptions(jeu, sous, args.slice(1));
    if (typeof o === 'string') return jeu.erreur(o);

    if (sous === 'fmt') {
      const fichier = o.fichiers[0] ?? 'Caddyfile';
      const n = jeu.trouver(fichier);
      if (!n || n.type !== 'fichier') return jeu.erreur(`Error: reading input file: open ${fichier}: no such file or directory`);
      if (!jeu.peut(n, 'r')) return jeu.erreur(`Error: reading input file: open ${fichier}: permission denied`);
      const texte = jeu.lire(fichier) ?? '';
      const propre = formater(texte);
      if (o.overwrite) {
        if (propre === texte.replace(/\n+$/, '')) return '';
        if (!jeu.peut(n, 'w')) return jeu.erreur(`Error: open ${fichier}: permission denied`);
        n.contenu = `${propre}\n`;
        return '';
      }
      if (o.diff) {
        const a = texte.replace(/\n+$/, '').split('\n');
        const b = propre.split('\n');
        return a.map((l, k) => (l === b[k] ? `  ${l}` : `- ${l}\n+ ${b[k] ?? ''}`)).join('\n');
      }
      return propre;
    }

    if (sous === 'validate' || sous === 'adapt') {
      const r = adapter(jeu, o);
      if ('erreur' in r) return jeu.erreur(r.erreur);
      if (sous === 'adapt') {
        journal(jeu, r.lignes);
        return JSON.stringify(versJson(r.config), null, o.pretty ? '\t' : undefined);
      }
      journal(jeu, r.lignes);
      return 'Valid configuration';
    }

    const s = service(jeu);
    const sd = systemd(jeu);
    const injoignable = 'Error: sending configuration to instance: performing request: Post "http://localhost:2019/load": dial tcp [::1]:2019: connect: connection refused';

    if (sous === 'reload') {
      const r = adapter(jeu, o);
      if ('erreur' in r) return jeu.erreur(r.erreur);
      journal(jeu, r.lignes);
      if (!sd || s?.etat !== 'active') return jeu.erreur(injoignable, 1);
      // Caddy charge la configuration envoyée : on la relit depuis le même fichier.
      journaliserCaddy(jeu, 'info', 'admin.api', 'received request', { method: 'POST', host: 'localhost:2019', uri: '/load', remote_ip: '127.0.0.1', remote_port: '43122', headers: { 'Content-Type': ['application/json'], 'User-Agent': ['Go-http-client/1.1'] } });
      const absolu = jeu.resoudre(fichierConfig(jeu, o)!);
      if (absolu !== CADDYFILE) {
        // Une autre configuration que celle du service : Caddy la prend quand même.
        const texte = jeu.lire(absolu) ?? '';
        const garde = jeu.lire(CADDYFILE);
        const n = jeu.trouver(CADDYFILE);
        if (n?.type === 'fichier') n.contenu = texte;
        chargerCaddy(jeu);
        if (n?.type === 'fichier') n.contenu = garde ?? '';
      } else chargerCaddy(jeu);
      journaliserCaddy(jeu, 'info', 'admin.api', 'load complete');
      return '';
    }

    if (sous === 'stop') {
      if (!sd || s?.etat !== 'active') return jeu.erreur('Error: performing request: Post "http://localhost:2019/stop": dial tcp [::1]:2019: connect: connection refused');
      arreter(jeu, sd, 'caddy');
      return '';
    }

    // run, start : le service tient déjà les ports.
    if (s?.etat === 'active') {
      // Sans fichier, Caddy démarre avec une configuration vide… et bute aussi sur l'API d'administration.
      const r = fichierConfig(jeu, o) ? adapter(jeu, o) : { lignes: [] };
      if ('erreur' in r) return jeu.erreur(r.erreur);
      return jeu.erreur([...r.lignes, 'Error: loading initial config: loading new config: starting caddy administration endpoint: listen tcp 127.0.0.1:2019: bind: address already in use'].join('\n'));
    }
    if (!sd || !s) return jeu.erreur('Error: no config file to load');
    if (jeu.qui !== 'root') return jeu.erreur('Error: loading initial config: loading new config: http app module: start: listening on :80: listen tcp :80: bind: permission denied');
    return demarrer(jeu, sd, 'caddy') ? '' : jeu.erreur(`Error: ${(lireConfigCaddy(jeu) as { erreur?: string }).erreur ?? 'loading initial config'}`);
  },
};

export const CADDY: Record<string, Commande> = { caddy };
