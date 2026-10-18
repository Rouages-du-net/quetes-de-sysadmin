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
import { recharger, systemd, versUtc } from '../systemd';
import { requete } from '../nginx';
import { dateCertbot, dateOpenssl, DUREE, lire, pem, sujet, type Certificat } from '../tls';
import { verifierCertificat } from './reseau';
import type { Commande } from './index';

export const LE = '/etc/letsencrypt';
const TIRETS = '- '.repeat(40).trim();
const JOUR = 86_400_000;
const JOURNAL = 'Saving debug log to /var/log/letsencrypt/letsencrypt.log';

// ——— Fichier de renouvellement (format ConfigObj de certbot) ———

export interface Renouvellement {
  // Les lignes du début (chemins des fichiers) et celles de [renewalparams].
  entete: Record<string, string>;
  params: Record<string, string>;
  // [[webroot_map]] : le dossier du défi pour chaque nom.
  carte: Record<string, string>;
}

export function lireRenouvellement(texte: string): Renouvellement {
  const r: Renouvellement = { entete: {}, params: {}, carte: {} };
  let section: Record<string, string> = r.entete;
  for (const brute of texte.split('\n')) {
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith('#')) continue;
    if (ligne === '[renewalparams]') section = r.params;
    else if (ligne === '[[webroot_map]]') section = r.carte;
    else if (ligne.startsWith('[')) section = {};
    else {
      const i = ligne.indexOf('=');
      if (i > 0) section[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
    }
  }
  return r;
}

