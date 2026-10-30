// Les commandes du courrier : postconf, postfix, postqueue, mailq, postsuper
// (Postfix) et opendkim-genkey, opendkim-testkey (OpenDKIM). Messages
// d'après postconf(1), postfix(1), postqueue(1), postsuper(1),
// opendkim-genkey(8) et opendkim-testkey(8). Le moteur est dans courrier.ts.
// Écarts : postconf ne connaît qu'une partie des paramètres ; postfix
// start/stop/reload passent par systemd ; opendkim-testkey interroge le
// serveur DNS de la machine.

import type { Shell } from '../shell';
import type { Commande } from './index';
import { demarrer, arreter, recharger, systemd } from '../systemd';
import { dns, interroger, texteTxt } from '../dns';
import {
  afficherFile,
  balises,
  clePrivee,
  clePublique,
  courrier,
  enregistrementDkim,
  journaliser,
  lireDkim,
  lireMainCf,
  MAIN_CF,
  OPENDKIM_CONF,
  parametre,
  PARAMETRES,
  vider,
} from '../courrier';

const reserve = (jeu: Shell, programme: string) => jeu.erreur(`${programme}: fatal: use of this command is reserved for the superuser`);

// postconf : lire et changer main.cf.
function postconf(jeu: Shell, args: string[]): string {
  const options = new Set(args.filter((a) => /^-[a-zA-Z]+$/.test(a)).flatMap((a) => [...a.slice(1)]));
  const inconnue = [...options].find((o) => !'ndxeh'.includes(o));
  if (inconnue) return jeu.erreur(`postconf: invalid option -- '${inconnue}'\npostconf: fatal: usage: postconf [-abCdfhHlmMnoPtTvx] [-c config_dir] [-e] [-#] [parameter ...]`);
  const noms = args.filter((a) => !a.startsWith('-'));
  const texte = jeu.lire(MAIN_CF) ?? '';
  const { valeurs, inconnus, ordre } = lireMainCf(texte);
  // nom=valeur (avec ou sans -e) : on modifie main.cf.
  const changements = noms.filter((n) => n.includes('='));
  if (changements.length) {
    if (jeu.qui !== 'root') return jeu.erreur(`postconf: fatal: open ${MAIN_CF}.tmp: Permission denied`);
    let nouveau = texte;
    for (const c of changements) {
      const [nom, ...reste] = c.split('=');
      const ligne = `${nom.trim()} = ${reste.join('=').trim()}`;
      const re = new RegExp(`^${nom.trim()}\\s*=.*(\\n[ \\t].*)*`, 'm');
      nouveau = re.test(nouveau) ? nouveau.replace(re, ligne) : `${nouveau.replace(/\n*$/, '')}\n${ligne}\n`;
    }
    const n = jeu.trouver(MAIN_CF);
    if (n?.type === 'fichier') n.contenu = nouveau;
    return '';
  }
  const avertir = () => inconnus.forEach((n) => jeu.erreur(`postconf: warning: ${MAIN_CF}: unused parameter: ${n}=${valeurs[n]}`, 0));
  const montrer = (n: string) => `${n} = ${options.has('x') ? parametre(jeu, n) : options.has('d') ? (lireDefaut(n) ?? '') : (valeurs[n] ?? lireDefaut(n) ?? '')}`.trimEnd();
  avertir();
  if (noms.length)
    return noms
      .map((n) => {
        if (!PARAMETRES.includes(n) && !(n in valeurs)) {
          jeu.erreur(`postconf: warning: ${n}: unknown parameter`, 0);
          return null;
        }
        return options.has('h') ? (options.has('x') ? parametre(jeu, n) : (valeurs[n] ?? lireDefaut(n) ?? '')) : montrer(n);
      })
      .filter((x) => x !== null)
      .join('\n');
  if (options.has('n')) return [...ordre].sort().map(montrer).join('\n');
  return [...new Set([...PARAMETRES, ...ordre])].sort().map(montrer).join('\n');
}
const lireDefaut = (n: string) => (PARAMETRES.includes(n) ? (DEFAUTS_AFFICHES[n] ?? '') : null);
const DEFAUTS_AFFICHES: Record<string, string> = {
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
function postfix(jeu: Shell, args: string[]): string {
  const action = args.find((a) => !a.startsWith('-'));
  const sd = systemd(jeu);
  const s = sd?.services.postfix;
  if (!action) return jeu.erreur('postfix: error: usage: postfix start (or stop, reload, abort, flush, check, status, set-permissions, upgrade-configuration)');
  if (action === 'status') {
    if (s?.etat === 'active') return jeu.erreur('postfix/postfix-script: the Postfix mail system is running: PID: 1180', 0);
    return jeu.erreur('postfix/postfix-script: the Postfix mail system is not running', 1);
  }
  if (jeu.qui !== 'root') return jeu.erreur('postfix: fatal: the postfix command is reserved for the superuser');
  if (action === 'check') {
    const { valeurs, inconnus } = lireMainCf(jeu.lire(MAIN_CF) ?? '');
    for (const n of inconnus) jeu.erreur(`postconf: warning: ${MAIN_CF}: unused parameter: ${n}=${valeurs[n]}`, 0);
    return '';
  }
  if (!sd || !s) return jeu.erreur('postfix: fatal: unknown command');
  if (action === 'reload') {
    if (s.etat !== 'active') return jeu.erreur('postfix/postfix-script: fatal: the Postfix mail system is not running');
    recharger(jeu, sd, 'postfix');
    return jeu.erreur('postfix/postfix-script: refreshing the Postfix mail system', 0);
  }
  if (action === 'start') {
    if (s.etat === 'active') return jeu.erreur('postfix/postfix-script: fatal: the Postfix mail system is already running');
    demarrer(jeu, sd, 'postfix');
    return jeu.erreur('postfix/postfix-script: starting the Postfix mail system', 0);
  }
  if (action === 'stop') {
    if (s.etat !== 'active') return jeu.erreur('postfix/postfix-script: fatal: the Postfix mail system is not running');
    arreter(jeu, sd, 'postfix');
    return jeu.erreur('postfix/postfix-script: stopping the Postfix mail system', 0);
  }
  if (action === 'flush') {
    vider(jeu);
    return '';
  }
  return jeu.erreur(`postfix: fatal: unknown command: '${action}'. Usage: postfix start (or stop, reload, abort, flush, check, status, set-permissions, upgrade-configuration)`);
}

function postqueue(jeu: Shell, args: string[]): string {
  if (!courrier(jeu)) return jeu.erreur('postqueue: fatal: Queue report unavailable - mail system is down');
  const enMarche = systemd(jeu)?.services.postfix?.etat === 'active';
  if (args.includes('-p')) return enMarche ? afficherFile(jeu) : jeu.erreur('postqueue: fatal: Queue report unavailable - mail system is down');
  if (args.includes('-f')) {
    if (!enMarche) return jeu.erreur('postqueue: fatal: Cannot flush mail queue - mail system is down');
    vider(jeu);
    return '';
  }
  return jeu.erreur('postqueue: fatal: usage: postqueue -f | postqueue -i queueid | postqueue -j | postqueue -p | postqueue -s site');
}

function postsuper(jeu: Shell, args: string[]): string {
  if (jeu.qui !== 'root') return reserve(jeu, 'postsuper');
  const c = courrier(jeu);
  const i = args.indexOf('-d');
  if (i < 0 || !args[i + 1]) return jeu.erreur('postsuper: fatal: usage: postsuper [-c config_dir] [-d queue_id (delete)] [-h queue_id (hold)] [-H queue_id (un-hold)] [-p (purge temporary files)] [-r queue_id (requeue)] [-s (structure fix)] [-S (structure fix)] [-v (verbose)] [queue...]');
  if (!c) return '';
  const cible = args[i + 1];
  const supprimes = c.file.filter((m) => cible === 'ALL' || m.id === cible);
  c.file = c.file.filter((m) => !supprimes.includes(m));
  for (const m of supprimes) journaliser(jeu, 'postfix/postsuper', `${m.id}: removed`);
  const lignes = supprimes.map((m) => `postsuper: ${m.id}: removed`);
  if (supprimes.length) lignes.push(`postsuper: Deleted: ${supprimes.length} message${supprimes.length > 1 ? 's' : ''}`);
  return jeu.erreur(lignes.join('\n'), 0);
}

// opendkim-genkey : une paire de clés, NOM.private et NOM.txt (l'enregistrement à publier).
function genkey(jeu: Shell, args: string[]): string {
  let bits = 2048;
  let domaine = 'example.com';
  let dossier = '.';
  let selecteur = 'default';
  let verbeux = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const valeur = () => args[++i] ?? '';
    if (a === '-b' || a === '--bits') bits = Number(valeur());
    else if (a.startsWith('--bits=')) bits = Number(a.slice(7));
    else if (a === '-d' || a === '--domain') domaine = valeur();
    else if (a.startsWith('--domain=')) domaine = a.slice(9);
    else if (a === '-D' || a === '--directory') dossier = valeur();
    else if (a.startsWith('--directory=')) dossier = a.slice(12);
    else if (a === '-s' || a === '--selector') selecteur = valeur();
    else if (a.startsWith('--selector=')) selecteur = a.slice(11);
    else if (a === '-v' || a === '--verbose') verbeux = true;
    else if (a === '-r' || a === '--restrict') continue;
    else return jeu.erreur(`opendkim-genkey: unknown option '${a}'\nUsage: opendkim-genkey [options]`);
  }
  if (!Number.isInteger(bits) || bits < 1024) return jeu.erreur(`opendkim-genkey: invalid key size ${bits}`);
  const lieu = jeu.resoudre(dossier);
  if (jeu.trouver(lieu)?.type !== 'dossier') return jeu.erreur(`opendkim-genkey: ${dossier}: No such file or directory`);
  const c = courrier(jeu);
  const tirage = (jeu.etat.clesDkim = (jeu.etat.clesDkim ?? 0) + 1);
  const privee = clePrivee(`${domaine}:${selecteur}:${bits}:${tirage}:${c?.ip ?? ''}`, bits);
  const sortie: string[] = [];
  if (verbeux) sortie.push('opendkim-genkey: generating private key');
  const erreur = jeu.placer('opendkim-genkey', `${lieu}/${selecteur}.private`, { type: 'fichier', contenu: privee, lignes: true, proprio: jeu.qui, groupe: jeu.qui, mode: 'rw-------' });
  if (erreur) return jeu.erreur(`opendkim-genkey: ${selecteur}.private: Permission denied`);
  if (verbeux) sortie.push(`opendkim-genkey: private key written to ${selecteur}.private`, 'opendkim-genkey: extracting public key');
  jeu.placer('opendkim-genkey', `${lieu}/${selecteur}.txt`, {
    type: 'fichier',
    contenu: enregistrementDkim(selecteur, domaine, clePublique(privee)!),
    lignes: true,
    proprio: jeu.qui,
    groupe: jeu.qui,
    mode: 'rw-r--r--',
  });
  if (verbeux) sortie.push(`opendkim-genkey: DNS TXT record written to ${selecteur}.txt`);
  return sortie.join('\n');
}

