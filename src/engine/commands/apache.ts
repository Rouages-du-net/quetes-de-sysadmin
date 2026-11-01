// Les commandes d'Apache sur Debian : apache2ctl (et apachectl, le même
// script) pour vérifier la configuration (configtest, -S, -M) et piloter le
// service ; a2ensite, a2dissite, a2enmod, a2dismod, a2enconf, a2disconf, qui
// créent ou retirent les liens symboliques de sites-enabled, mods-enabled
// et conf-enabled. Messages d'après apache2ctl(8), a2enmod(8) et le script
// a2enmod du paquet apache2 (https://salsa.debian.org/apache-team/apache2/-/blob/master/debian/a2enmod).
// Écarts : apache2ctl configtest marche aussi hors de root ; sans argument,
// a2ensite & co. listent les choix sans les demander.

import type { Command } from './index';
import type { Shell } from '../shell';
import { stop, start, reload, systemd } from '../systemd';
import { AH00558, DEPENDENCIES, ROOT, SIGNATURE, modulesCharges, test, vhosts } from '../apache';

// Ce que le script apache2ctl affiche sans argument valable.
const USAGE = [
  'Usage: /usr/sbin/apache2ctl start|stop|restart|graceful|graceful-stop|configtest|status|fullstatus|help',
  '       /usr/sbin/apache2ctl <apache2 args>',
  '       /usr/sbin/apache2ctl -h            (for help on <apache2 args>)',
].join('\n');

const installed = (game: Shell) => !!game.find('/usr/sbin/apache2ctl');

// Vérifier la configuration ; renvoie les lignes d'avertissement, ou l'erreur.
function check(game: Shell, action: string): { lines: string[]; error: string | null; config: ReturnType<typeof test>['config'] } {
  const res = test(game);
  if (!res.config) return { lines: [], error: `${res.error}\nAction '${action}' failed.\nThe Apache error log may have more information.`, config: null };
  return { lines: [...res.config.warnings, ...(res.config.globalName ? [] : [AH00558])], error: null, config: res.config };
}

// apache2ctl start|stop|restart|graceful : sous systemd, le script passe par systemctl.
function drive(game: Shell, action: string): string {
  const sd = systemd(game);
  const s = sd?.services.apache2;
  if (!sd || !s) return game.error('Failed to start apache2.service: Unit apache2.service not found.');
  if (game.who !== 'root') return game.error(`Failed to ${action === 'graceful' ? 'reload' : action} apache2.service: Access denied\nAction '${action}' failed.`);
  const failure = () =>
    game.error(
      `Job for apache2.service failed because the control process exited with error code.\nSee "systemctl status apache2.service" and "journalctl -xeu apache2.service" for details.\nAction '${action}' failed.\nThe Apache error log may have more information.`,
    );
  if (action === 'stop' || action === 'graceful-stop') {
    if (s.state === 'active') stop(game, sd, 'apache2');
    return '';
  }
  if (action === 'graceful' && s.state === 'active') {
    // apache2ctl graceful vérifie d'abord la configuration.
    const v = check(game, 'graceful');
    if (v.error) return game.error(v.error);
    return reload(game, sd, 'apache2') ? '' : failure();
  }
  if (action === 'restart' && s.state === 'active') stop(game, sd, 'apache2');
  if (s.state === 'active') return '';
  return start(game, sd, 'apache2') ? '' : failure();
}

const apache2ctl: Command = {
  section: 8,
  ownOptions: true,
  launch: ({ args, game }) => {
    if (!installed(game)) return game.error(game.t('command-missing', { commande: 'apache2ctl' }));
    const a = args.filter((x) => x !== '-k');
    const first = a[0];
    if (first === '-v') return `Server version: ${SIGNATURE}\nServer built:   2025-07-29T15:46:03`;
    if (first === '-V')
      return [
        `Server version: ${SIGNATURE}`,
        'Server built:   2025-07-29T15:46:03',
        "Server's Module Magic Number: 20120211:139",
        'Server loaded:  APR 1.7.5, APR-UTIL 1.6.3, PCRE 10.45 2025-02-05',
        'Architecture:   64-bit',
        'Server MPM:     event',
        '  threaded:     yes (fixed thread count)',
        '    forked:     yes (variable process count)',
        'Server compiled with....',
        ` -D HTTPD_ROOT="${ROOT}"`,
        ' -D SERVER_CONFIG_FILE="apache2.conf"',
      ].join('\n');
    if (['start', 'stop', 'restart', 'graceful', 'graceful-stop'].includes(first ?? '')) return drive(game, first);
    if (first === 'status' || first === 'fullstatus')
      return game.error(
        'Looking up localhost\nMaking HTTP connection to localhost\nAlert!: Unable to connect to remote host.\n\nlynx: Can\'t access startfile http://localhost/server-status\n\'www-browser -dump http://localhost:80/server-status\' failed.\nMaybe you need to install a package providing www-browser or you\nneed to adjust the APACHE_LYNX variable in /etc/apache2/envvars',
      );
    const dump = (what: string) => a.includes('-D') && a[a.indexOf('-D') + 1] === what;
    const vhost = first === '-S' || dump('DUMP_VHOSTS');
    const mods = first === '-M' || dump('DUMP_MODULES');
    if (first === 'configtest' || first === '-t' || vhost || mods) {
      const v = check(game, first === 'configtest' ? 'configtest' : '-t');
      if (v.error) {
        game.state.apacheErreur = v.error;
        return game.error(v.error);
      }
      game.state.apacheTeste = true;
      if (vhost) game.state.apacheVhosts = true;
      const body = vhost ? vhosts(v.config!) : mods ? modulesCharges(v.config!) : 'Syntax OK';
      return [...v.lines, body].join('\n');
    }
    if (first === 'help' || first === '-h' || first === '--help') return USAGE;
    return game.error(first ? `apache2: invalid option -- '${first.replace(/^-+/, '')}'\n${USAGE}` : USAGE);
  },
};

