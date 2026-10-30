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
import type { Processus } from './systeme';
import { requeteAppli } from '../nginx';
import { systemd } from '../systemd';
import { heure, heureMachine } from '../heure';
import type { Commande } from './index';
import { soumettre } from '../courrier';

export const PLUGINS = '/usr/lib/nagios/plugins';
const CODES = ['OK', 'WARNING', 'CRITICAL', 'UNKNOWN'];

export interface Courrier {
  temps: number;
  de: string;
  a: string;
  sujet: string;
  corps: string;
}

/** Les courriers remis sur cette machine (pour les histoires : qui a été prévenu, et quand). */
export const courriers = (jeu: Shell): Courrier[] => (jeu.etat.courriers ??= []);

// L'heure de la machine, et sa date au format des courriers.
const maintenant = (jeu: Shell) => (heure(jeu) ? heureMachine(jeu).mur : (systemd(jeu)?.horloge ?? Date.UTC(2027, 0, 1)));
const JOURS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MOIS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateMbox = (ms: number) => {
  const d = new Date(ms);
  return `${JOURS[d.getUTCDay()]} ${MOIS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${d.toISOString().slice(11, 19)} ${d.getUTCFullYear()}`;
};

/** À qui va un courrier : la partie locale de l'adresse, après /etc/aliases. */
function destinataire(jeu: Shell, adresse: string): string {
  const local = adresse.replace(/@.*$/, '');
  const aliases = jeu.lire('/etc/aliases') ?? '';
  const alias = new RegExp(`^${local}:\\s*(\\S+)`, 'm').exec(aliases)?.[1];
  return alias ? alias.replace(/@.*$/, '') : local;
}

export function envoyer(jeu: Shell, adresses: string[], sujet: string, corps: string): void {
  const de = jeu.qui;
  const hote = systemd(jeu)?.hote ?? 'localhost';
  for (const adresse of adresses) {
    const compte = destinataire(jeu, adresse);
    const temps = maintenant(jeu);
    courriers(jeu).push({ temps: systemd(jeu)?.horloge ?? temps, de, a: compte, sujet, corps });
    if (!jeu.comptes.utilisateurs[compte]) continue;
    const message = [
      `From ${de}@${hote} ${dateMbox(temps)}`,
      `To: ${adresse}`,
      `Subject: ${sujet}`,
      `From: ${de} <${de}@${hote}>`,
      '',
      corps,
      '',
    ].join('\n');
    const chemin = `/var/mail/${compte}`;
    const n = jeu.trouver(chemin);
    if (n?.type === 'fichier') n.contenu = `${typeof n.contenu === 'string' && n.contenu ? n.contenu + '\n' : ''}${message}`;
    else if (jeu.trouver('/var/mail')?.type === 'dossier')
      (jeu.trouver('/var/mail') as { enfants: Record<string, unknown> }).enfants[compte] = {
        type: 'fichier',
        contenu: message,
        lignes: true,
        proprio: compte,
        groupe: 'mail',
        mode: 'rw-rw----',
      };
  }
}

// La boîte d'un compte, comme l'en-tête de mail sans argument.
function boite(jeu: Shell): string {
  const texte = jeu.lire(`/var/mail/${jeu.qui}`);
  const messages = (texte ?? '').split(/^(?=From \S+ )/m).filter((m) => m.startsWith('From '));
  if (!messages.length) return jeu.erreur(`No mail for ${jeu.qui}`);
  return [
    'Mail version 8.1.2 01/15/2001.  Type ? for help.',
    `"/var/mail/${jeu.qui}": ${messages.length} message${messages.length > 1 ? 's' : ''} ${messages.length} new`,
    ...messages.map((m, i) => {
      const de = /^From (\S+)/.exec(m)![1];
      const date = /^From \S+ (\w+ \w+ +\d+ \d\d:\d\d)/.exec(m)?.[1] ?? '';
      const sujet = /^Subject: (.*)$/m.exec(m)?.[1] ?? '';
      return `${i === 0 ? '>' : ' '}N ${String(i + 1).padStart(2)} ${de.padEnd(18)} ${date}  ${sujet}`;
    }),
  ].join('\n');
}

// Un seuil en pourcentage de libre (« 20% ») : le statut quand il reste `libre` %.
const seuilPct = (texte: string | undefined) => (texte && /^\d+(\.\d+)?%$/.test(texte) ? Number(texte.slice(0, -1)) : null);