// opendkim-testkey : la clé publiée dans le DNS correspond-elle à la clé privée ?
function testkey(jeu: Shell, args: string[]): string {
  let domaine = '';
  let selecteur = '';
  let cle = '';
  let verbosite = 0;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-d') domaine = args[++i] ?? '';
    else if (a === '-s') selecteur = args[++i] ?? '';
    else if (a === '-k') cle = args[++i] ?? '';
    else if (/^-v+$/.test(a)) verbosite += a.length - 1;
    else return jeu.erreur(`opendkim-testkey: invalid option -- '${a.replace(/^-+/, '')}'\nusage: opendkim-testkey [options]`);
  }
  const lignes: string[] = [];
  const conf = lireDkim(jeu.lire(OPENDKIM_CONF) ?? '');
  if (!cle && jeu.trouver(OPENDKIM_CONF)) {
    if (verbosite >= 3) lignes.push(`opendkim-testkey: using default configfile ${OPENDKIM_CONF}`);
    cle = conf.cle ?? '';
    domaine ||= conf.domaines[0] ?? '';
    selecteur ||= conf.selecteur ?? '';
  }
  if (!domaine || !selecteur) return jeu.erreur('opendkim-testkey: selector and domain must be specified');
  const nom = `${selecteur}._domainkey.${domaine}`;
  if (verbosite >= 2) lignes.push(`opendkim-testkey: checking key '${nom}'`);
  // Le résolveur de la machine (le serveur DNS local).
  const d = dns(jeu);
  const r = d ? interroger(jeu, 'primaire', nom, 'TXT', systemd(jeu)?.horloge ?? 0) : null;
  const enregistrement = r?.reponses.filter((x) => x.type === 'TXT').map((x) => texteTxt(x.donnees))[0];
  if (!enregistrement) return jeu.erreur([...lignes, `opendkim-testkey: '${nom}' record not found`].join('\n'));
  const p = balises(enregistrement).p;
  if (!p) return jeu.erreur([...lignes, `opendkim-testkey: '${nom}' key revoked`].join('\n'));
  if (cle) {
    const n = jeu.trouver(cle);
    if (!n || n.type !== 'fichier') return jeu.erreur([...lignes, `opendkim-testkey: ${cle}: open(): No such file or directory`].join('\n'));
    if (!jeu.peut(n, 'r')) return jeu.erreur([...lignes, `opendkim-testkey: ${cle}: open(): Permission denied`].join('\n'));
    if (clePublique(jeu.lire(cle) ?? '') !== p) return jeu.erreur([...lignes, 'opendkim-testkey: key data does not match private key'].join('\n'));
  }
  // Sans DNSSEC, opendkim-testkey dit toujours « key not secure » : ce n'est pas une erreur.
  if (verbosite >= 1) lignes.push('opendkim-testkey: key not secure', 'opendkim-testkey: key OK');
  return lignes.join('\n');
}

export const COURRIER: Record<string, Commande> = {
  postconf: { section: 1, propresOptions: true, lancer: ({ args, jeu }) => postconf(jeu, args) },
  postfix: { section: 1, propresOptions: true, lancer: ({ args, jeu }) => postfix(jeu, args) },
  postqueue: { section: 1, propresOptions: true, lancer: ({ args, jeu }) => postqueue(jeu, args) },
  mailq: { section: 1, propresOptions: true, lancer: ({ jeu }) => postqueue(jeu, ['-p']) },
  postsuper: { section: 1, propresOptions: true, lancer: ({ args, jeu }) => postsuper(jeu, args) },
  'opendkim-genkey': { section: 8, propresOptions: true, lancer: ({ args, jeu }) => genkey(jeu, args) },
  'opendkim-testkey': { section: 8, propresOptions: true, lancer: ({ args, jeu }) => testkey(jeu, args) },
};
