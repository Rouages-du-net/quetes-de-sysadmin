// nft (nftables), sysctl (procps-ng) et conntrack (conntrack-tools), sur le
// routeur simulé (../nftables.ts, ../lan.ts). Sorties en anglais, comme les
// vrais outils.
// Sources : https://www.netfilter.org/projects/nftables/manpage.html,
// https://man7.org/linux/man-pages/man8/sysctl.8.html,
// https://man7.org/linux/man-pages/man5/sysctl.d.5.html,
// https://manpages.debian.org/trixie/conntrack/conntrack.8.en.html

import type { Jeu, Shell } from '../shell';
import type { Noeud } from '../monde';
import { afficher, avecCompteurs, ErreurNft, executerNft, formaterErreur, journaliserTrafic, nft, resultats } from '../nftables';
import { lan } from '../lan';
import { apercuSeulement, tablesApercu } from '../apercu-nft';
import { POSTE } from '../machines';
import type { Commande } from './index';
import { aide } from './manuel';

const NON_PERMIS_NFT = 'netlink: Error: cache initialization failed: Operation not permitted';
const CONNTRACK = 'conntrack v1.4.8 (conntrack-tools)';

function nftCommande(jeu: Shell, args: string[]): string {
  const options: string[] = [];
  let fichier: string | null = null;
  const reste: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (reste.length) reste.push(a);
    else if (a === '-f' || a === '--file') fichier = args[++i] ?? '';
    else if (/^-[a-zA-Z]+$/.test(a)) options.push(...a.slice(1));
    else if (a.startsWith('--')) options.push(a);
    else reste.push(a);
  }
  if (options.includes('h')) return aide('nft', NFTABLES.nft, jeu.t);
  if (options.includes('--version') || options.includes('v')) return 'nftables v1.1.3 (Commodore Bullseye #4)';
  const inconnue = options.find((o) => !['c', 'a', 'n', 's', 'e', '--check', '--handle', '--numeric', '--echo'].includes(o));
  if (inconnue) return jeu.erreur(`nft: invalid option -- '${inconnue.replace(/^-+/, '')}'\nTry \`nft -h' for more information.`, 1);
  const verifier = options.includes('c') || options.includes('--check');
  const poignees = options.includes('a') || options.includes('--handle');
  if (fichier === null && !reste.length) return jeu.erreur('Error: no command specified', 1);
  if (jeu.qui !== 'root') return jeu.erreur(NON_PERMIS_NFT, 1);
  if (apercuSeulement(jeu)) return apercu(jeu, fichier === null ? reste : []);
  let texte: string;
  let nomFichier: string | null = null;
  if (fichier !== null) {
    const lu = jeu.lire(fichier);
    if (lu === null) return jeu.erreur(`Error: Could not open file "${fichier}": No such file or directory`, 1);
    texte = lu;
    nomFichier = fichier;
  } else texte = reste.join(' '); // comme nft : les arguments mis bout à bout (le shell a déjà retiré les guillemets)
  try {
    const { ruleset, listes } = executerNft(jeu, texte, nft(jeu));
    if (verifier) return '';
    const change = JSON.stringify(ruleset) !== JSON.stringify(nft(jeu));
    jeu.etat.nft = ruleset;
    if (change) journaliserTrafic(jeu);
    const vu = listes.length ? avecCompteurs(jeu) : ruleset;
    return listes.map((l) => afficher(vu, l, poignees)).join('\n');
  } catch (e) {
    if (!(e instanceof ErreurNft)) throw e;
    const source = (e as { fichier?: string }).fichier;
    return jeu.erreur(formaterErreur(e, nomFichier, source ? (jeu.lire(source) ?? texte) : texte), 1);
  }
}