export function ecrireRenouvellement(r: Renouvellement): string {
  const lignes = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k} = ${v}`);
  return [
    '# renew_before_expiry = 30 days',
    ...lignes(r.entete),
    '',
    '# Options used in the renewal process',
    '[renewalparams]',
    ...lignes(r.params),
    ...(Object.keys(r.carte).length ? ['[[webroot_map]]', ...lignes(r.carte)] : []),
  ].join('\n');
}

// ——— Le certificat géré ———

const fichiers = (nom: string) => ({
  conf: `${LE}/renewal/${nom}.conf`,
  cert: `${LE}/live/${nom}/cert.pem`,
  chaine: `${LE}/live/${nom}/chain.pem`,
  complet: `${LE}/live/${nom}/fullchain.pem`,
  cle: `${LE}/live/${nom}/privkey.pem`,
});

/** Le certificat intermédiaire de Let's Encrypt (pour chain.pem). */
export const INTERMEDIAIRE = pem({
  cn: 'E6',
  noms: [],
  emetteur: 'C=US, O=Internet Security Research Group, CN=ISRG Root X1',
  serie: 'b0573e9173972770dbb487cb3a452b38',
  debut: Date.UTC(2024, 2, 13),
  fin: Date.UTC(2027, 2, 12, 23, 59, 59),
});

/** Une clé privée ECDSA (factice), au format PEM. */
export const clePrivee = (graine: string) =>
  ['-----BEGIN PRIVATE KEY-----', ...btoa(`quetes-cle:${graine}:`.padEnd(138, '0')).match(/.{1,64}/g)!, '-----END PRIVATE KEY-----'].join('\n');

/** Les fichiers d'un certificat, à poser dans live/<nom>/. */
export function fichiersCertificat(c: Certificat) {
  const cert = pem(c);
  return { 'cert.pem': cert, 'chain.pem': INTERMEDIAIRE, 'fullchain.pem': `${cert}\n${INTERMEDIAIRE}`, 'privkey.pem': clePrivee(c.serie) };
}

const maintenant = (jeu: Shell) => versUtc(systemd(jeu)?.horloge ?? 0);

// Le nom du certificat géré : le seul fichier de renewal/.
function certificatGere(jeu: Shell): string | null {
  const n = jeu.trouver(`${LE}/renewal`);
  if (n?.type !== 'dossier') return null;
  return (
    Object.keys(n.enfants)
      .find((f) => f.endsWith('.conf'))
      ?.replace(/\.conf$/, '') ?? null
  );
}

// ——— Options de la ligne de commande ———

interface Options {
  dryRun: boolean;
  force: boolean;
  webroot: boolean;
  chemins: string[];
  domaines: string[];
  hook: string | null;
  nomCert: string | null;
  plugin: 'nginx' | 'standalone' | null;
  inconnue: string | null;
}

function analyser(args: string[]): Options {
  const o: Options = {
    dryRun: false,
    force: false,
    webroot: false,
    chemins: [],
    domaines: [],
    hook: null,
    nomCert: null,
    plugin: null,
    inconnue: null,
  };
  for (let i = 0; i < args.length; i++) {
    const [a, egal] =
      args[i].startsWith('--') && args[i].includes('=')
        ? [args[i].slice(0, args[i].indexOf('=')), args[i].slice(args[i].indexOf('=') + 1)]
        : [args[i], undefined];
    const valeur = () => egal ?? args[++i] ?? '';
    if (a === '--dry-run') o.dryRun = true;
    else if (a === '--force-renewal' || a === '--renew-by-default') o.force = true;
    else if (a === '--webroot') o.webroot = true;
    else if (a === '-w' || a === '--webroot-path') o.chemins.push(valeur().replace(/\/$/, ''));
    else if (a === '-d' || a === '--domains' || a === '--domain') o.domaines.push(...valeur().split(',').filter(Boolean));
    else if (a === '--deploy-hook' || a === '--renew-hook') o.hook = valeur();
    else if (a === '--cert-name') o.nomCert = valeur();
    else if (a === '--nginx') o.plugin = 'nginx';
    else if (a === '--standalone') o.plugin = 'standalone';
    else if (a === '-m' || a === '--email') valeur();
    // Options sans effet ici (questions, discrétion).
    else if (
      !['-n', '--non-interactive', '--agree-tos', '-q', '--quiet', '--no-random-sleep-on-renew', '--keep-until-expiring', '--keep'].includes(a)
    )
      o.inconnue ??= a;
  }
  return o;
}

// ——— Le défi HTTP-01 ———

// Le jeton du défi, comme ceux de Let's Encrypt (base64url, 43 caractères).
const jeton = (graine: string) => btoa(graine.padEnd(32, '-')).replace(/[+/=]/g, '').slice(0, 43).padEnd(43, 'Q');

/**
 * L'autorité vient chercher le défi de chaque nom, sur le port 80. Renvoie
 * les erreurs au format de certbot (vide : tout est bon). `effets` : sinon,
 * on ne fait que vérifier (pas de fichier déposé, rien d'écrit).
 */
export function defis(jeu: Shell, r: Renouvellement, noms: string[], essai: number): string[] {
  const erreurs: string[] = [];
  // Le module nginx de certbot sert lui-même le défi, quel que soit le dossier du site.
  if (r.params.authenticator === 'nginx') return jeu.trouver('/usr/lib/python3/dist-packages/certbot_nginx') ? [] : ['plugin'];
  for (const nom of noms) {
    const dossier = (r.carte[nom] ?? r.params.webroot_path ?? '').replace(/,$/, '').replace(/\/$/, '');
    const lieu = jeu.trouver(dossier);
    if (!dossier || lieu?.type !== 'dossier') {
      erreurs.push(`webroot:${dossier}`);
      continue;
    }
    const t = jeton(`${nom}-${essai}`);
    const chemin = `/.well-known/acme-challenge/${t}`;
    // certbot (root) crée les dossiers et dépose le fichier, lisible par tous.
    const avant = jeu.qui;
    jeu.qui = 'root';
    let lieuDefi = dossier;
    for (const p of ['.well-known', 'acme-challenge']) {
      lieuDefi = `${lieuDefi}/${p}`;
      if (!jeu.existe(lieuDefi)) jeu.placer('certbot', lieuDefi, { type: 'dossier', enfants: {}, proprio: 'root' });
    }
    jeu.placer('certbot', dossier + chemin, { type: 'fichier', contenu: `${t}.cle-du-compte`, proprio: 'root', lignes: true });
    const reponse = requete(jeu, nom, chemin, 80);
    jeu.effacer(dossier + chemin);
    jeu.qui = avant;
    if (!reponse) erreurs.push(`  Domain: ${nom}\n  Type:   connection\n  Detail: 192.0.2.11: Fetching http://${nom}${chemin}: Connection refused`);
    else if (reponse.code !== 200 || reponse.corps !== `${t}.cle-du-compte`)
      erreurs.push(`  Domain: ${nom}\n  Type:   unauthorized\n  Detail: 192.0.2.11: Invalid response from http://${nom}${chemin}: ${reponse.code}`);
  }
  return erreurs;
}

