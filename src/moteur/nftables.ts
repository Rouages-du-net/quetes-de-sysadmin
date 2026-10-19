// nftables, le pare-feu du noyau Linux, sur un routeur (etat.nft) : des
// tables (famille ip, ip6, inet), des chaînes accrochées au trajet des
// paquets (hook input, forward, output, prerouting, postrouting) avec une
// politique, et des règles lues de gauche à droite (des conditions, puis
// des instructions : counter, log, accept, drop, masquerade…).
// Le langage est celui de nft(8) : https://www.netfilter.org/projects/nftables/manpage.html,
// https://wiki.nftables.org/wiki-nftables/index.php/Quick_reference-nftables_in_10_minutes ;
// sur Debian, /etc/nftables.conf est chargé par nftables.service (nft -f).
// Le trafic des appareils du réseau local (Lan.flux) traverse le routeur :
// hook forward (paquet « new », puis la réponse « established »), puis la
// traduction d'adresse (masquerade, snat) au hook postrouting d'une chaîne
// de type nat. Une adresse privée (RFC 1918) qui sort vers internet sans
// traduction ne reçoit jamais de réponse. Rien ne passe sans
// net.ipv4.ip_forward = 1 (/proc/sys, voir sysctl).
// Écarts : IPv4 seulement ; pas d'ensembles nommés (set), de maps, de
// limit, ni de règles sur le contenu des paquets ; les compteurs comptent
// le trafic simulé (un passage de chaque flux) ; la chaîne input ne coupe
// pas la session ssh du jeu.

import type { Jeu } from './shell';
import { adresseDe, dans, enService, estIp, interfaceDuVlan, interfacePour, joindre, lan, prive, reseauDe, versNombre, type Lan } from './lan';
import { journaliser, systemd } from './systemd';

export const CONF = '/etc/nftables.conf';
export const FAMILLES = ['ip', 'ip6', 'inet', 'arp', 'bridge', 'netdev'];
const HOOKS = ['prerouting', 'input', 'forward', 'output', 'postrouting', 'ingress'];
const PRIORITES: Record<string, number> = { raw: -300, mangle: -150, dstnat: -100, filter: 0, security: 50, srcnat: 100 };
// Les services de /etc/services que le jeu connaît (tcp dport https…).
export const SERVICES: Record<string, number> = {
  ssh: 22,
  smtp: 25,
  domain: 53,
  bootps: 67,
  bootpc: 68,
  http: 80,
  ntp: 123,
  https: 443,
  'microsoft-ds': 445,
  rtsp: 554,
  ipp: 631,
  imaps: 993,
};
const ETATS_CT = ['new', 'established', 'related', 'invalid', 'untracked'];

// ——— Le modèle ———

export interface Condition {
  // iifname, oifname, ip saddr, ip daddr, ip protocol, meta l4proto, ct state, tcp dport, udp sport…
  champ: string;
  negation: boolean;
  valeurs: string[];
  // Écrit entre accolades ({ 80, 443 }).
  ensemble: boolean;
}

export type Instruction =
  | { quoi: 'counter'; paquets: number; octets: number }
  | { quoi: 'log'; prefixe?: string }
  | { quoi: 'accept' | 'drop' | 'reject' | 'return' | 'continue' }
  | { quoi: 'jump' | 'goto'; chaine: string }
  | { quoi: 'masquerade' }
  | { quoi: 'snat' | 'dnat'; vers: string };

export interface Regle {
  conditions: Condition[];
  instructions: Instruction[];
  poignee: number;
}

export interface Chaine {
  nom: string;
  base?: { type: string; hook: string; priorite: number; politique: 'accept' | 'drop' };
  regles: Regle[];
  poignee: number;
}

export interface Table {
  famille: string;
  nom: string;
  chaines: Chaine[];
  poignee: number;
  // Le prochain numéro (handle) à donner dans cette table.
  suivante: number;
}

export interface Ruleset {
  tables: Table[];
}

export const nft = (j: Jeu): Ruleset => (j.etat.nft ??= { tables: [] });
export const copie = (r: Ruleset): Ruleset => structuredClone(r);

// ——— Le lexique ———

interface Jeton {
  t: string;
  type: 'mot' | 'chaine' | 'sym' | 'nl' | 'fin';
  ligne: number;
  col: number;
}