function checkDisk(jeu: Shell, args: string[]): string {
  const valeur = (o: string) => (args.includes(o) ? args[args.indexOf(o) + 1] : undefined);
  const w = seuilPct(valeur('-w'));
  const c = seuilPct(valeur('-c'));
  const wi = seuilPct(valeur('-W'));
  const ci = seuilPct(valeur('-K'));
  const chemins = args.flatMap((a, i) => (a === '-p' ? [args[i + 1]] : []));
  if (w === null || c === null || !chemins.length) {
    jeu.statut = 3;
    return 'Usage:\ncheck_disk -w limit -c limit [-W limit] [-K limit] {-p path | -x device}';
  }
  let pire = 0;
  const textes: string[] = [];
  const mesures: string[] = [];
  for (const chemin of chemins) {
    const absolu = jeu.resoudre(chemin);
    const m = jeu.montage(absolu) as { chemin: string; capacite: number; inodes?: number; inodesBase?: number } | null;
    if (!jeu.trouver(absolu) || !m) {
      jeu.statut = 3;
      return `DISK UNKNOWN - ${chemin} does not exist`;
    }
    const lieu = jeu.trouver(m.chemin)!;
    const pris = Math.min(m.capacite, jeu.taille(lieu));
    const libre = m.capacite - pris;
    const pct = Math.floor((100 * libre) / m.capacite);
    const totalInodes = m.inodes ?? Math.round(m.capacite / 16384);
    const inodePct = Math.floor((100 * (totalInodes - Math.min(totalInodes, jeu.inodesUtilises(m)))) / totalInodes);
    let etat = pct < c ? 2 : pct < w ? 1 : 0;
    if (ci !== null && inodePct < ci) etat = 2;
    else if (wi !== null && inodePct < wi) etat = Math.max(etat, 1);
    pire = Math.max(pire, etat);
    const mo = (o: number) => Math.round(o / 1048576);
    textes.push(`${m.chemin} ${mo(libre)} MB (${pct}% inode=${inodePct}%);`);
    mesures.push(`${m.chemin}=${mo(pris)}MB;${mo(m.capacite * (1 - w / 100))};${mo(m.capacite * (1 - c / 100))};0;${mo(m.capacite)}`);
  }
  jeu.statut = pire;
  return `DISK ${CODES[pire]} - free space: ${textes.join(' ')}| ${mesures.join(' ')}`;
}