/** Le renouvellement automatique (celui du timer) réussirait-il, avec la configuration actuelle ? */
export function renouvellementPossible(jeu: Shell): boolean {
  const nom = certificatGere(jeu);
  if (!nom) return false;
  const r = lireRenouvellement(jeu.lire(fichiers(nom).conf) ?? '');
  const c = lire(jeu.lire(fichiers(nom).complet));
  return !!c && defis(jeu, r, c.noms, 0).length === 0;
}

// Ce qui relance nginx dans une commande ou un script.
const RECHARGE = /(systemctl\s+(reload|restart|reload-or-restart)\s+nginx|nginx\s+-s\s+reload|service\s+nginx\s+(reload|restart))/;

/** Après un renouvellement, nginx sera-t-il rechargé tout seul (deploy hook, ou module nginx) ? */
export function rechargementAutomatique(jeu: Shell): boolean {
  const nom = certificatGere(jeu);
  if (!nom) return false;
  const r = lireRenouvellement(jeu.lire(fichiers(nom).conf) ?? '');
  if (r.params.installer === 'nginx' || RECHARGE.test(r.params.renew_hook ?? '')) return true;
  return scriptsDeploiement(jeu).some((s) => s.executable && RECHARGE.test(s.contenu));
}

function scriptsDeploiement(jeu: Shell) {
  const dossier = `${LE}/renewal-hooks/deploy`;
  const n = jeu.trouver(dossier);
  if (n?.type !== 'dossier') return [];
  return Object.keys(n.enfants)
    .sort()
    .map((nom) => {
      const f = n.enfants[nom];
      return {
        chemin: `${dossier}/${nom}`,
        executable: f.type === 'fichier' && (f.mode ?? 'rw-r--r--')[2] === 'x',
        contenu: jeu.lire(`${dossier}/${nom}`) ?? '',
      };
    });
}

// Lance les deploy hooks (en root, comme certbot), et le rechargement du module nginx.
function deployer(jeu: Shell, r: Renouvellement, sec: boolean): string[] {
  const lignes: string[] = [];
  const executer = (commande: string) => {
    const avant = jeu.qui;
    jeu.qui = 'root';
    try {
      const sortie = jeu.executerTache(commande);
      if (sortie) lignes.push(`Output from deploy-hook command ${commande.split(/\s+/)[0]}:`, sortie);
    } finally {
      jeu.qui = avant;
    }
  };
  for (const s of scriptsDeploiement(jeu)) {
    if (!s.executable) lignes.push(`Skipping deploy-hook '${s.chemin}' as it is not executable.`);
    else if (sec) lignes.push(`Dry run: skipping deploy hook command: ${s.chemin}`);
    else {
      lignes.push(`Running deploy-hook command: ${s.chemin}`);
      for (const l of s.contenu.split('\n').map((x) => x.trim())) if (l && !l.startsWith('#')) executer(l);
    }
  }
  if (r.params.renew_hook) {
    if (sec) lignes.push(`Dry run: skipping deploy hook command: ${r.params.renew_hook}`);
    else {
      lignes.push(`Running deploy-hook command: ${r.params.renew_hook}`);
      executer(r.params.renew_hook);
    }
  }
  const sd = systemd(jeu);
  if (!sec && r.params.installer === 'nginx' && sd?.services.nginx?.etat === 'active') recharger(jeu, sd, 'nginx');
  return lignes;
}