function decouper(texte: string): Jeton[] {
  const jetons: Jeton[] = [];
  texte.split('\n').forEach((brute, i) => {
    const ligne = i + 1;
    let k = 0;
    while (k < brute.length) {
      const c = brute[k];
      if (c === '#') break;
      if (c === '\\' && k === brute.trimEnd().length - 1) return; // la ligne continue
      if (/\s/.test(c)) {
        k++;
        continue;
      }
      if (c === '"') {
        const fin = brute.indexOf('"', k + 1);
        const bout = fin < 0 ? brute.length : fin;
        jetons.push({ t: brute.slice(k + 1, bout), type: 'chaine', ligne, col: k + 1 });
        k = bout + 1;
        continue;
      }
      const deux = brute.slice(k, k + 2);
      if (deux === '!=' || deux === '==') {
        jetons.push({ t: deux, type: 'sym', ligne, col: k + 1 });
        k += 2;
        continue;
      }
      if ('{};,='.includes(c)) {
        jetons.push({ t: c, type: 'sym', ligne, col: k + 1 });
        k++;
        continue;
      }
      const m = /^[^\s{};,"#=]+/.exec(brute.slice(k))!;
      jetons.push({ t: m[0], type: 'mot', ligne, col: k + 1 });
      k += m[0].length;
    }
    jetons.push({ t: '\n', type: 'nl', ligne, col: brute.length + 1 });
  });
  jetons.push({ t: '', type: 'fin', ligne: texte.split('\n').length, col: 1 });
  return jetons;
}

// Une erreur de nft : le message, et où (ligne, colonnes).
export class ErreurNft extends Error {
  constructor(
    message: string,
    public jeton?: Jeton,
  ) {
    super(message);
  }
}

const decrire = (j: Jeton) =>
  j.type === 'nl'
    ? 'newline'
    : j.type === 'fin'
      ? 'end of file'
      : j.type === 'chaine'
        ? 'string'
        : j.type === 'sym'
          ? `'${j.t}'`
          : /^\d+$/.test(j.t)
            ? 'number'
            : 'string';
const inattendu = (j: Jeton) => new ErreurNft(`syntax error, unexpected ${decrire(j)}`, j);

// ——— L'analyse ———

class Lecteur {
  k = 0;
  constructor(
    public jetons: Jeton[],
    public definitions: Map<string, Jeton[]>,
  ) {}
  voir(): Jeton {
    const j = this.jetons[this.k];
    if (j.type === 'mot' && j.t.startsWith('$')) {
      const d = this.definitions.get(j.t.slice(1));
      if (!d) throw new ErreurNft(`unknown identifier '${j.t.slice(1)}'`, j);
      this.jetons.splice(this.k, 1, ...d.map((x) => ({ ...x, ligne: j.ligne, col: j.col })));
      return this.voir();
    }
    return j;
  }
  prendre(): Jeton {
    const j = this.voir();
    this.k++;
    return j;
  }
  est(t: string) {
    const j = this.voir();
    return j.type !== 'chaine' && j.t === t;
  }
  attendre(t: string) {
    const j = this.prendre();
    if (j.type === 'chaine' || j.t !== t) throw inattendu(j);
  }
  mot(): Jeton {
    const j = this.prendre();
    if (j.type !== 'mot' && j.type !== 'chaine') throw inattendu(j);
    return j;
  }
  finDeLigne() {
    const j = this.voir();
    return j.type === 'nl' || j.type === 'fin' || j.t === ';' || j.t === '}';
  }
  sauterBlancs() {
    while (this.voir().type === 'nl' || this.est(';')) this.k++;
  }
}

/** Ce qu'une commande de liste demande (nft list …), pour l'affichage. */
export interface Liste {
  quoi: 'ruleset' | 'tables' | 'table' | 'chain';
  famille?: string;
  table?: string;
  chaine?: string;
}

/**
 * Exécute un texte nft (un fichier, ou une commande) sur une copie du
 * ruleset : renvoie la copie modifiée et les listes demandées. Lève
 * ErreurNft (rien n'est appliqué : nft est atomique).
 */
export function executerNft(j: Jeu, texte: string, depart: Ruleset, profondeur = 0): { ruleset: Ruleset; listes: Liste[] } {
  const r = copie(depart);
  const listes: Liste[] = [];
  const lecteur = new Lecteur(decouper(texte), new Map());
  executerDans(j, lecteur, r, listes, profondeur);
  return { ruleset: r, listes };
}

function famille(l: Lecteur): string {
  return FAMILLES.includes(l.voir().t) && l.voir().type === 'mot' ? l.prendre().t : 'ip';
}

function trouverTable(r: Ruleset, fam: string, nom: Jeton): Table {
  const t = r.tables.find((x) => x.famille === fam && x.nom === nom.t);
  if (!t) throw new ErreurNft('Could not process rule: No such file or directory', nom);
  return t;
}

function trouverChaine(t: Table, nom: Jeton): Chaine {
  const c = t.chaines.find((x) => x.nom === nom.t);
  if (!c) throw new ErreurNft('Could not process rule: No such file or directory', nom);
  return c;
}

function tableOuNouvelle(r: Ruleset, fam: string, nom: string): Table {
  let t = r.tables.find((x) => x.famille === fam && x.nom === nom);
  if (!t) {
    t = { famille: fam, nom, chaines: [], poignee: r.tables.length + 1, suivante: 1 };
    r.tables.push(t);
  }
  return t;
}

function chaineOuNouvelle(t: Table, nom: string): Chaine {
  let c = t.chaines.find((x) => x.nom === nom);
  if (!c) {
    c = { nom, regles: [], poignee: t.suivante++ };
    t.chaines.push(c);
  }
  return c;
}

function executerDans(j: Jeu, l: Lecteur, r: Ruleset, listes: Liste[], profondeur: number) {
  for (;;) {
    l.sauterBlancs();
    const debut = l.voir();
    if (debut.type === 'fin') return;
    const mot = l.mot();
    if (mot.t === 'define' || mot.t === 'redefine') {
      const nom = l.mot();
      l.attendre('=');
      const valeur: Jeton[] = [];
      let accolades = 0;
      while (!(l.voir().type === 'fin' || (accolades === 0 && (l.voir().type === 'nl' || l.est(';'))))) {
        const x = l.jetons[l.k++];
        if (x.t === '{' && x.type === 'sym') accolades++;
        if (x.t === '}' && x.type === 'sym') accolades--;
        valeur.push(x);
      }
      l.definitions.set(nom.t, valeur);
    } else if (mot.t === 'include') {
      const chemin = l.mot();
      const texte = j.lire(chemin.t);
      if (texte === null || profondeur > 8) throw new ErreurNft(`File not found: ${chemin.t}`, chemin);
      const sous = new Lecteur(decouper(texte), l.definitions);
      try {
        executerDans(j, sous, r, listes, profondeur + 1);
      } catch (e) {
        if (e instanceof ErreurNft) (e as ErreurNft & { fichier?: string }).fichier ??= chemin.t;
        throw e;
      }
    } else if (mot.t === 'flush') {
      const quoi = l.mot();
      if (quoi.t === 'ruleset') r.tables = [];
      else if (quoi.t === 'table') {
        const t = trouverTable(r, famille(l), l.mot());
        for (const c of t.chaines) c.regles = [];
      } else if (quoi.t === 'chain') {
        const t = trouverTable(r, famille(l), l.mot());
        trouverChaine(t, l.mot()).regles = [];
      } else throw inattendu(quoi);
    } else if (mot.t === 'table') {
      const fam = famille(l);
      const t = tableOuNouvelle(r, fam, l.mot().t);
      corpsTable(l, t);
    } else if (mot.t === 'add' || mot.t === 'create' || mot.t === 'insert') {
      const quoi = l.mot();
      if (quoi.t === 'table' && mot.t !== 'insert') {
        const fam = famille(l);
        const nom = l.mot();
        if (mot.t === 'create' && r.tables.some((x) => x.famille === fam && x.nom === nom.t))
          throw new ErreurNft('Could not process rule: File exists', nom);
        const t = tableOuNouvelle(r, fam, nom.t);
        if (l.est('{')) corpsTable(l, t);
      } else if (quoi.t === 'chain' && mot.t !== 'insert') {
        const t = trouverTable(r, famille(l), l.mot());
        const c = chaineOuNouvelle(t, l.mot().t);
        if (l.est('{')) corpsChaine(l, t, c);
      } else if (quoi.t === 'rule') {
        const t = trouverTable(r, famille(l), l.mot());
        const c = trouverChaine(t, l.mot());
        const regle = lireRegle(l, t);
        if (mot.t === 'insert') c.regles.unshift(regle);
        else c.regles.push(regle);
      } else throw inattendu(quoi);
    } else if (mot.t === 'delete' || mot.t === 'destroy') {
      const quoi = l.mot();
      if (quoi.t === 'table') {
        const fam = famille(l);
        const t = trouverTable(r, fam, l.mot());
        r.tables = r.tables.filter((x) => x !== t);
      } else if (quoi.t === 'chain') {
        const t = trouverTable(r, famille(l), l.mot());
        const c = trouverChaine(t, l.mot());
        t.chaines = t.chaines.filter((x) => x !== c);
      } else if (quoi.t === 'rule') {
        const t = trouverTable(r, famille(l), l.mot());
        const c = trouverChaine(t, l.mot());
        l.attendre('handle');
        const n = l.mot();
        const avant = c.regles.length;
        c.regles = c.regles.filter((x) => String(x.poignee) !== n.t);
        if (c.regles.length === avant) throw new ErreurNft('Could not process rule: No such file or directory', n);
      } else throw inattendu(quoi);
    } else if (mot.t === 'list') {
      const quoi = l.mot();
      if (quoi.t === 'ruleset') listes.push({ quoi: 'ruleset' });
      else if (quoi.t === 'tables') listes.push({ quoi: 'tables' });
      else if (quoi.t === 'table') {
        const fam = famille(l);
        const t = trouverTable(r, fam, l.mot());
        listes.push({ quoi: 'table', famille: fam, table: t.nom });
      } else if (quoi.t === 'chain') {
        const fam = famille(l);
        const t = trouverTable(r, fam, l.mot());
        const c = trouverChaine(t, l.mot());
        listes.push({ quoi: 'chain', famille: fam, table: t.nom, chaine: c.nom });
      } else throw inattendu(quoi);
    } else throw inattendu(mot);
    if (!l.finDeLigne()) throw inattendu(l.voir());
  }
}

function corpsTable(l: Lecteur, t: Table) {
  l.attendre('{');
  for (;;) {
    l.sauterBlancs();
    if (l.est('}')) {
      l.prendre();
      return;
    }
    const mot = l.mot();
    if (mot.t === 'chain') {
      const c = chaineOuNouvelle(t, l.mot().t);
      corpsChaine(l, t, c);
    } else if (mot.t === 'comment') l.mot();
    else throw inattendu(mot);
  }
}

function priorite(l: Lecteur): number {
  const j = l.mot();
  let p = /^-?\d+$/.test(j.t) ? Number(j.t) : PRIORITES[j.t];
  if (p === undefined) throw new ErreurNft(`'${j.t}' is not a valid priority in this family`, j);
  if (l.est('+') || l.est('-')) {
    const signe = l.prendre().t === '-' ? -1 : 1;
    p += signe * Number(l.mot().t);
  } else if (/^[+-]\d+$/.test(l.voir().t)) p += Number(l.prendre().t);
  return p;
}

function corpsChaine(l: Lecteur, t: Table, c: Chaine) {
  l.attendre('{');
  for (;;) {
    l.sauterBlancs();
    if (l.est('}')) {
      l.prendre();
      return;
    }
    if (l.est('type')) {
      l.prendre();
      const type = l.mot();
      if (!['filter', 'nat', 'route'].includes(type.t)) throw new ErreurNft(`unknown chain type`, type);
      l.attendre('hook');
      const hook = l.mot();
      if (!HOOKS.includes(hook.t)) throw new ErreurNft(`unknown chain hook`, hook);
      l.attendre('priority');
      const p = priorite(l);
      if (type.t === 'nat' && !['prerouting', 'postrouting', 'input', 'output'].includes(hook.t))
        throw new ErreurNft('Could not process rule: Operation not supported', hook);
      c.base = { type: type.t, hook: hook.t, priorite: p, politique: c.base?.politique ?? 'accept' };
    } else if (l.est('policy')) {
      const p = l.prendre();
      const v = l.mot();
      if (v.t !== 'accept' && v.t !== 'drop') throw inattendu(v);
      if (!c.base) throw new ErreurNft('Could not process rule: Invalid argument', p);
      c.base.politique = v.t;
    } else if (l.est('comment')) {
      l.prendre();
      l.mot();
    } else c.regles.push(lireRegle(l, t, c));
  }
}

// Une valeur, une liste (a,b) ou un ensemble ({ a, b }).
function valeurs(l: Lecteur): { valeurs: string[]; ensemble: boolean } {
  if (l.est('{')) {
    l.prendre();
    const v: string[] = [];
    for (;;) {
      while (l.voir().type === 'nl' || l.est(',')) l.prendre();
      if (l.est('}')) {
        l.prendre();
        break;
      }
      v.push(l.mot().t);
    }
    return { valeurs: v, ensemble: true };
  }
  const v = [l.mot().t];
  while (l.est(',')) {
    l.prendre();
    v.push(l.mot().t);
  }
  return { valeurs: v, ensemble: false };
}

const valideIp = (v: string) => {
  if (v.includes('-')) return v.split('-').every(estIp);
  const [ip, lg] = v.split('/');
  return estIp(ip) && (lg === undefined || (/^\d+$/.test(lg) && Number(lg) <= 32));
};
const validePort = (v: string) => v in SERVICES || /^\d+(-\d+)?$/.test(v);

function lireRegle(l: Lecteur, t: Table, c?: Chaine): Regle {
  const regle: Regle = { conditions: [], instructions: [], poignee: 0 };
  const condition = (champ: string, controle?: (v: string) => boolean, message?: (v: string) => string) => {
    let negation = false;
    if (l.est('!=')) {
      l.prendre();
      negation = true;
    } else if (l.est('==')) l.prendre();
    const debut = l.voir();
    const { valeurs: v, ensemble } = valeurs(l);
    if (controle) for (const x of v) if (!controle(x)) throw new ErreurNft(message ? message(x) : `syntax error, unexpected string`, debut);
    regle.conditions.push({ champ, negation, valeurs: v, ensemble });
  };
  if (l.finDeLigne()) throw inattendu(l.voir());
  while (!l.finDeLigne()) {
    const j = l.mot();
    const m = j.t;
    if (['iifname', 'oifname', 'iif', 'oif'].includes(m)) condition(m.replace(/^(i|o)if$/, '$1ifname'));
    else if (m === 'meta') {
      const k = l.mot();
      if (['iifname', 'oifname'].includes(k.t)) condition(k.t);
      else if (k.t === 'l4proto') condition('l4proto', (v) => ['tcp', 'udp', 'icmp'].includes(v));
      else if (k.t === 'nfproto') condition('nfproto', (v) => ['ipv4', 'ipv6'].includes(v));
      else throw inattendu(k);
    } else if (m === 'ip') {
      const k = l.mot();
      if (k.t === 'saddr' || k.t === 'daddr') condition(`ip ${k.t}`, valideIp, (v) => `Could not resolve hostname: Name or service not known (${v})`);
      else if (k.t === 'protocol') condition('l4proto', (v) => ['tcp', 'udp', 'icmp'].includes(v));
      else throw inattendu(k);
    } else if (m === 'ip6') {
      // Une règle IPv6 : elle ne voit jamais les paquets IPv4 du jeu.
      const k = l.mot();
      if (!['saddr', 'daddr', 'nexthdr'].includes(k.t)) throw inattendu(k);
      condition(`ip6 ${k.t}`);
    } else if (m === 'tcp' || m === 'udp') {
      const k = l.mot();
      if (k.t !== 'dport' && k.t !== 'sport') throw inattendu(k);
      condition(`${m} ${k.t}`, validePort, (v) => `Could not resolve service: Servname not supported for ai_socktype (${v})`);
    } else if (m === 'icmp' || m === 'icmpv6') {
      l.attendre('type');
      condition(`${m} type`);
    } else if (m === 'ct') {
      l.attendre('state');
      condition(
        'ct state',
        (v) => ETATS_CT.includes(v),
        (v) => `Error parsing ct state: unknown value '${v}'`,
      );
    } else if (m === 'counter') {
      let paquets = 0;
      let octets = 0;
      if (l.est('packets')) {
        l.prendre();
        paquets = Number(l.mot().t);
        l.attendre('bytes');
        octets = Number(l.mot().t);
      }
      regle.instructions.push({ quoi: 'counter', paquets, octets });
    } else if (m === 'log') {
      const i: Instruction = { quoi: 'log' };
      while (l.est('prefix') || l.est('level') || l.est('flags')) {
        const k = l.prendre().t;
        const v = l.mot().t;
        if (k === 'prefix') i.prefixe = v;
      }
      regle.instructions.push(i);
    } else if (['accept', 'drop', 'return', 'continue'].includes(m)) regle.instructions.push({ quoi: m as 'accept' });
    else if (m === 'reject') {
      if (l.est('with')) {
        l.prendre();
        l.mot();
        l.mot();
        if (l.voir().type === 'mot' && !l.finDeLigne() && !['counter', 'log'].includes(l.voir().t)) l.mot();
      }
      regle.instructions.push({ quoi: 'reject' });
    } else if (m === 'jump' || m === 'goto') {
      const cible = l.mot();
      regle.instructions.push({ quoi: m, chaine: cible.t });
    } else if (m === 'masquerade') {
      if (c?.base && c.base.type !== 'nat') throw new ErreurNft('Could not process rule: Operation not supported', j);
      regle.instructions.push({ quoi: 'masquerade' });
      while (['random', 'persistent', 'fully-random'].includes(l.voir().t)) l.prendre();
    } else if (m === 'snat' || m === 'dnat') {
      if (c?.base && c.base.type !== 'nat') throw new ErreurNft('Could not process rule: Operation not supported', j);
      if (l.est('ip')) l.prendre();
      l.attendre('to');
      const v = l.mot();
      if (!estIp(v.t.split(':')[0])) throw new ErreurNft(`Could not resolve hostname: Name or service not known`, v);
      regle.instructions.push({ quoi: m, vers: v.t });
    } else if (m === 'comment') l.mot();
    else throw inattendu(j);
  }
  regle.poignee = t.suivante++;
  return regle;
}

// ——— L'affichage (nft list) ———

const nomPriorite = (p: number) => Object.entries(PRIORITES).find(([, v]) => v === p)?.[0] ?? String(p);
const guillemets = (champ: string, v: string) => (champ.endsWith('ifname') ? `"${v}"` : v);
const enNombre = (champ: string, v: string) => (/(d|s)port$/.test(champ) && v in SERVICES ? String(SERVICES[v]) : v);

function texteCondition(c: Condition): string {
  const champ = c.champ === 'l4proto' ? 'meta l4proto' : c.champ;
  const v = c.valeurs.map((x) => guillemets(c.champ, enNombre(c.champ, x)));
  const valeur = c.champ === 'ct state' ? v.join(',') : v.length > 1 || c.ensemble ? `{ ${v.join(', ')} }` : v[0];
  return `${champ} ${c.negation ? '!= ' : ''}${valeur}`;
}

function texteInstruction(i: Instruction): string {
  if (i.quoi === 'counter') return `counter packets ${i.paquets} bytes ${i.octets}`;
  if (i.quoi === 'log') return i.prefixe !== undefined ? `log prefix "${i.prefixe}"` : 'log';
  if (i.quoi === 'jump' || i.quoi === 'goto') return `${i.quoi} ${i.chaine}`;
  if (i.quoi === 'snat' || i.quoi === 'dnat') return `${i.quoi} to ${i.vers}`;
  return i.quoi;
}

export const texteRegle = (r: Regle) => [...r.conditions.map(texteCondition), ...r.instructions.map(texteInstruction)].join(' ');

function lignesChaine(c: Chaine, poignees: boolean): string[] {
  const h = (n: number) => (poignees ? ` # handle ${n}` : '');
  const lignes = [`\tchain ${c.nom} {${h(c.poignee)}`];
  if (c.base) lignes.push(`\t\ttype ${c.base.type} hook ${c.base.hook} priority ${nomPriorite(c.base.priorite)}; policy ${c.base.politique};`);
  for (const r of c.regles) lignes.push(`\t\t${texteRegle(r)}${h(r.poignee)}`);
  lignes.push('\t}');
  return lignes;
}

export function lignesTable(t: Table, poignees: boolean, chaine?: string): string[] {
  const chaines = t.chaines.filter((c) => !chaine || c.nom === chaine);
  return [`table ${t.famille} ${t.nom} {${poignees ? ` # handle ${t.poignee}` : ''}`, ...chaines.flatMap((c) => lignesChaine(c, poignees)), '}'];
}

export function afficher(r: Ruleset, liste: Liste, poignees: boolean): string {
  if (liste.quoi === 'tables') return r.tables.map((t) => `table ${t.famille} ${t.nom}`).join('\n');
  const tables = r.tables.filter((t) => liste.quoi === 'ruleset' || (t.famille === liste.famille && t.nom === liste.table));
  return tables.flatMap((t) => lignesTable(t, poignees, liste.chaine)).join('\n');
}

// ——— Le trajet d'un paquet ———

export interface Paquet {
  iif: string;
  oif: string;
  saddr: string;
  daddr: string;
  proto: 'tcp' | 'udp' | 'icmp';
  sport: number;
  dport: number;
  ct: 'new' | 'established';
  taille: number;
}

const correspondNom = (motif: string, nom: string) => (motif.endsWith('*') ? nom.startsWith(motif.slice(0, -1)) : motif === nom);
const correspondIp = (motif: string, ip: string) => {
  if (motif.includes('-')) {
    const [a, b] = motif.split('-').map(versNombre);
    return versNombre(ip) >= a && versNombre(ip) <= b;
  }
  return motif.includes('/') ? dans(ip, motif) : motif === ip;
};
const correspondPort = (motif: string, port: number) => {
  const m = motif in SERVICES ? String(SERVICES[motif]) : motif;
  const [a, b] = m.split('-').map(Number);
  return b === undefined ? port === a : port >= a && port <= b;
};

function correspond(c: Condition, p: Paquet): boolean {
  const un = (v: string): boolean => {
    switch (c.champ) {
      case 'iifname':
        return correspondNom(v, p.iif);
      case 'oifname':
        return correspondNom(v, p.oif);
      case 'ip saddr':
        return correspondIp(v, p.saddr);
      case 'ip daddr':
        return correspondIp(v, p.daddr);
      case 'l4proto':
        return v === p.proto;
      case 'nfproto':
        return v === 'ipv4';
      case 'ct state':
        return v === p.ct;
      case 'tcp dport':
      case 'udp dport':
        return c.champ.startsWith(p.proto) && correspondPort(v, p.dport);
      case 'tcp sport':
      case 'udp sport':
        return c.champ.startsWith(p.proto) && correspondPort(v, p.sport);
      case 'icmp type':
        return p.proto === 'icmp';
      default:
        return false; // ip6, icmpv6 : jamais pour un paquet IPv4
    }
  };
  // Un champ de protocole ne s'applique qu'à son protocole, même nié.
  if (/^(tcp|udp) /.test(c.champ) && !c.champ.startsWith(p.proto)) return false;
  if (c.champ.startsWith('ip6') || c.champ === 'icmpv6 type') return false;
  const oui = c.valeurs.some(un);
  return c.negation ? !oui : oui;
}

export interface Trace {
  chaine: string;
  regle: Regle | null;
  verdict: 'accept' | 'drop';
}

type Fin = {
  verdict: 'accept' | 'drop' | 'return' | null;
  nat?: { quoi: 'masquerade' | 'snat' | 'dnat'; vers?: string };
  regle: Regle | null;
  logs: string[];
};

function parcourir(t: Table, c: Chaine, p: Paquet, compter: boolean, profondeur = 0): Fin {
  const logs: string[] = [];
  for (const r of c.regles) {
    if (!r.conditions.every((x) => correspond(x, p))) continue;
    for (const i of r.instructions) {
      if (i.quoi === 'counter') {
        if (compter) {
          i.paquets++;
          i.octets += p.taille;
        }
      } else if (i.quoi === 'log') logs.push(i.prefixe ?? '');
      else if (i.quoi === 'accept' || i.quoi === 'drop') return { verdict: i.quoi, regle: r, logs };
      else if (i.quoi === 'reject') return { verdict: 'drop', regle: r, logs };
      else if (i.quoi === 'return') return { verdict: 'return', regle: r, logs };
      else if (i.quoi === 'masquerade' || i.quoi === 'snat' || i.quoi === 'dnat')
        return { verdict: 'accept', nat: { quoi: i.quoi, ...('vers' in i ? { vers: i.vers } : {}) }, regle: r, logs };
      else if (i.quoi === 'jump' || i.quoi === 'goto') {
        const sous = t.chaines.find((x) => x.nom === i.chaine);
        if (!sous || profondeur > 16) continue;
        const f = parcourir(t, sous, p, compter, profondeur + 1);
        logs.push(...f.logs);
        if (f.verdict === 'accept' || f.verdict === 'drop') return { ...f, logs };
        if (i.quoi === 'goto') return { verdict: 'return', regle: r, logs };
      }
    }
  }
  return { verdict: null, regle: null, logs };
}

/**
 * Un paquet passe par un hook : chaque chaîne de base de ce hook (familles
 * ip et inet), dans l'ordre des priorités. Le premier drop l'arrête ; un
 * accept le laisse aller à la chaîne suivante ; sans verdict, la politique.
 */
export function traverser(
  r: Ruleset,
  hook: string,
  type: string,
  p: Paquet,
  compter = false,
): { passe: boolean; nat: Fin['nat'] | null; logs: string[]; trace: Trace[] } {
  const chaines = r.tables
    .filter((t) => t.famille === 'ip' || t.famille === 'inet')
    .flatMap((t) => t.chaines.filter((c) => c.base?.hook === hook && c.base.type === type).map((c) => ({ t, c })))
    .sort((a, b) => a.c.base!.priorite - b.c.base!.priorite);
  let nat: Fin['nat'] | null = null;
  const logs: string[] = [];
  const trace: Trace[] = [];
  for (const { t, c } of chaines) {
    const f = parcourir(t, c, p, compter);
    logs.push(...f.logs);
    const verdict = f.verdict === 'accept' || f.verdict === 'drop' ? f.verdict : c.base!.politique;
    trace.push({ chaine: `${t.famille} ${t.nom} ${c.nom}`, regle: f.verdict === 'accept' || f.verdict === 'drop' ? f.regle : null, verdict });
    if (f.nat && !nat) nat = f.nat;
    if (verdict === 'drop') return { passe: false, nat, logs, trace };
  }
  return { passe: true, nat, logs, trace };
}

// ——— Le trafic du réseau local ———

/**
 * Un échange qu'un appareil essaie à travers le routeur : depuis un appareil
 * du réseau local (son nom) ou depuis internet (une adresse publique), vers
 * un appareil (son nom) ou une adresse (d'internet, ou celle du routeur, que
 * la traduction de destination, dnat, renvoie vers un appareil).
 */
export interface Flux {
  de: string;
  vers: string;
  proto: 'tcp' | 'udp';
  port: number;
}

export interface Resultat {
  flux: Flux;
  // ok : échange établi ; sans-reponse : la question passe, la réponse ne revient pas ; bloque : jeté au passage ; impossible : pas d'adresse, pas de route.
  etat: 'ok' | 'sans-reponse' | 'bloque' | 'impossible';
  // Le premier paquet, tel qu'il arrive au routeur (avant toute traduction).
  aller?: Paquet;
  // L'adresse source après traduction (masquerade, snat), si elle change.
  traduite?: string;
  // La destination après traduction (dnat), si elle change : adresse, et port.
  destination?: { adresse: string; port: number };
  logs: { prefixe: string; paquet: Paquet }[];
}

/** La valeur d'une clé sysctl (/proc/sys/…), ou null si elle n'existe pas. */
export const sysctlLu = (j: Jeu, cle: string) => j.lire(`/proc/sys/${cle.replace(/\./g, '/')}`)?.trim() ?? null;
export const routage = (j: Jeu) => sysctlLu(j, 'net.ipv4.ip_forward') === '1' || sysctlLu(j, 'net.ipv4.conf.all.forwarding') === '1';

// Un port source tiré du nom de l'appareil (toujours le même).
const portSource = (nom: string, port: number) => {
  let h = port;
  for (const c of nom) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 40000 + (h % 20000);
};

/** Ce que devient un flux à travers le routeur, avec ce ruleset et ce réglage d'ip_forward. */
export function essayer(l: Lan, r: Ruleset, transfert: boolean, f: Flux, compter = false): Resultat {
  const res = (etat: Resultat['etat'], o: Partial<Resultat> = {}): Resultat => ({ flux: f, etat, logs: [], ...o });
  const gw = l.passerelle && l.interfaces[l.passerelle.dev] && enService(l, l.interfaces[l.passerelle.dev]) ? l.interfaces[l.passerelle.dev] : null;
  // La source : un appareil du réseau local, ou une adresse d'internet (qui arrive par la passerelle).
  const externe = estIp(f.de) && !prive(f.de);
  const source = externe ? null : l.appareils.find((a) => a.nom === f.de);
  const saddr = externe ? f.de : source && adresseDe(source);
  const iif = externe ? gw : source && interfaceDuVlan(l, source.vlan);
  if (!saddr || !iif || (!externe && !iif.adresses.some((a) => dans(saddr, reseauDe(a))))) return res('impossible');
  const cible = l.appareils.find((a) => a.nom === f.vers);
  const daddr = cible ? adresseDe(cible) : f.vers;
  if (!daddr) return res('impossible');
  const aller: Paquet = {
    iif: iif.nom,
    oif: '',
    saddr,
    daddr,
    proto: f.proto,
    sport: portSource(source?.nom ?? f.de, f.port),
    dport: f.port,
    ct: 'new',
    taille: 60,
  };
  const logs: Resultat['logs'] = [];
  const noter = (t: { logs: string[] }, p: Paquet) => logs.push(...t.logs.map((prefixe) => ({ prefixe, paquet: p })));
  // La traduction de destination : prerouting, chaînes de type nat (premier paquet seulement).
  const pre = traverser(r, 'prerouting', 'nat', aller, compter);
  noter(pre, aller);
  if (!pre.passe) return res('bloque', { aller, logs });
  let destination: Resultat['destination'];
  if (pre.nat?.quoi === 'dnat') {
    const [adresse, port] = pre.nat.vers!.split(':');
    destination = { adresse, port: port ? Number(port) : f.port };
  }
  const dest = destination?.adresse ?? daddr;
  const dport = destination?.port ?? f.port;
  // Pour le routeur lui-même (sans traduction) : la chaîne input, que ces échanges ne regardent pas.
  if (Object.values(l.interfaces).some((i) => i.adresses.some((a) => a.split('/')[0] === dest))) return res('bloque', { aller, destination, logs });
  const interne = interfacePour(l, dest);
  const oif = interne ?? (prive(dest) ? null : gw);
  if (!oif) return res('impossible', { aller, destination });
  const traverse: Paquet = { ...aller, oif: oif.nom, daddr: dest, dport };
  if (!transfert) return res('bloque', { aller, destination, logs });
  const avant = traverser(r, 'forward', 'filter', traverse, compter);
  noter(avant, traverse);
  if (!avant.passe) return res('bloque', { aller, destination, logs });
  // La traduction de source : postrouting, chaînes de type nat (premier paquet seulement).
  const nat = traverser(r, 'postrouting', 'nat', traverse, compter);
  noter(nat, traverse);
  if (!nat.passe) return res('bloque', { aller, destination, logs });
  const traduite =
    nat.nat?.quoi === 'masquerade' ? oif.adresses[0]?.split('/')[0] : nat.nat?.quoi === 'snat' ? nat.nat.vers!.split(':')[0] : undefined;
  const vue = traduite ?? saddr;
  // La réponse : d'un appareil du réseau local s'il existe ; d'internet seulement vers une adresse publique.
  const appareil = l.appareils.find((a) => adresseDe(a) === dest);
  const repond = appareil ? joindre(l, dest).quoi === 'appareil' : interne ? false : !prive(vue);
  if (!repond) return res('sans-reponse', { aller, traduite, destination, logs });
  const retour: Paquet = {
    ...traverse,
    iif: oif.nom,
    oif: iif.nom,
    saddr: dest,
    daddr: saddr,
    sport: dport,
    dport: aller.sport,
    ct: 'established',
    taille: 1500,
  };
  const r2 = traverser(r, 'forward', 'filter', retour, compter);
  noter(r2, retour);
  return res(r2.passe ? 'ok' : 'sans-reponse', { aller, traduite, destination, logs });
}

/** Les flux du réseau local, maintenant (ruleset chargé, ip_forward du noyau). */
export const resultats = (j: Jeu, compter = false, r = nft(j)): Resultat[] => {
  const l = lan(j);
  return (l?.flux ?? []).map((f) => essayer(l!, r, routage(j), f, compter));
};

/** Le ruleset avec les compteurs du trafic simulé (un passage de chaque flux), pour nft list. */
export function avecCompteurs(j: Jeu): Ruleset {
  const r = copie(nft(j));
  for (const t of r.tables)
    for (const c of t.chaines)
      for (const regle of c.regles) for (const i of regle.instructions) if (i.quoi === 'counter') Object.assign(i, { paquets: 0, octets: 0 });
  resultats(j, true, r);
  // Ce qui a déjà été compté à la main (counter packets N bytes M) s'ajoute.
  const base = nft(j);
  r.tables.forEach((t, a) =>
    t.chaines.forEach((c, b) =>
      c.regles.forEach((regle, k) =>
        regle.instructions.forEach((i, n) => {
          const avant = base.tables[a]?.chaines[b]?.regles[k]?.instructions[n];
          if (i.quoi === 'counter' && avant?.quoi === 'counter') {
            i.paquets += avant.paquets;
            i.octets += avant.octets;
          }
        }),
      ),
    ),
  );
  return r;
}

/** Après un chargement : les lignes « log » du noyau pour le trafic du moment (journalctl -k). */
export function journaliserTrafic(j: Jeu) {
  const sd = systemd(j);
  const l = lan(j);
  if (!sd || !l) return;
  for (const res of resultats(j))
    for (const { prefixe, paquet: p } of res.logs) {
      const mac = l.interfaces[p.iif]?.mac ?? '00:00:00:00:00:00';
      journaliser(
        sd,
        '',
        'kernel',
        0,
        `${prefixe}IN=${p.iif} OUT=${p.oif} MAC=${mac}:00:00:5e:00:53:00:08:00 SRC=${p.saddr} DST=${p.daddr} LEN=${p.taille} TOS=0x00 PREC=0x00 TTL=63 ID=0 DF PROTO=${p.proto.toUpperCase()} SPT=${p.sport} DPT=${p.dport} WINDOW=64240 RES=0x00 ${p.ct === 'new' ? 'SYN' : 'ACK'} URGP=0`,
      );
    }
}

// ——— Le fichier /etc/nftables.conf ———

/** Lit /etc/nftables.conf comme nft -f (sur un ruleset vide, sauf s'il ne le vide pas lui-même). */
export function lireConf(j: Jeu, depart: Ruleset = nft(j)): { ruleset: Ruleset | null; erreur: string | null } {
  const texte = j.lire(CONF);
  if (texte === null) return { ruleset: null, erreur: `Error: Could not open file "${CONF}": No such file or directory` };
  try {
    return { ruleset: executerNft(j, texte, depart).ruleset, erreur: null };
  } catch (e) {
    if (e instanceof ErreurNft)
      return { ruleset: null, erreur: formaterErreur(e, CONF, j.lire((e as { fichier?: string }).fichier ?? CONF) ?? texte) };
    throw e;
  }
}

/** Une erreur au format de nft : « fichier:ligne:col-col: Error: … », la ligne, et des ^ dessous. */
export function formaterErreur(e: ErreurNft, fichier: string | null, texte: string): string {
  const fic = (e as { fichier?: string }).fichier ?? fichier;
  const j = e.jeton;
  if (!j) return `Error: ${e.message}`;
  const ligne = texte.split('\n')[j.ligne - 1] ?? '';
  const largeur = Math.max(1, j.type === 'chaine' ? j.t.length + 2 : j.type === 'nl' || j.type === 'fin' ? 1 : j.t.length);
  const lieu = fic ? `${fic}:${j.ligne}:${j.col}-${j.col + largeur - 1}: ` : '';
  const decalage = ligne.slice(0, j.col - 1).replace(/[^\t]/g, ' ');
  return `${lieu}Error: ${e.message}\n${ligne}\n${decalage}${'^'.repeat(largeur)}`;
}

/** Le ruleset que donnerait le fichier au démarrage (sur un ruleset vide). */
export const auDemarrage = (j: Jeu) => lireConf(j, { tables: [] }).ruleset;