// Sur une machine où ufw et fail2ban tiennent le pare-feu : lire leurs tables, sans y toucher.
function apercu(jeu: Shell, mots: string[]): string {
  const tables = tablesApercu(jeu);
  const [verbe, objet, famille, nom] = mots;
  if (verbe === 'list' && objet === 'ruleset' && mots.length === 2) return [...tables.values()].map((t) => t.join('\n')).join('\n');
  if (verbe === 'list' && objet === 'tables' && mots.length === 2) return [...tables.keys()].map((k) => `table ${k}`).join('\n');
  if (verbe === 'list' && objet === 'table' && mots.length === 4) {
    const t = tables.get(`${famille} ${nom}`);
    return t
      ? t.join('\n')
      : jeu.erreur(`Error: No such file or directory\nlist table ${famille} ${nom}\n${' '.repeat(12 + famille.length)}${'^'.repeat(nom.length)}`, 1);
  }
  return jeu.erreur(jeu.t('nft-apercu-ufw'), 1);
}

// ——— sysctl ———

const chemin = (cle: string) => `/proc/sys/${cle.replace(/\./g, '/')}`;
const cleDe = (texte: string) =>
  texte
    .trim()
    .replace(/^\/proc\/sys\//, '')
    .replace(/\//g, '.');
// Le noyau lie ces deux clés : écrire l'une change l'autre.
const LIEES: Record<string, string> = {
  'net.ipv4.ip_forward': 'net.ipv4.conf.all.forwarding',
  'net.ipv4.conf.all.forwarding': 'net.ipv4.ip_forward',
};

function ecrireCle(jeu: Jeu, cle: string, valeur: string): string | null {
  const n = jeu.trouver(chemin(cle));
  if (n?.type !== 'fichier') return `sysctl: cannot stat ${chemin(cle)}: No such file or directory`;
  if (jeu.qui !== 'root') return `sysctl: permission denied on key "${cle}"`;
  if (!/^-?\d+$/.test(valeur) && ['net.ipv4.ip_forward', 'net.ipv4.conf.all.forwarding'].includes(cle))
    return `sysctl: setting key "${cle}": Invalid argument`;
  n.contenu = valeur;
  const liee = LIEES[cle] && jeu.trouver(chemin(LIEES[cle]));
  if (liee && liee.type === 'fichier') liee.contenu = valeur;
  return null;
}

/** Les réglages d'un fichier sysctl.conf : « clé = valeur » (les lignes « - » ignorent les erreurs). */
export function lignesSysctl(texte: string): { cle: string; valeur: string; tolerant: boolean }[] {
  return texte
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith(';') && l.includes('='))
    .map((l) => {
      const tolerant = l.startsWith('-');
      const [cle, ...v] = l.replace(/^-/, '').split('=');
      return { cle: cleDe(cle), valeur: v.join('=').trim(), tolerant };
    });
}

const DOSSIERS_SYSCTL = ['/etc/sysctl.d', '/run/sysctl.d', '/usr/local/lib/sysctl.d', '/usr/lib/sysctl.d'];

/** Les fichiers que lit sysctl --system (et systemd-sysctl au démarrage), dans l'ordre. */
export function fichiersSysctl(jeu: Jeu): string[] {
  const parNom = new Map<string, string>();
  for (const d of DOSSIERS_SYSCTL) {
    const n = jeu.trouver(d);
    if (n?.type !== 'dossier') continue;
    for (const nom of Object.keys(n.enfants)) if (nom.endsWith('.conf') && !parNom.has(nom)) parNom.set(nom, `${d}/${nom}`);
  }
  const liste = [...parNom.keys()].sort().map((n) => parNom.get(n)!);
  if (jeu.existe('/etc/sysctl.conf')) liste.push('/etc/sysctl.conf');
  return liste;
}

/** Au démarrage : les valeurs par défaut du noyau, puis les fichiers (systemd-sysctl). */
export function appliquerSysctl(jeu: Jeu, defauts: Record<string, string>) {
  for (const [cle, v] of Object.entries(defauts)) {
    const n = jeu.trouver(chemin(cle));
    if (n?.type === 'fichier') n.contenu = v;
  }
  const qui = jeu.qui;
  jeu.qui = 'root';
  for (const f of fichiersSysctl(jeu)) for (const { cle, valeur } of lignesSysctl(jeu.lire(f) ?? '')) ecrireCle(jeu, cle, valeur);
  jeu.qui = qui;
}

/** La valeur qu'aurait cette clé après un redémarrage (la dernière écrite par les fichiers). */
export function sysctlAuDemarrage(jeu: Jeu, cle: string, defaut: string): string {
  let v = defaut;
  for (const f of fichiersSysctl(jeu)) for (const l of lignesSysctl(jeu.lire(f) ?? '')) if (l.cle === cle || LIEES[cle] === l.cle) v = l.valeur;
  return v;
}

function toutesLesCles(n: Noeud, prefixe: string): string[] {
  if (n.type !== 'dossier') return [prefixe];
  return Object.keys(n.enfants)
    .sort()
    .flatMap((k) => toutesLesCles(n.enfants[k], prefixe ? `${prefixe}.${k}` : k));
}

function sysctl(jeu: Shell, args: string[]): string {
  const sorties: string[] = [];
  let ecrire = false;
  let valeurSeule = false;
  let silence = false;
  const montrer = (cle: string, v: string) => !silence && sorties.push(valeurSeule ? v : `${cle} = ${v}`);
  const appliquerFichier = (f: string) => {
    const texte = jeu.lire(f);
    if (texte === null) return jeu.erreur(`sysctl: cannot open "${f}": No such file or directory`, 255);
    for (const { cle, valeur, tolerant } of lignesSysctl(texte)) {
      const e = ecrireCle(jeu, cle, valeur);
      if (e && !tolerant) jeu.erreur(e, 255);
      else if (!e) montrer(cle, valeur);
    }
  };
  if (!args.length) return jeu.erreur(jeu.t('sysctl-usage'), 255);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-h') return aide('sysctl', NFTABLES.sysctl, jeu.t);
    if (a === '--system') {
      for (const f of fichiersSysctl(jeu)) {
        sorties.push(`* Applying ${f} ...`);
        appliquerFichier(f);
      }
    } else if (a === '-p' || a === '--load' || a.startsWith('-p') || a.startsWith('--load=')) {
      const f = a.startsWith('--load=')
        ? a.slice(7)
        : a.length > 2 && a.startsWith('-p')
          ? a.slice(2)
          : args[i + 1] && !args[i + 1].startsWith('-')
            ? args[++i]
            : '/etc/sysctl.conf';
      appliquerFichier(f);
    } else if (a === '-a' || a === '-A' || a === '--all') {
      const racine = jeu.trouver('/proc/sys');
      if (racine) for (const cle of toutesLesCles(racine, '')) montrer(cle, jeu.lire(chemin(cle))?.trim() ?? '');
    } else if (a === '-w' || a === '--write') ecrire = true;
    else if (a === '-n' || a === '--values') valeurSeule = true;
    else if (a === '-q' || a === '--quiet') silence = true;
    else if (/^-[nqw]+$/.test(a)) {
      if (a.includes('n')) valeurSeule = true;
      if (a.includes('q')) silence = true;
      if (a.includes('w')) ecrire = true;
    } else if (a.startsWith('-')) return jeu.erreur(`sysctl: unknown option '${a}'\n${jeu.t('sysctl-usage')}`, 255);
    else if (a.includes('=')) {
      const [cle, ...v] = a.split('=');
      const e = ecrireCle(jeu, cleDe(cle), v.join('='));
      if (e) jeu.erreur(e, 255);
      else montrer(cleDe(cle), v.join('='));
    } else if (ecrire) jeu.erreur(`sysctl: "${a}" must be of the form name=value`, 255);
    else {
      const cle = cleDe(a);
      const n = jeu.trouver(chemin(cle));
      if (n?.type === 'dossier') for (const k of toutesLesCles(n, cle)) montrer(k, jeu.lire(chemin(k))?.trim() ?? '');
      else if (n?.type !== 'fichier') jeu.erreur(`sysctl: cannot stat ${chemin(cle)}: No such file or directory`, 255);
      else montrer(cle, jeu.lire(chemin(cle))!.trim());
    }
  }
  return sorties.join('\n');
}