// Un nouveau certificat de 90 jours (Let's Encrypt antidate d'une heure).
function emettre(jeu: Shell, nom: string, ancien: Certificat) {
  const debut = Math.floor((maintenant(jeu) - 3600_000) / 1000) * 1000;
  const n = (jeu.etat.certbotEmis = (jeu.etat.certbotEmis ?? 0) + 1);
  // Un nouveau numéro de série (hexadécimal, tiré du précédent).
  const serie = [...`${ancien.serie}${n}`].reduce((h, car) => Math.imul(h ^ car.charCodeAt(0), 0x01000193) >>> 0, 0x811c9dc5);
  const serieHex = Array.from({ length: 5 }, (_, i) => ((Math.imul(serie, i + 7) >>> 0) ^ (serie >>> i)).toString(16).padStart(8, '0'))
    .join('')
    .slice(0, 36);
  const c: Certificat = { ...ancien, serie: `0${serieHex.slice(1)}`, debut, fin: debut + DUREE - 1000 };
  const f = fichiers(nom);
  const contenus = fichiersCertificat(c);
  const avant = jeu.qui;
  jeu.qui = 'root';
  for (const [fichier, texte] of Object.entries(contenus)) {
    const chemin = { 'cert.pem': f.cert, 'chain.pem': f.chaine, 'fullchain.pem': f.complet, 'privkey.pem': f.cle }[fichier]!;
    const ancienNoeud = jeu.trouver(chemin);
    jeu.placer('certbot', chemin, {
      type: 'fichier',
      contenu: texte,
      lignes: true,
      proprio: 'root',
      mode: ancienNoeud?.mode ?? (fichier === 'privkey.pem' ? 'rw-------' : 'rw-r--r--'),
    });
  }
  jeu.qui = avant;
  return c;
}

const listeNoms = (noms: string[]) => (noms.length > 1 ? `${noms.slice(0, -1).join(', ')} and ${noms.at(-1)}` : noms[0]);

/**
 * Un renouvellement (renew, certonly, reconfigure, ou le timer) : renvoie la
 * sortie, et si c'est réussi. `cli` : les options de la ligne de commande,
 * qui remplacent celles du fichier (et y sont enregistrées si ça réussit).
 */
function renouveler(
  jeu: Shell,
  nom: string,
  o: Options,
  mode: 'renew' | 'certonly' | 'reconfigure',
): { lignes: string[]; ok: boolean; erreur?: string } {
  const f = fichiers(nom);
  const ancien = lire(jeu.lire(f.complet));
  const texte = jeu.lire(f.conf);
  if (!ancien || texte === null) return { lignes: [], ok: false, erreur: `Renewal configuration file ${f.conf} is broken.` };
  const r = lireRenouvellement(texte);
  // Les options données ici remplacent celles du fichier.
  const nouveau: Renouvellement = { entete: { ...r.entete }, params: { ...r.params }, carte: { ...r.carte } };
  if (o.plugin === 'nginx') {
    nouveau.params.authenticator = 'nginx';
    nouveau.params.installer = 'nginx';
    nouveau.carte = {};
    delete nouveau.params.webroot_path;
  } else if (o.chemins.length) {
    nouveau.params.authenticator = 'webroot';
    nouveau.params.webroot_path = `${o.chemins.join(', ')},`;
    // -w s'applique aux -d qui le suivent ; sans -d, à tous les noms.
    nouveau.carte = Object.fromEntries(ancien.noms.map((n) => [n, o.chemins.at(-1)!]));
  }
  if (o.hook !== null) nouveau.params.renew_hook = o.hook;
  const due = ancien.fin - maintenant(jeu) < 30 * JOUR;
  const lignes: string[] = [];
  if (mode === 'renew') lignes.push(TIRETS, `Processing ${f.conf}`, TIRETS);
  if (!due && !o.force && !o.dryRun && mode !== 'reconfigure') {
    if (mode === 'certonly') return { lignes: ['Certificate not yet due for renewal; no action taken.'], ok: true };
    lignes.push(
      `Certificate not yet due for renewal`,
      '',
      TIRETS,
      'The following certificates are not due for renewal yet:',
      `  ${f.complet} expires on ${dateCertbot(ancien.fin).slice(0, 10)} (skipped)`,
      'No renewals were attempted.',
      TIRETS,
    );
    return { lignes, ok: true };
  }
  const sec = o.dryRun || mode === 'reconfigure';
  lignes.push(`${sec ? 'Simulating renewal of' : 'Renewing'} an existing certificate for ${listeNoms(ancien.noms)}`);
  const erreurs = defis(jeu, nouveau, ancien.noms, (jeu.etat.certbotEssais = (jeu.etat.certbotEssais ?? 0) + 1));
  if (erreurs.includes('plugin')) return { lignes: [], ok: false, erreur: 'The requested nginx plugin does not appear to be installed' };
  const absent = erreurs.find((e) => e.startsWith('webroot:'));
  if (absent) return { lignes, ok: false, erreur: `--webroot-path ${absent.slice(8) || '(none)'} does not exist or is not a directory` };
  if (erreurs.length) {
    jeu.etat.certbotDefiEchoue = true;
    lignes.push(
      '',
      `Certbot failed to authenticate some domains (authenticator: ${nouveau.params.authenticator}). The Certificate Authority reported these problems:`,
      ...erreurs,
      '',
      'Hint: The Certificate Authority failed to download the temporary challenge files created by Certbot. Ensure that the listed domains serve their content from the provided --webroot-path/-w and that files created there can be downloaded from the internet.',
      '',
    );
    if (mode === 'renew')
      lignes.push(
        `Failed to renew certificate ${nom} with error: Some challenges have failed.`,
        '',
        TIRETS,
        `All ${sec ? 'simulated renewals' : 'renewals'} failed. The following certificates could not be renewed:`,
        `  ${f.complet} (failure)`,
        TIRETS,
        '1 renew failure(s), 0 parse failure(s)',
      );
    else lignes.push('Some challenges have failed.');
    lignes.push(
      'Ask for help or search for solutions at https://community.letsencrypt.org. See the logfile /var/log/letsencrypt/letsencrypt.log or re-run Certbot with -v for more details.',
    );
    return { lignes, ok: false };
  }
  if (!sec) emettre(jeu, nom, ancien);
  // Réussi : certbot réécrit le fichier de renouvellement avec les options utilisées.
  if (!o.dryRun) {
    const avant = jeu.qui;
    jeu.qui = 'root';
    const n = jeu.trouver(f.conf);
    if (n?.type === 'fichier') n.contenu = ecrireRenouvellement(nouveau);
    jeu.qui = avant;
  }
  const hooks = deployer(jeu, nouveau, sec);
  if (mode === 'reconfigure') lignes.push('', ...hooks, 'Successfully updated configuration.', 'Changes will apply when the certificate renews.');
  else if (mode === 'certonly' && !sec) {
    const c = lire(jeu.lire(f.complet))!;
    lignes.push(
      '',
      'Successfully received certificate.',
      `Certificate is saved at: ${f.complet}`,
      `Key is saved at:         ${f.cle}`,
      `This certificate expires on ${dateCertbot(c.fin).slice(0, 10)}.`,
      'These files will be updated when the certificate renews.',
      'Certbot has set up a scheduled task to automatically renew this certificate in the background.',
      ...hooks,
    );
  } else if (mode === 'certonly') lignes.push('The dry run was successful.', ...hooks);
  else
    lignes.push(
      ...hooks,
      '',
      TIRETS,
      `Congratulations, all ${sec ? 'simulated renewals' : 'renewals'} succeeded: `,
      `  ${f.complet} (success)`,
      TIRETS,
    );
  return { lignes, ok: true };
}