function checkHttp(jeu: Shell, args: string[]): string {
  const valeur = (o: string) => (args.includes(o) ? args[args.indexOf(o) + 1] : undefined);
  const hote = valeur('-H') ?? valeur('-I');
  const port = Number(valeur('-p') ?? 80);
  const uri = valeur('-u') ?? '/';
  if (!hote) {
    jeu.statut = 3;
    return 'check_http: You must specify a server address or host name\nUsage:\ncheck_http -H <vhost> | -I <IP-address> [-u <uri>] [-p <port>]';
  }
  const local = ['localhost', '127.0.0.1', systemd(jeu)?.hote ?? ''].includes(hote);
  const r = local ? requeteAppli(jeu, port, uri) : null;
  if (!r) {
    jeu.statut = 2;
    return `connect to address ${hote} and port ${port}: Connection refused\nHTTP CRITICAL - Unable to open TCP socket`;
  }
  const raisons: Record<number, string> = {
    200: 'OK',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  const etat = r.code >= 500 ? 2 : r.code >= 400 ? 1 : 0;
  jeu.statut = etat;
  const taille = r.corps.length;
  return `HTTP ${CODES[etat]}: HTTP/1.1 ${r.code} ${raisons[r.code] ?? ''} - ${taille} bytes in 0.004 second response time |time=0.004000s;;;0.000000 size=${taille}B;;;0`;
}

// « 1: » (au moins 1), « :5 » (au plus 5), « 2:3 », « 4 » (de 0 à 4) : hors de la plage, alerte.
function dansPlage(n: number, plage: string): boolean {
  const m = /^(\d*):(\d*)$/.exec(plage);
  if (m) return (m[1] === '' || n >= Number(m[1])) && (m[2] === '' || n <= Number(m[2]));
  return n >= 0 && n <= Number(plage);
}

function checkProcs(jeu: Shell, args: string[]): string {
  const valeur = (o: string) => (args.includes(o) ? args[args.indexOf(o) + 1] : undefined);
  const nom = valeur('-C');
  const w = valeur('-w');
  const c = valeur('-c');
  const liste: Processus[] = (jeu.etat.processus ?? []).filter((p: Processus) => !p.zombie);
  const n = liste.filter((p) => !nom || p.commande.split(/\s+/)[0].split('/').at(-1) === nom).length;
  const etat = c && !dansPlage(n, c) ? 2 : w && !dansPlage(n, w) ? 1 : 0;
  jeu.statut = etat;
  const quoi = `${n} process${n === 1 ? '' : 'es'}${nom ? ` with command name '${nom}'` : ''}`;
  return `PROCS ${CODES[etat]}: ${quoi} | procs=${n};${w ?? ''};${c ?? ''};0;`;
}

/** Une connexion passée ou en cours (pour last), décrite par l'histoire. */
export interface Connexion {
  compte: string;
  tty: string;
  depuis: string;
  debut: number;
  fin: number | null;
}

// last : les connexions, de la plus récente à la plus ancienne (d'après /var/log/wtmp).
function last(jeu: Shell, args: string[]): string {
  const i = args.indexOf('-n');
  const max = i >= 0 ? Number(args[i + 1]) : Infinity;
  const comptes = args.filter((a, k) => !a.startsWith('-') && args[k - 1] !== '-n');
  const liste: Connexion[] = [...((jeu.etat.connexionsPassees ?? []) as Connexion[])]
    .filter((c) => !comptes.length || comptes.includes(c.compte))
    .sort((a, b) => b.debut - a.debut)
    .slice(0, max);
  const court = (ms: number) => dateMbox(ms).slice(0, 16);
  const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16);
  const lignes = liste.map((c) => {
    const debut = `${c.compte.padEnd(8)} ${c.tty.padEnd(12)} ${c.depuis.padEnd(16)} ${court(c.debut)}`;
    if (c.fin === null) return `${debut}   still logged in`;
    const minutes = Math.round((c.fin - c.debut) / 60_000);
    return `${debut} - ${hhmm(c.fin)}  (${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')})`;
  });
  const premier = systemd(jeu)?.journal[0]?.temps ?? 0;
  return [...lignes, '', `wtmp begins ${dateMbox(premier)}`].join('\n');
}

export const SUPERVISION: Record<string, Commande> = {
  last: { options: ['n'], lancer: ({ args, jeu }) => last(jeu, args) },
  mail: {
    propresOptions: true,
    lancer: ({ args, entree, jeu }) => {
      let sujet = '';
      let videInterdit = false;
      const adresses: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-s') sujet = args[++i] ?? '';
        else if (args[i] === '-E') videInterdit = true;
        else if (args[i].startsWith('-'))
          return jeu.erreur(`mail: illegal option -- ${args[i].slice(1)}\nUsage: mail [-EiInv] [-s subject] [-c cc-addr] [-b bcc-addr] to-addr ...`);
        else adresses.push(args[i]);
      }
      if (!adresses.length) return boite(jeu);
      const corps = (entree ?? '').replace(/\n+$/, '');
      // -E : pas de courrier vide (pratique : n'envoyer que s'il y a quelque chose à dire).
      if (!corps) {
        if (videInterdit) return '';
        jeu.erreur('Null message body; hope that\u0027s ok');
      }
      // Une machine avec Postfix (courrier.ts) : le message part par la file d'attente, vers la machine ou au-dehors.
      if (jeu.etat.courrier) {
        soumettre(jeu, jeu.qui, adresses, sujet, corps, jeu.comptes.utilisateurs[jeu.qui]?.uid ?? 1000);
        return '';
      }
      envoyer(jeu, adresses, sujet, corps);
      return '';
    },
  },
  // La page de manuel des timers (section 5), pas une commande.
  'systemd.timer': { section: 5, lancer: () => '' },
  check_disk: { dossier: PLUGINS, propresOptions: true, lancer: ({ args, jeu }) => checkDisk(jeu, args) },
  check_http: { dossier: PLUGINS, propresOptions: true, lancer: ({ args, jeu }) => checkHttp(jeu, args) },
  check_procs: { dossier: PLUGINS, propresOptions: true, lancer: ({ args, jeu }) => checkProcs(jeu, args) },
};
