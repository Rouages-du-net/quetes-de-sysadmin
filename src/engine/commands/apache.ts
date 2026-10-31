// Les commandes d'Apache sur Debian : apache2ctl (et apachectl, le même
// script) pour vérifier la configuration (configtest, -S, -M) et piloter le
// service ; a2ensite, a2dissite, a2enmod, a2dismod, a2enconf, a2disconf, qui
// créent ou retirent les liens symboliques de sites-enabled, mods-enabled
// et conf-enabled. Messages d'après apache2ctl(8), a2enmod(8) et le script
// a2enmod du paquet apache2 (https://salsa.debian.org/apache-team/apache2/-/blob/master/debian/a2enmod).
// Écarts : apache2ctl configtest marche aussi hors de root ; sans argument,
// a2ensite & co. listent les choix sans les demander.

import type { Commande } from './index';
import type { Shell } from '../shell';
import { arreter, demarrer, recharger, systemd } from '../systemd';
import { AH00558, DEPENDANCES, RACINE, SIGNATURE, modulesCharges, tester, vhosts } from '../apache';

// Ce que le script apache2ctl affiche sans argument valable.
const USAGE = [
  'Usage: /usr/sbin/apache2ctl start|stop|restart|graceful|graceful-stop|configtest|status|fullstatus|help',
  '       /usr/sbin/apache2ctl <apache2 args>',
  '       /usr/sbin/apache2ctl -h            (for help on <apache2 args>)',
].join('\n');

const installe = (jeu: Shell) => !!jeu.trouver('/usr/sbin/apache2ctl');

// Vérifier la configuration ; renvoie les lignes d'avertissement, ou l'erreur.
function verifier(jeu: Shell, action: string): { lignes: string[]; erreur: string | null; config: ReturnType<typeof tester>['config'] } {
  const res = tester(jeu);
  if (!res.config) return { lignes: [], erreur: `${res.erreur}\nAction '${action}' failed.\nThe Apache error log may have more information.`, config: null };
  return { lignes: [...res.config.avertissements, ...(res.config.nomGlobal ? [] : [AH00558])], erreur: null, config: res.config };
}

// apache2ctl start|stop|restart|graceful : sous systemd, le script passe par systemctl.
function piloter(jeu: Shell, action: string): string {
  const sd = systemd(jeu);
  const s = sd?.services.apache2;
  if (!sd || !s) return jeu.erreur('Failed to start apache2.service: Unit apache2.service not found.');
  if (jeu.qui !== 'root') return jeu.erreur(`Failed to ${action === 'graceful' ? 'reload' : action} apache2.service: Access denied\nAction '${action}' failed.`);
  const echec = () =>
    jeu.erreur(
      `Job for apache2.service failed because the control process exited with error code.\nSee "systemctl status apache2.service" and "journalctl -xeu apache2.service" for details.\nAction '${action}' failed.\nThe Apache error log may have more information.`,
    );
  if (action === 'stop' || action === 'graceful-stop') {
    if (s.etat === 'active') arreter(jeu, sd, 'apache2');
    return '';
  }
  if (action === 'graceful' && s.etat === 'active') {
    // apache2ctl graceful vérifie d'abord la configuration.
    const v = verifier(jeu, 'graceful');
    if (v.erreur) return jeu.erreur(v.erreur);
    return recharger(jeu, sd, 'apache2') ? '' : echec();
  }
  if (action === 'restart' && s.etat === 'active') arreter(jeu, sd, 'apache2');
  if (s.etat === 'active') return '';
  return demarrer(jeu, sd, 'apache2') ? '' : echec();
}

const apache2ctl: Commande = {
  section: 8,
  propresOptions: true,
  lancer: ({ args, jeu }) => {
    if (!installe(jeu)) return jeu.erreur(jeu.t('commande-introuvable', { commande: 'apache2ctl' }));
    const a = args.filter((x) => x !== '-k');
    const premier = a[0];
    if (premier === '-v') return `Server version: ${SIGNATURE}\nServer built:   2025-07-29T15:46:03`;
    if (premier === '-V')
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
        ` -D HTTPD_ROOT="${RACINE}"`,
        ' -D SERVER_CONFIG_FILE="apache2.conf"',
      ].join('\n');
    if (['start', 'stop', 'restart', 'graceful', 'graceful-stop'].includes(premier ?? '')) return piloter(jeu, premier);
    if (premier === 'status' || premier === 'fullstatus')
      return jeu.erreur(
        'Looking up localhost\nMaking HTTP connection to localhost\nAlert!: Unable to connect to remote host.\n\nlynx: Can\'t access startfile http://localhost/server-status\n\'www-browser -dump http://localhost:80/server-status\' failed.\nMaybe you need to install a package providing www-browser or you\nneed to adjust the APACHE_LYNX variable in /etc/apache2/envvars',
      );
    const dump = (quoi: string) => a.includes('-D') && a[a.indexOf('-D') + 1] === quoi;
    const vhost = premier === '-S' || dump('DUMP_VHOSTS');
    const mods = premier === '-M' || dump('DUMP_MODULES');
    if (premier === 'configtest' || premier === '-t' || vhost || mods) {
      const v = verifier(jeu, premier === 'configtest' ? 'configtest' : '-t');
      if (v.erreur) {
        jeu.etat.apacheErreur = v.erreur;
        return jeu.erreur(v.erreur);
      }
      jeu.etat.apacheTeste = true;
      if (vhost) jeu.etat.apacheVhosts = true;
      const corps = vhost ? vhosts(v.config!) : mods ? modulesCharges(v.config!) : 'Syntax OK';
      return [...v.lignes, corps].join('\n');
    }
    if (premier === 'help' || premier === '-h' || premier === '--help') return USAGE;
    return jeu.erreur(premier ? `apache2: invalid option -- '${premier.replace(/^-+/, '')}'\n${USAGE}` : USAGE);
  },
};