/** Pour systemd : le service certbot (lancé par certbot.timer) renouvelle ce qui doit l'être. */
export function serviceCertbot(jeu: Shell): string[] | null {
  const nom = certificatGere(jeu);
  if (!nom) return null;
  const avant = jeu.qui;
  jeu.qui = 'root';
  try {
    const { lignes, ok, erreur } = renouveler(jeu, nom, analyser([]), 'renew');
    if (ok) return null;
    return [erreur ?? lignes.find((l) => l.startsWith('Failed to renew')) ?? 'Some challenges have failed.'];
  } finally {
    jeu.qui = avant;
  }
}

export const CERTBOT: Record<string, Commande> = {
  certbot: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      if (!jeu.trouver('/usr/bin/certbot')) return jeu.erreur(jeu.t('commande-introuvable', { commande: 'certbot' }));
      const [action = 'run', ...reste] = args[0]?.startsWith('-') ? ['run', ...args] : args;
      const o = analyser(reste);
      if (o.inconnue)
        return jeu.erreur(
          `usage: \n  certbot [SUBCOMMAND] [options] [-d DOMAIN] [-d DOMAIN] ...\n\ncertbot: error: unrecognized arguments: ${o.inconnue}`,
        );
      if (jeu.qui !== 'root')
        return jeu.erreur(
          "The following error was encountered:\n[Errno 13] Permission denied: '/var/log/letsencrypt/.certbot.lock'\nEither run as root, or set --config-dir, --work-dir, and --logs-dir to writeable paths.",
        );
      const nom = certificatGere(jeu);
      if (action === 'certificates') {
        if (!nom) return `${JOURNAL}\nNo certificates found.`;
        const f = fichiers(nom);
        const c = lire(jeu.lire(f.complet));
        if (!c) return jeu.erreur(`${JOURNAL}\nRenewal configuration file ${f.conf} produced an unexpected error: the certificate cannot be read.`);
        const reste = c.fin - maintenant(jeu);
        const validite = reste <= 0 ? 'INVALID: EXPIRED' : `VALID: ${Math.floor(reste / JOUR)} day${Math.floor(reste / JOUR) === 1 ? '' : 's'}`;
        return [
          JOURNAL,
          '',
          TIRETS,
          'Found the following certs:',
          `  Certificate Name: ${nom}`,
          `    Serial Number: ${c.serie.replace(/^0+/, '')}`,
          '    Key Type: ECDSA',
          `    Domains: ${c.noms.join(' ')}`,
          `    Expiry Date: ${dateCertbot(c.fin)} (${validite})`,
          `    Certificate Path: ${f.complet}`,
          `    Private Key Path: ${f.cle}`,
          TIRETS,
        ].join('\n');
      }
      if (action === 'renew' || action === 'certonly' || action === 'reconfigure') {
        if (o.plugin === 'standalone')
          return jeu.erreur(
            `${JOURNAL}\nCould not bind TCP port 80 because it is already in use by another process on this system (such as a web server). Please stop the program in question and then try again.`,
          );
        if (!nom) return jeu.erreur(`${JOURNAL}\n${jeu.t('certbot-aucun-certificat')}`);
        if (action === 'certonly') {
          if (!o.plugin && !o.webroot && !o.chemins.length) return jeu.erreur(`${JOURNAL}\n${jeu.t('certbot-authentificateur')}`);
          if (o.webroot && !o.chemins.length) return jeu.erreur(`${JOURNAL}\n${jeu.t('certbot-webroot-sans-chemin')}`);
          const c = lire(jeu.lire(fichiers(nom).complet));
          const voulus = [...new Set(o.domaines.map((d) => d.toLowerCase()))].sort();
          if (!voulus.length) return jeu.erreur(`${JOURNAL}\n${jeu.t('certbot-sans-domaine')}`);
          if (c && voulus.join(' ') !== [...c.noms].sort().join(' '))
            return jeu.erreur(`${JOURNAL}\n${jeu.t('certbot-autres-domaines', { noms: c.noms.join(', ') })}`);
        }
        if (action === 'reconfigure' && o.nomCert && o.nomCert !== nom)
          return jeu.erreur(`${JOURNAL}\nThe certificate name ${o.nomCert} was not found.`);
        const { lignes, ok, erreur } = renouveler(jeu, nom, o, action);
        if (erreur) return jeu.erreur([JOURNAL, ...lignes, erreur].join('\n'));
        const sortie = [JOURNAL, '', ...lignes].join('\n');
        return ok ? sortie : jeu.erreur(sortie);
      }
      return jeu.erreur(jeu.t('certbot-usage'));
    },
  },

  openssl: {
    propresOptions: true,
    lancer: ({ args, entree, jeu }) => {
      const [sous, ...reste] = args;
      if (sous === 'version') return 'OpenSSL 3.5.1 1 Jul 2025 (Library: OpenSSL 3.5.1 1 Jul 2025)';
      if (sous === 'x509') {
        let fichier: string | null = null;
        let finDans: number | null = null;
        const demandes: string[] = [];
        let sansTexte = false;
        for (let i = 0; i < reste.length; i++) {
          const a = reste[i];
          if (a === '-in') fichier = reste[++i] ?? '';
          else if (a === '-checkend') finDans = Number(reste[++i]);
          else if (a === '-noout') sansTexte = true;
          else if (['-dates', '-enddate', '-startdate', '-subject', '-issuer', '-serial', '-ext'].includes(a)) {
            demandes.push(a);
            if (a === '-ext') i++;
          } else return jeu.erreur(`x509: Unknown option or message digest: ${a.replace(/^-/, '')}\nx509: Use -help for summary.`);
        }
        let texte = entree;
        if (fichier !== null) {
          const n = jeu.trouver(fichier);
          if (!n || n.type !== 'fichier')
            return jeu.erreur(`Could not open file or uri for loading certificate from ${fichier}: No such file or directory`);
          if (!jeu.traverse(fichier) || !jeu.peut(n, 'r'))
            return jeu.erreur(`Could not open file or uri for loading certificate from ${fichier}: Permission denied`);
          texte = jeu.lire(fichier);
        }
        const c = lire(texte);
        if (!c) return jeu.erreur('Could not find certificate from <stdin>\nUnable to load certificate'.replace('<stdin>', fichier ?? '<stdin>'));
        const lignes: string[] = [];
        for (const d of demandes) {
          if (d === '-dates' || d === '-startdate') lignes.push(`notBefore=${dateOpenssl(c.debut)}`);
          if (d === '-dates' || d === '-enddate') lignes.push(`notAfter=${dateOpenssl(c.fin)}`);
          if (d === '-subject') lignes.push(`subject=${sujet(c)}`);
          if (d === '-issuer') lignes.push(`issuer=${c.emetteur}`);
          if (d === '-serial') lignes.push(`serial=${c.serie.toUpperCase()}`);
          if (d === '-ext') lignes.push('X509v3 Subject Alternative Name: ', `    ${c.noms.map((n) => `DNS:${n}`).join(', ')}`);
        }
        if (finDans !== null) {
          const expire = c.fin < maintenant(jeu) + finDans * 1000;
          lignes.push(expire ? 'Certificate will expire' : 'Certificate will not expire');
        }
        if (!sansTexte) lignes.push(pem(c));
        return lignes.filter((l) => l !== '').join('\n');
      }
      if (sous === 's_client') {
        let cible = '';
        let sni: string | null = null;
        for (let i = 0; i < reste.length; i++) {
          if (reste[i] === '-connect') cible = reste[++i] ?? '';
          else if (reste[i] === '-servername') sni = reste[++i] ?? '';
          else if (!['-showcerts', '-quiet', '-brief'].includes(reste[i]))
            return jeu.erreur(`s_client: Unknown option: ${reste[i]}\ns_client: Use -help for summary.`);
        }
        const [hote, port = '443'] = cible.split(':');
        if (!hote) return jeu.erreur('s_client: -connect host:port is required');
        const nomsLocaux = ['localhost', '127.0.0.1', ...(jeu.etat.nginx?.noms ?? [])];
        if (!nomsLocaux.includes(hote.toLowerCase())) return jeu.erreur(`BIO_lookup_ex: ${hote}: Name or service not known\nconnect:errno=0`);
        const r = requete(jeu, sni ?? hote, '/', Number(port));
        if (!r?.certificat) return jeu.erreur(`connect to ${hote} port ${port} failed: Connection refused\nconnect:errno=111`);
        const c = lire(r.certificat)!;
        const probleme = verifierCertificat(jeu, r.certificat, sni ?? hote);
        const code = !probleme
          ? '0 (ok)'
          : probleme.includes('expired')
            ? '10 (certificate has expired)'
            : probleme.includes('not yet')
              ? '9 (certificate is not yet valid)'
              : '62 (hostname mismatch)';
        return [
          'CONNECTED(00000003)',
          `depth=0 ${sujet(c)}`,
          ...(probleme?.includes('expired') ? ['verify error:num=10:certificate has expired', `notAfter=${dateOpenssl(c.fin)}`] : []),
          'verify return:1',
          '---',
          'Certificate chain',
          ` 0 s:${sujet(c)}`,
          `   i:${c.emetteur}`,
          '   a:PKEY: id-ecPublicKey, 256 (bit); sigalg: ecdsa-with-SHA384',
          `   v:NotBefore: ${dateOpenssl(c.debut)}; NotAfter: ${dateOpenssl(c.fin)}`,
          '---',
          'Server certificate',
          pem(c),
          `subject=${sujet(c)}`,
          `issuer=${c.emetteur}`,
          '---',
          'SSL handshake has read 2563 bytes and written 404 bytes',
          `Verify return code: ${code}`,
          '---',
          'DONE',
        ].join('\n');
      }
      if (!sous) return jeu.erreur(jeu.t('openssl-usage'));
      return jeu.erreur(`Invalid command '${sous}'; type "help" for a list.`);
    },
  },
};

// Pour les chapitres : le certificat présenté par nginx pour ce nom est-il bon maintenant ?
export const certificatServiBon = (jeu: Shell, nom: string) => {
  const r = requete(jeu, nom, '/', 443);
  return !!r?.certificat && verifierCertificat(jeu, r.certificat, nom) === null;
};