// a2ensite & co. : le type d'objet, ses dossiers, l'extension et la commande à lancer ensuite.
interface Kind {
  word: string;
  Word: string;
  directory: string;
  extensions: string[];
  after: 'reload' | 'restart';
}
const SITE: Kind = { word: 'site', Word: 'Site', directory: 'sites', extensions: ['.conf'], after: 'reload' };
const MODULE: Kind = { word: 'module', Word: 'Module', directory: 'mods', extensions: ['.load', '.conf'], after: 'restart' };
const CONF: Kind = { word: 'conf', Word: 'Conf', directory: 'conf', extensions: ['.conf'], after: 'reload' };

const availableNames = (game: Shell, g: Kind) => {
  const n = game.find(`${ROOT}/${g.directory}-available`);
  if (n?.type !== 'dossier') return [];
  const ext = g.extensions[0];
  return Object.keys(n.children)
    .filter((f) => f.endsWith(ext))
    .map((f) => f.slice(0, -ext.length))
    .sort();
};

function enable(game: Shell, g: Kind, args: string[], enable: boolean): string {
  if (!installed(game)) return game.error(game.t('command-missing', { commande: `a2${enable ? 'en' : 'dis'}${g.word === 'site' ? 'site' : g.word === 'module' ? 'mod' : 'conf'}` }));
  const names = args.filter((x) => !x.startsWith('-'));
  if (!names.length)
    return `Your choices are: ${availableNames(game, g).join(' ')}\nWhich ${g.word}(s) do you want to ${enable ? 'enable' : 'disable'} (wildcards ok)?`;
  const outputs: string[] = [];
  let change = false;
  const handle = (raw: string) => {
    const name = raw.replace(/\.(conf|load)$/, '');
    const ext = g.extensions[0];
    const available = `${ROOT}/${g.directory}-available/${name}${ext}`;
    const enabled = `${ROOT}/${g.directory}-enabled/${name}${ext}`;
    if (!game.find(available) && !(!enable && game.find(enabled, false))) {
      game.error(`ERROR: ${g.Word} ${name} does not exist!`, 1);
      return;
    }
    if (enable) {
      for (const d of g === MODULE ? (DEPENDENCIES[name] ?? []) : []) {
        outputs.push(`Considering dependency ${d} for ${name}:`);
        handle(d);
      }
      if (game.find(enabled, false)) {
        outputs.push(`${g.Word} ${name} already enabled`);
        return;
      }
      for (const e of g.extensions) {
        const target = `${ROOT}/${g.directory}-enabled/${name}${e}`;
        if (!game.find(`${ROOT}/${g.directory}-available/${name}${e}`)) continue;
        if (!game.writtenIn(target)) {
          game.error(`Could not create ${target}: Permission denied`, 1);
          return;
        }
        const parent = game.find(`${ROOT}/${g.directory}-enabled`);
        if (parent?.type === 'dossier')
          parent.children[`${name}${e}`] = { type: 'fichier', content: '', link: `../${g.directory}-available/${name}${e}`, owner: 'root' };
      }
      outputs.push(`Enabling ${g.word} ${name}.`);
      change = true;
      return;
    }
    if (!game.find(enabled, false)) {
      outputs.push(`${g.Word} ${name} already disabled`);
      return;
    }
    for (const e of g.extensions) {
      const target = `${ROOT}/${g.directory}-enabled/${name}${e}`;
      if (!game.find(target, false)) continue;
      if (!game.writtenIn(target)) {
        game.error(`Could not remove ${target}: Permission denied`, 1);
        return;
      }
      game.erase(target);
    }
    outputs.push(`${g.Word} ${name} disabled.`);
    change = true;
  };
  for (const n of names) handle(n);
  if (change) outputs.push('To activate the new configuration, you need to run:', `  systemctl ${g.after} apache2`);
  return outputs.join('\n');
}

export const APACHE: Record<string, Command> = {
  apache2ctl,
  apachectl: { ...apache2ctl },
  a2ensite: { section: 8, ownOptions: true, launch: ({ args, game }) => enable(game, SITE, args, true) },
  a2dissite: { section: 8, ownOptions: true, launch: ({ args, game }) => enable(game, SITE, args, false) },
  a2enmod: { section: 8, ownOptions: true, launch: ({ args, game }) => enable(game, MODULE, args, true) },
  a2dismod: { section: 8, ownOptions: true, launch: ({ args, game }) => enable(game, MODULE, args, false) },
  a2enconf: { section: 8, ownOptions: true, launch: ({ args, game }) => enable(game, CONF, args, true) },
  a2disconf: { section: 8, ownOptions: true, launch: ({ args, game }) => enable(game, CONF, args, false) },
};