// a2ensite & co. : le type d'objet, ses dossiers, l'extension et la commande à lancer ensuite.
interface Genre {
  mot: string;
  Mot: string;
  dossier: string;
  extensions: string[];
  apres: 'reload' | 'restart';
}
const SITE: Genre = { mot: 'site', Mot: 'Site', dossier: 'sites', extensions: ['.conf'], apres: 'reload' };
const MODULE: Genre = { mot: 'module', Mot: 'Module', dossier: 'mods', extensions: ['.load', '.conf'], apres: 'restart' };
const CONF: Genre = { mot: 'conf', Mot: 'Conf', dossier: 'conf', extensions: ['.conf'], apres: 'reload' };

const nomsDisponibles = (jeu: Shell, g: Genre) => {
  const n = jeu.trouver(`${RACINE}/${g.dossier}-available`);
  if (n?.type !== 'dossier') return [];
  const ext = g.extensions[0];
  return Object.keys(n.enfants)
    .filter((f) => f.endsWith(ext))
    .map((f) => f.slice(0, -ext.length))
    .sort();
};

function activer(jeu: Shell, g: Genre, args: string[], activer: boolean): string {
  if (!installe(jeu)) return jeu.erreur(jeu.t('commande-introuvable', { commande: `a2${activer ? 'en' : 'dis'}${g.mot === 'site' ? 'site' : g.mot === 'module' ? 'mod' : 'conf'}` }));
  const noms = args.filter((x) => !x.startsWith('-'));
  if (!noms.length)
    return `Your choices are: ${nomsDisponibles(jeu, g).join(' ')}\nWhich ${g.mot}(s) do you want to ${activer ? 'enable' : 'disable'} (wildcards ok)?`;
  const sorties: string[] = [];
  let change = false;
  const traiter = (brut: string) => {
    const nom = brut.replace(/\.(conf|load)$/, '');
    const ext = g.extensions[0];
    const disponible = `${RACINE}/${g.dossier}-available/${nom}${ext}`;
    const actif = `${RACINE}/${g.dossier}-enabled/${nom}${ext}`;
    if (!jeu.trouver(disponible) && !(!activer && jeu.trouver(actif, false))) {
      jeu.erreur(`ERROR: ${g.Mot} ${nom} does not exist!`, 1);
      return;
    }
    if (activer) {
      for (const d of g === MODULE ? (DEPENDANCES[nom] ?? []) : []) {
        sorties.push(`Considering dependency ${d} for ${nom}:`);
        traiter(d);
      }
      if (jeu.trouver(actif, false)) {
        sorties.push(`${g.Mot} ${nom} already enabled`);
        return;
      }
      for (const e of g.extensions) {
        const cible = `${RACINE}/${g.dossier}-enabled/${nom}${e}`;
        if (!jeu.trouver(`${RACINE}/${g.dossier}-available/${nom}${e}`)) continue;
        if (!jeu.ecritDans(cible)) {
          jeu.erreur(`Could not create ${cible}: Permission denied`, 1);
          return;
        }
        const parent = jeu.trouver(`${RACINE}/${g.dossier}-enabled`);
        if (parent?.type === 'dossier')
          parent.enfants[`${nom}${e}`] = { type: 'fichier', contenu: '', lien: `../${g.dossier}-available/${nom}${e}`, proprio: 'root' };
      }
      sorties.push(`Enabling ${g.mot} ${nom}.`);
      change = true;
      return;
    }
    if (!jeu.trouver(actif, false)) {
      sorties.push(`${g.Mot} ${nom} already disabled`);
      return;
    }
    for (const e of g.extensions) {
      const cible = `${RACINE}/${g.dossier}-enabled/${nom}${e}`;
      if (!jeu.trouver(cible, false)) continue;
      if (!jeu.ecritDans(cible)) {
        jeu.erreur(`Could not remove ${cible}: Permission denied`, 1);
        return;
      }
      jeu.effacer(cible);
    }
    sorties.push(`${g.Mot} ${nom} disabled.`);
    change = true;
  };
  for (const n of noms) traiter(n);
  if (change) sorties.push('To activate the new configuration, you need to run:', `  systemctl ${g.apres} apache2`);
  return sorties.join('\n');
}

export const APACHE: Record<string, Commande> = {
  apache2ctl,
  apachectl: { ...apache2ctl },
  a2ensite: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => activer(jeu, SITE, args, true) },
  a2dissite: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => activer(jeu, SITE, args, false) },
  a2enmod: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => activer(jeu, MODULE, args, true) },
  a2dismod: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => activer(jeu, MODULE, args, false) },
  a2enconf: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => activer(jeu, CONF, args, true) },
  a2disconf: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => activer(jeu, CONF, args, false) },
};