// ——— conntrack ———

function conntrack(jeu: Shell, args: string[]): string {
  if (args.includes('-h')) return aide('conntrack', NFTABLES.conntrack, jeu.t);
  const action = args.find((a) => ['-L', '--dump', '-C', '--count', '-F', '--flush', '-E', '--event'].includes(a));
  if (!action) return jeu.erreur(`${CONNTRACK}: no command specified\nTry \`conntrack -h' or 'conntrack --help' for more information.`, 2);
  if (jeu.qui !== 'root') return jeu.erreur(`${CONNTRACK}: Operation failed: Operation not permitted`, 1);
  if (action === '-E' || action === '--event') return jeu.erreur(jeu.t('conntrack-evenements'), 1);
  if (action === '-F' || action === '--flush') {
    // Les échanges en cours se recréent aussitôt : les appareils continuent de parler.
    jeu.erreur(`${CONNTRACK}: connection tracking table has been emptied.`, 0);
    return '';
  }
  const apres = (o: string[]) => {
    const k = args.findIndex((a) => o.includes(a));
    return k >= 0 ? args[k + 1] : undefined;
  };
  const proto = apres(['-p', '--proto']);
  const source = apres(['-s', '--src', '--orig-src']);
  const destination = apres(['-d', '--dst', '--orig-dst']);
  const lignes: string[] = [];
  // La session ssh du jeu, vers le routeur lui-même.
  const ssh = {
    proto: 'tcp' as const,
    saddr: POSTE.adresse,
    daddr: lan(jeu)?.interfaces.eth0?.adresses[0]?.split('/')[0] ?? '',
    sport: 52814,
    dport: 22,
  };
  const entrees = [
    ...(ssh.daddr ? [{ ...ssh, repondu: true, vue: ssh.saddr, ok: true }] : []),
    ...resultats(jeu)
      .filter((r) => r.aller && (r.etat === 'ok' || r.etat === 'sans-reponse'))
      .map((r) => ({ ...r.aller!, repondu: r.etat === 'ok', vue: r.traduite ?? r.aller!.saddr, ok: r.etat === 'ok', reel: r.destination })),
  ].filter((e) => (!proto || e.proto === proto) && (!source || e.saddr === source) && (!destination || e.daddr === destination));
  for (const e of entrees) {
    const numero = e.proto === 'tcp' ? 6 : 17;
    const etat = e.proto === 'tcp' ? (e.ok ? ' ESTABLISHED' : ' SYN_SENT') : '';
    const delai = e.proto === 'tcp' ? (e.ok ? 431999 : 119) : e.ok ? 119 : 29;
    const aller = `src=${e.saddr} dst=${e.daddr} sport=${e.sport} dport=${e.dport}`;
    // La réponse vient de la vraie destination (après dnat), vers l'adresse vue (après masquerade).
    const reel = 'reel' in e && e.reel ? e.reel : { adresse: e.daddr, port: e.dport };
    const retour = `src=${reel.adresse} dst=${e.vue} sport=${reel.port} dport=${e.sport}`;
    lignes.push(
      `${e.proto.padEnd(8)} ${numero} ${delai}${etat} ${aller} ${e.ok ? '' : '[UNREPLIED] '}${retour} ${e.ok ? '[ASSURED] ' : ''}mark=0 use=1`,
    );
  }
  if (action === '-C' || action === '--count') return String(lignes.length);
  jeu.erreur(`${CONNTRACK}: ${lignes.length} flow entries have been shown.`, 0);
  return lignes.join('\n');
}

export const NFTABLES: Record<string, Commande> = {
  nft: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => nftCommande(jeu, args) },
  sysctl: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => sysctl(jeu, args) },
  conntrack: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => conntrack(jeu, args) },
  // La page de manuel des fichiers de réglages (man 5 sysctl.d).
  'sysctl.d': { section: 5, lancer: () => '' },
};
