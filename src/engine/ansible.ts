// Ansible simulé : ansible.cfg, l'inventaire (format INI), les playbooks (YAML),
// et l'exécution sur les machines internes de l'histoire (Chapitre.hotes),
// jointes en ssh sans question (acces.ts : clé d'hôte connue, clé autorisée).
// Modules : ping, apt, copy, file, lineinfile, user, service/systemd,
// command, shell, debug (ansible.builtin). become, notify et handlers,
// --check, --diff, --limit, --syntax-check ; la sortie suit celle
// d'ansible-core (bannières PLAY/TASK, ok/changed/fatal, PLAY RECAP).
// D'après la documentation d'Ansible : https://docs.ansible.com/ansible/latest/
// (inventory_guide/intro_inventory.html, playbook_guide/, collections/ansible/builtin/).
// Écarts : YAML réduit (correspondances, listes, chaînes, blocs | et >,
// listes et dictionnaires sur une ligne) ; pas de rôles, de boucles, de
// conditions (when), de register ni de templates Jinja2 (seulement
// {{ variable }}) ; les faits (Gathering Facts) ne sont pas collectés.

import type { Shell } from './shell';
import { connecterSansQuestion } from './access';
import { arreter, demarrer, recharger, systemd } from './systemd';

export const VERSION = '2.18.6';

// ——— YAML ———

export type Valeur = string | Valeur[] | { [cle: string]: Valeur };

export class ErreurYaml extends Error {
  constructor(
    message: string,
    public ligne: number,
    public colonne: number,
  ) {
    super(message);
  }
}

interface LigneYaml {
  numero: number;
  retrait: number;
  texte: string;
  brute: string;
}

// Un # commence un commentaire en début de mot, hors guillemets.
function sansCommentaire(ligne: string): string {
  let guillemet: string | null = null;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (guillemet) {
      if (c === guillemet) guillemet = null;
    } else if (c === '"' || c === "'") guillemet = c;
    else if (c === '#' && (i === 0 || /\s/.test(ligne[i - 1]))) return ligne.slice(0, i).trimEnd();
  }
  return ligne.trimEnd();
}

function scalaire(brut: string, ligne: number, colonne: number): Valeur {
  const v = brut.trim();
  if (v.startsWith('[')) {
    if (!v.endsWith(']')) throw new ErreurYaml("did not find expected ',' or ']'", ligne, colonne);
    return v
      .slice(1, -1)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => scalaire(x, ligne, colonne));
  }
  if (v.startsWith('{')) {
    if (!v.endsWith('}')) throw new ErreurYaml("did not find expected ',' or '}'", ligne, colonne);
    const objet: Record<string, Valeur> = {};
    for (const morceau of v.slice(1, -1).split(',')) {
      const m = /^\s*([^:]+?)\s*:\s*(.*)$/.exec(morceau);
      if (m) objet[m[1].replace(/^["']|["']$/g, '')] = scalaire(m[2], ligne, colonne);
    }
    return objet;
  }
  if ((v.startsWith('"') && v.endsWith('"') && v.length > 1) || (v.startsWith("'") && v.endsWith("'") && v.length > 1))
    return v.startsWith('"') ? v.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"') : v.slice(1, -1).replace(/''/g, "'");
  if (/^["']/.test(v)) throw new ErreurYaml('found unexpected end of stream', ligne, colonne);
  if (v.startsWith('{{')) throw new ErreurYaml('found unacceptable key (unhashable type)', ligne, colonne);
  return v;
}

/** Lit un YAML (le sous-ensemble des playbooks) ; lève ErreurYaml avec la ligne et la colonne. */
export function lireYaml(texte: string): Valeur {
  const brutes = texte.split('\n');
  brutes.forEach((b, i) => {
    const t = /^\s*\t/.exec(b);
    if (t) throw new ErreurYaml('found character that cannot start any token', i + 1, t[0].length);
  });
  let lignes: LigneYaml[] = brutes
    .map((brute, i) => ({ numero: i + 1, brute, texte: sansCommentaire(brute) }))
    .filter((l) => l.texte.trim() !== '' && l.texte.trim() !== '---' && l.texte.trim() !== '...')
    .map((l) => ({ ...l, retrait: l.texte.length - l.texte.trimStart().length, texte: l.texte.trim() }));
  // Les blocs de texte (| et >) gardent leurs lignes telles quelles, commentaires compris.
  let i = 0;
  const blocTexte = (style: string, retraitCle: number): string => {
    const debut = lignes[i - 1].numero;
    const contenu: string[] = [];
    let indentation: number | null = null;
    const toutes = brutes;
    let k = debut; // index dans brutes (0-based) de la ligne suivante
    while (k < toutes.length) {
      const b = toutes[k];
      const r = b.length - b.trimStart().length;
      if (b.trim() === '') {
        contenu.push('');
        k++;
        continue;
      }
      if (r <= retraitCle) break;
      indentation ??= r;
      if (r < indentation) break;
      contenu.push(b.slice(indentation));
      k++;
    }
    while (contenu.length && contenu.at(-1) === '') contenu.pop();
    // Sauter les lignes consommées.
    while (i < lignes.length && lignes[i].numero <= k) i++;
    const garder = style.includes('-') ? '' : '\n';
    const texteBloc = style.startsWith('>') ? contenu.join(' ').replace(/ {2,}/g, ' ') : contenu.join('\n');
    return texteBloc + garder;
  };
  const valeurApres = (reste: string, l: LigneYaml, colonne: number, retraitCle: number): Valeur => {
    if (/^[|>][-+]?$/.test(reste)) return blocTexte(reste, retraitCle);
    if (reste !== '' && /^[^"'[{][^#]*?:(\s|$)/.test(reste) && !/^https?:/.test(reste))
      throw new ErreurYaml('mapping values are not allowed in this context', l.numero, colonne + reste.indexOf(':') + 1);
    return scalaire(reste, l.numero, colonne);
  };
  const bloc = (retrait: number): Valeur => {
    const premiere = lignes[i];
    if (premiere.texte === '-' || premiere.texte.startsWith('- ')) {
      const liste: Valeur[] = [];
      while (i < lignes.length && lignes[i].retrait === retrait && (lignes[i].texte === '-' || lignes[i].texte.startsWith('- '))) {
        const l = lignes[i];
        const reste = l.texte.slice(1).trimStart();
        const colonne = retrait + (l.texte.length - reste.length);
        if (reste === '') {
          i++;
          liste.push(i < lignes.length && lignes[i].retrait > retrait ? bloc(lignes[i].retrait) : '');
        } else if (/^("[^"]*"|'[^']*'|[^\s"'[{][^:]*?):(\s|$)/.test(reste)) {
          // « - clé: valeur » : une correspondance, dont les autres clés sont alignées sur la première.
          lignes[i] = { ...l, retrait: colonne, texte: reste };
          liste.push(bloc(colonne));
        } else {
          i++;
          liste.push(valeurApres(reste, l, colonne, retrait));
        }
      }
      if (i < lignes.length && lignes[i].retrait > retrait) throw new ErreurYaml("did not find expected '-' indicator", lignes[i].numero, lignes[i].retrait + 1);
      return liste;
    }
    const objet: Record<string, Valeur> = {};
    while (i < lignes.length && lignes[i].retrait === retrait) {
      const l = lignes[i];
      if (l.texte.startsWith('- ')) throw new ErreurYaml('did not find expected key', l.numero, retrait + 1);
      const m = /^("[^"]*"|'[^']*'|[^:]+?):(?:\s+(.*))?$/.exec(l.texte);
      if (!m) throw new ErreurYaml("could not find expected ':'", l.numero + 1, 1);
      const cle = m[1].replace(/^["']|["']$/g, '');
      i++;
      if (Object.hasOwn(objet, cle)) throw new ErreurYaml(`found duplicate key "${cle}"`, l.numero, retrait + 1);
      const reste = m[2] ?? '';
      if (reste !== '') objet[cle] = valeurApres(reste, l, retrait + m[1].length + 2, retrait);
      else if (i < lignes.length && lignes[i].retrait > retrait) objet[cle] = bloc(lignes[i].retrait);
      else if (i < lignes.length && lignes[i].retrait === retrait && lignes[i].texte.startsWith('- ')) objet[cle] = bloc(retrait);
      else objet[cle] = '';
    }
    if (i < lignes.length && lignes[i].retrait > retrait) throw new ErreurYaml('mapping values are not allowed in this context', lignes[i].numero, lignes[i].retrait + 1);
    return objet;
  };
  if (!lignes.length) return '';
  const racine = bloc(lignes[0].retrait);
  if (i < lignes.length) throw new ErreurYaml('did not find expected key', lignes[i].numero, lignes[i].retrait + 1);
  lignes = [];
  return racine;
}

// ——— ansible.cfg et inventaire ———

export interface Config {
  inventaire: string;
  utilisateur?: string;
  verifierCleHote: boolean;
  fichier: string | null;
}

// INI : [section] puis « clé = valeur ».
function lireIni(texte: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {};
  let courante = '';
  for (const brute of texte.split('\n')) {
    const l = brute.replace(/^\s*[#;].*$/, '').trim();
    if (!l) continue;
    const s = /^\[(.+)\]$/.exec(l);
    if (s) {
      courante = s[1].trim();
      sections[courante] ??= {};
      continue;
    }
    const m = /^([^=]+?)\s*=\s*(.*)$/.exec(l);
    if (m) (sections[courante] ??= {})[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return sections;
}

const vrai = (v: string | undefined) => /^(yes|true|1|on)$/i.test(v ?? '');
const faux = (v: string | undefined) => /^(no|false|0|off)$/i.test(v ?? '');

/** La configuration : ./ansible.cfg, puis ~/.ansible.cfg, puis /etc/ansible/ansible.cfg (la première trouvée). */
export function lireConfig(jeu: Shell): Config {
  const fichier = [`${jeu.cwd}/ansible.cfg`, '~/.ansible.cfg', '/etc/ansible/ansible.cfg'].map((c) => jeu.resoudre(c)).find((c) => jeu.trouver(c)?.type === 'fichier') ?? null;
  const ini = fichier ? lireIni(jeu.lire(fichier) ?? '') : {};
  const d = ini.defaults ?? {};
  const dossier = fichier ? fichier.slice(0, fichier.lastIndexOf('/')) : jeu.cwd;
  const inv = d.inventory ? (d.inventory.startsWith('/') || d.inventory.startsWith('~') ? d.inventory : `${dossier}/${d.inventory}`) : '/etc/ansible/hosts';
  return { inventaire: jeu.resoudre(inv), utilisateur: d.remote_user, verifierCleHote: !faux(d.host_key_checking), fichier };
}

export interface Inventaire {
  hotes: Record<string, Record<string, string>>;
  groupes: Record<string, string[]>;
  ordre: string[];
}

/** Un inventaire INI : [groupe], « hôte clé=valeur… », [groupe:vars], [groupe:children]. */
export function lireInventaire(texte: string): Inventaire {
  const inv: Inventaire = { hotes: {}, groupes: { all: [], ungrouped: [] }, ordre: [] };
  const variables: Record<string, Record<string, string>> = {};
  const enfants: Record<string, string[]> = {};
  let groupe = 'ungrouped';
  let mode: 'hotes' | 'vars' | 'children' = 'hotes';
  for (const brute of texte.split('\n')) {
    const l = brute.replace(/(^|\s)[#;].*$/, '').trim();
    if (!l) continue;
    const s = /^\[([^\]:]+)(?::(vars|children))?\]$/.exec(l);
    if (s) {
      groupe = s[1];
      mode = (s[2] as 'vars' | 'children') ?? 'hotes';
      inv.groupes[groupe] ??= [];
      continue;
    }
    if (mode === 'vars') {
      const m = /^([^=\s]+)\s*=\s*(.*)$/.exec(l);
      if (m) (variables[groupe] ??= {})[m[1]] = m[2];
      continue;
    }
    if (mode === 'children') {
      (enfants[groupe] ??= []).push(l);
      inv.groupes[l] ??= [];
      continue;
    }
    const [nom, ...vars] = l.split(/\s+/);
    inv.hotes[nom] ??= {};
    for (const v of vars) {
      const m = /^([^=]+)=(.*)$/.exec(v);
      if (m) inv.hotes[nom][m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    if (!inv.ordre.includes(nom)) inv.ordre.push(nom);
    if (!inv.groupes[groupe].includes(nom)) inv.groupes[groupe].push(nom);
  }
  for (const [g, liste] of Object.entries(enfants)) for (const e of liste) for (const h of inv.groupes[e] ?? []) if (!inv.groupes[g].includes(h)) inv.groupes[g].push(h);
  inv.groupes.ungrouped = inv.groupes.ungrouped.filter((h) => !Object.entries(inv.groupes).some(([g, l]) => g !== 'ungrouped' && g !== 'all' && l.includes(h)));
  inv.groupes.all = [...inv.ordre];
  // Les variables de groupe, sans écraser celles de l'hôte.
  for (const [g, vars] of Object.entries(variables))
    for (const h of g === 'all' ? inv.ordre : (inv.groupes[g] ?? [])) inv.hotes[h] = { ...vars, ...inv.hotes[h] };
  return inv;
}

/** Les hôtes qui correspondent à un motif : all, un groupe, un hôte, plusieurs séparés par « , » ou « : », !exclusion. */
export function hotesDu(inv: Inventaire, motif: string): string[] {
  const resultat: string[] = [];
  const exclus: string[] = [];
  for (const brut of motif.split(/[,:]/).map((x) => x.trim()).filter(Boolean)) {
    const non = brut.startsWith('!');
    const p = brut.replace(/^!/, '');
    const liste = p === 'all' || p === '*' ? inv.ordre : (inv.groupes[p] ?? (inv.hotes[p] ? [p] : []));
    (non ? exclus : resultat).push(...liste);
  }
  return [...new Set(resultat)].filter((h) => !exclus.includes(h));
}

/** Le motif ne correspond-il à rien de connu (pour l'avertissement d'Ansible) ? */
export const motifInconnu = (inv: Inventaire, motif: string) =>
  motif
    .split(/[,:]/)
    .map((x) => x.trim().replace(/^!/, ''))
    .filter(Boolean)
    .some((p) => p !== 'all' && p !== '*' && !inv.groupes[p] && !inv.hotes[p]);

// ——— La connexion aux hôtes ———

export interface Contexte {
  jeu: Shell;
  config: Config;
  inventaire: Inventaire;
  verifier: boolean;
  difference: boolean;
  sorties: string[];
  // Hôte → session (connexion faite une fois par commande).
  sessions: Record<string, Shell | string>;
  utilisateurForce?: string;
  become?: boolean;
}

function joindre(c: Contexte, hote: string): Shell | string {
  if (c.sessions[hote] !== undefined) return c.sessions[hote];
  const vars = c.inventaire.hotes[hote] ?? {};
  const adresse = vars.ansible_host ?? hote;
  const utilisateur = c.utilisateurForce ?? vars.ansible_user ?? c.config.utilisateur ?? c.jeu.qui;
  const r = connecterSansQuestion(c.jeu, `${utilisateur}@${adresse}`, c.config.verifierCleHote);
  const s = 'shell' in r ? r.shell : `Failed to connect to the host via ssh: ${r.erreur}`;
  if (typeof s !== 'string') s.qui = utilisateur;
  c.sessions[hote] = s;
  return s;
}

// ——— Le JSON des résultats, comme Ansible l'affiche ———

export function json(v: unknown, retrait = 0): string {
  const pad = ' '.repeat(retrait);
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => `${pad}    ${json(x, retrait + 4)}`).join(',\n')}\n${pad}]` : '[]';
  const e = Object.entries(v as Record<string, unknown>);
  return e.length ? `{\n${e.map(([k, x]) => `${pad}    ${JSON.stringify(k)}: ${json(x, retrait + 4)}`).join(',\n')}\n${pad}}` : '{}';
}

/** Le JSON sur une ligne, comme json.dumps de Python (« , » et « : » suivis d'une espace). */
export function jsonLigne(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(jsonLigne).join(', ')}]`;
  return `{${Object.entries(v as Record<string, unknown>).map(([k, x]) => `${JSON.stringify(k)}: ${jsonLigne(x)}`).join(', ')}}`;
}

// ——— Les modules ———

export interface Resultat {
  changed: boolean;
  failed?: boolean;
  skipped?: boolean;
  msg?: string;
  // Ce qu'Ansible affiche après « => » (pour debug, échecs, ad-hoc).
  donnees?: Record<string, unknown>;
  diff?: string;
  // command/shell en ad-hoc : rc et sortie.
  rc?: number;
  stdout?: string;
}

type Args = Record<string, Valeur>;
type Module = { params: string[]; requis?: string[]; lancer: (h: Shell, a: Args, c: Contexte, become: boolean) => Resultat; ecrit?: boolean };

const chaine = (v: Valeur | undefined) => (v === undefined ? undefined : Array.isArray(v) ? v.join(',') : typeof v === 'string' ? v : JSON.stringify(v));
const liste = (v: Valeur | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v.map((x) => String(x)) : String(v).split(',').map((x) => x.trim()).filter(Boolean);
const booleen = (v: Valeur | undefined, defaut = false) => (v === undefined ? defaut : typeof v === 'string' ? vrai(v) : defaut);

// Un mode « 0644 », « 644 » ou « u=rw,g=r,o=r » → « rw-r--r-- ».
function versMode(v: string | undefined): string | null {
  if (!v) return null;
  const o = /^0?([0-7]{3,4})$/.exec(v.replace(/^'|'$/g, ''));
  if (o) {
    const chiffres = o[1].slice(-3);
    const special = o[1].length === 4 ? Number(o[1][0]) : 0;
    const r = [...chiffres].map((c) => {
      const n = Number(c);
      return (n & 4 ? 'r' : '-') + (n & 2 ? 'w' : '-') + (n & 1 ? 'x' : '-');
    });
    if (special & 2) r[1] = r[1].slice(0, 2) + (r[1][2] === 'x' ? 's' : 'S');
    return r.join('');
  }
  const m = /^u=([rwx]*),g=([rwx]*),o=([rwx]*)$/.exec(v);
  if (m) return [m[1], m[2], m[3]].map((p) => `${p.includes('r') ? 'r' : '-'}${p.includes('w') ? 'w' : '-'}${p.includes('x') ? 'x' : '-'}`).join('');
  return null;
}

// Écrire sur l'hôte demande d'être root, sauf là où le compte peut écrire.
const peutEcrire = (h: Shell, chemin: string) => h.qui === 'root' || h.ecritDans(chemin);

// Le diff de --diff : les lignes gardées, retirées (-) et ajoutées (+), à leur place (plus longue sous-suite commune).
function differencer(chemin: string, avant: string, apres: string): string {
  const a = avant === '' ? [] : avant.replace(/\n$/, '').split('\n');
  const b = apres === '' ? [] : apres.replace(/\n$/, '').split('\n');
  const l = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) l[i][j] = a[i] === b[j] ? l[i + 1][j + 1] + 1 : Math.max(l[i + 1][j], l[i][j + 1]);
  const lignes = [`--- before: ${chemin}`, `+++ after: ${chemin}`, `@@ -1,${a.length} +1,${b.length} @@`];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lignes.push(` ${a[i++]}`);
      j++;
    } else if (i < a.length && (j === b.length || l[i + 1][j] >= l[i][j + 1])) lignes.push(`-${a[i++]}`);
    else lignes.push(`+${b[j++]}`);
  }
  return lignes.join('\n');
}

const nonEcrivable = (dossier: string): Resultat => ({ changed: false, failed: true, msg: `Destination ${dossier} not writable` });

function ecrireFichier(h: Shell, chemin: string, contenu: string, a: Args): void {
  const n = h.trouver(chemin);
  if (n?.type === 'fichier') n.contenu = contenu;
  else h.placer('ansible', chemin, { type: 'fichier', contenu, lignes: true, proprio: 'root', groupe: 'root', mode: 'rw-r--r--' });
  appliquerAttributs(h, chemin, a);
}

// owner, group, mode : renvoie vrai si quelque chose change (sans rien changer en mode vérification).
function attributsChangent(h: Shell, chemin: string, a: Args): boolean {
  const n = h.trouver(chemin);
  if (!n) return false;
  const mode = versMode(chaine(a.mode));
  return (!!a.owner && n.proprio !== chaine(a.owner)) || (!!a.group && (n.groupe ?? n.proprio) !== chaine(a.group)) || (!!mode && (n.mode ?? (n.type === 'dossier' ? 'rwxr-xr-x' : 'rw-r--r--')) !== mode);
}
function appliquerAttributs(h: Shell, chemin: string, a: Args) {
  const n = h.trouver(chemin);
  if (!n) return;
  if (a.owner) n.proprio = chaine(a.owner);
  if (a.group) n.groupe = chaine(a.group);
  const mode = versMode(chaine(a.mode));
  if (mode) n.mode = mode;
}

const dossierDe = (chemin: string) => chemin.slice(0, chemin.lastIndexOf('/')) || '/';

const MODULES: Record<string, Module> = {
  ping: { params: ['data'], lancer: () => ({ changed: false, donnees: { ping: 'pong' } }) },
  debug: { params: ['msg', 'var', 'verbosity'], lancer: (_h, a) => ({ changed: false, donnees: { msg: a.msg ?? 'Hello world!' } }) },
  apt: {
    params: ['name', 'pkg', 'state', 'update_cache', 'cache_valid_time', 'install_recommends', 'autoremove', 'upgrade'],
    lancer: (h, a, c) => {
      const noms = liste(a.name ?? a.pkg);
      const etat = chaine(a.state) ?? 'present';
      const installes: Record<string, string> = (h.etat.paquets ??= {});
      const depot: Record<string, string> = h.etat.depot ?? {};
      if (h.qui !== 'root')
        return {
          changed: false,
          failed: true,
          msg: "Failed to lock apt for exclusive operation: Failed to lock directory /var/lib/apt/lists/: E:Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)",
        };
      const inconnu = noms.find((n) => !depot[n] && !installes[n]);
      if (inconnu && etat !== 'absent') return { changed: false, failed: true, msg: `No package matching '${inconnu}' is available` };
      const aFaire = etat === 'absent' ? noms.filter((n) => installes[n]) : noms.filter((n) => !installes[n] || (etat === 'latest' && installes[n] !== depot[n]));
      if (aFaire.length && !c.verifier) for (const n of aFaire) etat === 'absent' ? delete installes[n] : (installes[n] = depot[n]);
      return { changed: aFaire.length > 0 || booleen(a.update_cache) };
    },
  },
  copy: {
    params: ['content', 'src', 'dest', 'owner', 'group', 'mode', 'backup', 'force'],
    requis: ['dest'],
    lancer: (h, a, c) => {
      const dest = chaine(a.dest)!;
      let contenu = chaine(a.content);
      if (contenu === undefined) {
        const src = chaine(a.src);
        if (!src) return { changed: false, failed: true, msg: 'src (or content) is required' };
        const chemin = src.startsWith('/') ? src : [`${c.jeu.cwd}/files/${src}`, `${c.jeu.cwd}/${src}`].find((x) => c.jeu.trouver(x)) ?? `${c.jeu.cwd}/${src}`;
        contenu = c.jeu.lire(chemin) ?? undefined;
        if (contenu === undefined) return { changed: false, failed: true, msg: `Could not find or access '${src}'\nSearched in:\n\t${c.jeu.cwd}/files/${src}\n\t${c.jeu.cwd}/${src} on the Ansible Controller.\nIf you are using a module and expect the file to exist on the remote, see the remote_src option` };
      }
      const dossier = dossierDe(dest);
      if (h.trouver(dossier)?.type !== 'dossier') return { changed: false, failed: true, msg: `Destination directory ${dossier} does not exist` };
      const avant = h.lire(dest);
      const change = avant !== contenu || attributsChangent(h, dest, a);
      if (change && !peutEcrire(h, dest)) return nonEcrivable(dossier);
      if (change && !c.verifier) ecrireFichier(h, dest, contenu, a);
      return { changed: change, diff: avant !== contenu ? differencer(dest, avant ?? '', contenu) : undefined };
    },
  },
  file: {
    params: ['path', 'dest', 'name', 'state', 'owner', 'group', 'mode', 'recurse'],
    requis: ['path'],
    lancer: (h, a, c) => {
      const chemin = chaine(a.path ?? a.dest ?? a.name)!;
      const etat = chaine(a.state) ?? 'file';
      const n = h.trouver(chemin);
      if (etat === 'absent') {
        if (!n) return { changed: false };
        if (!peutEcrire(h, chemin)) return { changed: false, failed: true, msg: `rmtree failed: [Errno 13] Permission denied: '${chemin}'` };
        if (!c.verifier) h.effacer(chemin);
        return { changed: true };
      }
      if (etat === 'directory') {
        if (n && n.type !== 'dossier') return { changed: false, failed: true, msg: `${chemin} already exists as a file` };
        if (!n) {
          if (!peutEcrire(h, chemin)) return { changed: false, failed: true, msg: `There was an issue creating ${chemin} as requested: [Errno 13] Permission denied: b'${chemin}'` };
          if (!c.verifier) {
            h.placer('ansible', chemin, { type: 'dossier', enfants: {}, proprio: 'root', groupe: 'root', mode: 'rwxr-xr-x' });
            appliquerAttributs(h, chemin, a);
          }
          return { changed: true };
        }
      } else if (etat === 'touch') {
        if (!n) {
          if (!peutEcrire(h, chemin)) return nonEcrivable(dossierDe(chemin));
          if (!c.verifier) ecrireFichier(h, chemin, '', a);
          return { changed: true };
        }
      } else if (!n) return { changed: false, failed: true, msg: `file (${chemin}) is absent, cannot continue` };
      const change = attributsChangent(h, chemin, a);
      if (change && h.qui !== 'root') return { changed: false, failed: true, msg: `chown failed: [Errno 1] Operation not permitted: b'${chemin}'` };
      if (change && !c.verifier) appliquerAttributs(h, chemin, a);
      return { changed: change };
    },
  },
  lineinfile: {
    params: ['path', 'dest', 'line', 'regexp', 'state', 'create', 'insertafter', 'insertbefore', 'backup', 'owner', 'group', 'mode', 'validate'],
    requis: ['path'],
    lancer: (h, a, c) => {
      const chemin = chaine(a.path ?? a.dest)!;
      const etat = chaine(a.state) ?? 'present';
      const ligne = chaine(a.line);
      const avant = h.lire(chemin);
      if (avant === null && !booleen(a.create)) return { changed: false, failed: true, msg: `Destination ${chemin} does not exist !`, donnees: { rc: 257 } };
      const lignes = (avant ?? '').replace(/\n$/, '').split('\n').filter((l, i, t) => !(t.length === 1 && l === ''));
      let re: RegExp | null = null;
      try {
        re = a.regexp ? new RegExp(chaine(a.regexp)!) : null;
      } catch {
        return { changed: false, failed: true, msg: `Invalid regular expression: ${chaine(a.regexp)}` };
      }
      let nouvelles = [...lignes];
      if (etat === 'absent') nouvelles = lignes.filter((l) => !(re ? re.test(l) : l === ligne));
      else {
        if (ligne === undefined) return { changed: false, failed: true, msg: 'line is required with state=present' };
        const indice = re ? lignes.map((l, k) => (re!.test(l) ? k : -1)).filter((k) => k >= 0).at(-1) : undefined;
        if (indice !== undefined) nouvelles[indice] = ligne;
        else if (!lignes.includes(ligne)) nouvelles.push(ligne);
      }
      const apres = nouvelles.join('\n') + (nouvelles.length ? '\n' : '');
      const change = apres.replace(/\n$/, '') !== (avant ?? '').replace(/\n$/, '');
      if (change && !peutEcrire(h, chemin))
        return { changed: false, failed: true, msg: `The destination directory (${dossierDe(chemin)}) is not writable by the current user. Error was: [Errno 13] Permission denied: b'${dossierDe(chemin)}/.ansible_tmp'` };
      if (change && !c.verifier) ecrireFichier(h, chemin, apres, a);
      return { changed: change, msg: change ? (etat === 'absent' ? 'line(s) removed' : 'line replaced') : '', diff: change ? differencer(chemin, avant ?? '', apres) : undefined };
    },
  },
  user: {
    params: ['name', 'state', 'shell', 'groups', 'append', 'create_home', 'comment', 'home', 'system', 'uid'],
    requis: ['name'],
    lancer: (h, a, c) => {
      const nom = chaine(a.name)!;
      const existe = !!h.comptes.utilisateurs[nom];
      const etat = chaine(a.state) ?? 'present';
      if (h.qui !== 'root') return { changed: false, failed: true, msg: `useradd: Permission denied.\nuseradd: cannot lock /etc/passwd; try again later.\n`, donnees: { rc: 1 } };
      if (etat === 'absent') {
        if (existe && !c.verifier) delete h.comptes.utilisateurs[nom];
        return { changed: existe };
      }
      const groupes = liste(a.groups);
      const manquants = groupes.filter((g) => !h.comptes.groupes[g]);
      if (manquants.length) return { changed: false, failed: true, msg: `Group ${manquants[0]} does not exist` };
      const dans = (g: string) => h.comptes.groupes[g]?.membres.includes(nom);
      const shellVoulu = chaine(a.shell);
      const change = !existe || groupes.some((g) => !dans(g)) || (!!shellVoulu && h.comptes.utilisateurs[nom]?.shell !== shellVoulu);
      if (change && !c.verifier) {
        if (!existe) {
          const uid = Math.max(1000, ...Object.values(h.comptes.utilisateurs).map((u) => u.uid)) + 1;
          h.comptes.groupes[nom] ??= { gid: uid, membres: [] };
          h.comptes.utilisateurs[nom] = { uid, groupe: nom, maison: `/home/${nom}`, shell: shellVoulu ?? '/bin/sh' };
          if (booleen(a.create_home, true) && !h.trouver(`/home/${nom}`)) h.placer('ansible', `/home/${nom}`, { type: 'dossier', enfants: {}, proprio: nom, groupe: nom, mode: 'rwxr-xr-x' });
        } else if (shellVoulu) h.comptes.utilisateurs[nom].shell = shellVoulu;
        for (const g of groupes) if (!dans(g)) h.comptes.groupes[g].membres.push(nom);
      }
      return { changed: change };
    },
  },
  service: {
    params: ['name', 'state', 'enabled', 'daemon_reload'],
    requis: ['name'],
    lancer: (h, a, c) => {
      const voulu = chaine(a.name)!.replace(/\.service$/, '');
      const sd = systemd(h);
      const nom = sd && !sd.services[voulu] && voulu === 'sshd' && sd.services.ssh ? 'ssh' : voulu;
      const s = sd?.services[nom];
      if (!sd || !s) return { changed: false, failed: true, msg: `Could not find the requested service ${voulu}: host` };
      const etat = chaine(a.state);
      if (h.qui !== 'root' && (etat || a.enabled !== undefined))
        return { changed: false, failed: true, msg: `Unable to ${etat?.replace(/ed$/, '') ?? 'enable'} service ${voulu}: Failed to ${etat?.replace(/ed$/, '') ?? 'enable'} ${nom}.service: Interactive authentication required.\n` };
      let change = false;
      if (a.enabled !== undefined && booleen(a.enabled) !== s.active) {
        change = true;
        if (!c.verifier) s.active = booleen(a.enabled);
      }
      if (etat === 'started' && s.etat !== 'active') {
        change = true;
        if (!c.verifier && !demarrer(h, sd, nom)) return { changed: false, failed: true, msg: `Unable to start service ${nom}: Job for ${nom}.service failed because the control process exited with error code.` };
      } else if (etat === 'stopped' && s.etat === 'active') {
        change = true;
        if (!c.verifier) arreter(h, sd, nom);
      } else if (etat === 'restarted' || etat === 'reloaded') {
        change = true;
        if (!c.verifier) {
          if (etat === 'restarted' || s.etat !== 'active') {
            if (s.etat === 'active') arreter(h, sd, nom);
            if (!demarrer(h, sd, nom)) return { changed: false, failed: true, msg: `Unable to restart service ${nom}: Job for ${nom}.service failed because the control process exited with error code.` };
          } else if (!recharger(h, sd, nom)) return { changed: false, failed: true, msg: `Unable to reload service ${nom}: Job for ${nom}.service failed because the control process exited with error code.` };
        }
      }
      return { changed: change, donnees: { name: nom, state: s.etat === 'active' ? 'started' : 'stopped' } };
    },
  },
  command: {
    params: ['_raw_params', 'cmd', 'chdir', 'creates', 'removes'],
    lancer: (h, a, c) => executer(h, a, c, false),
  },
  shell: {
    params: ['_raw_params', 'cmd', 'chdir', 'creates', 'removes', 'executable'],
    lancer: (h, a, c) => executer(h, a, c, true),
  },
};
MODULES.systemd = MODULES.service;
MODULES.systemd_service = MODULES.service;

// command et shell : la commande tourne sur l'hôte ; « changed » à chaque fois (Ansible ne peut pas savoir).
function executer(h: Shell, a: Args, c: Contexte, shell: boolean): Resultat {
  const cmd = chaine(a._raw_params ?? a.cmd) ?? '';
  const creates = chaine(a.creates);
  if (creates && h.trouver(creates)) return { changed: false, msg: `Did not run command since '${creates}' exists`, rc: 0, stdout: `skipped, since ${creates} exists` };
  if (c.verifier) return { changed: false, skipped: true, msg: 'Command would have run if not in check mode' };
  // command ne passe pas par un shell : ni redirection, ni tube, ni variable.
  const ligne = shell ? cmd : cmd.replace(/[|>&;]/g, (x) => `'${x}'`);
  const r = h.sousCommande(ligne, chaine(a.chdir) ?? h.comptes.utilisateurs[h.qui]?.maison ?? '/');
  const erreurs = h.recupererErreurs().join('\n');
  const echoue = r.code !== 0;
  // En échec, ce que la commande a écrit est son erreur (stderr).
  const stdout = echoue ? '' : r.sortie;
  const stderr = echoue ? [erreurs, r.sortie].filter(Boolean).join('\n') : erreurs;
  const donnees = { cmd: shell ? cmd : cmd.split(/\s+/), rc: r.code, stderr, stderr_lines: stderr ? stderr.split('\n') : [], stdout, stdout_lines: stdout ? stdout.split('\n') : [] };
  if (echoue) return { changed: true, failed: true, msg: 'non-zero return code', rc: r.code, stdout, donnees: { ...donnees, msg: 'non-zero return code' } };
  return { changed: true, rc: 0, stdout: r.sortie, donnees };
}

/** Le nom court d'un module (ansible.builtin.copy → copy), ou null s'il est inconnu. */
export const moduleDe = (nom: string): string | null => {
  const court = nom.replace(/^ansible\.(builtin|legacy)\./, '');
  return MODULES[court] ? court : null;
};

// « name=htop state=present » : les arguments en ligne (k=v), ou la commande de command/shell.
export function argumentsEnLigne(module: string, texte: string): Args {
  if (module === 'command' || module === 'shell') {
    const args: Args = {};
    const reste = texte.replace(/\b(chdir|creates|removes)=(\S+)/g, (_, k: string, v: string) => {
      args[k] = v;
      return '';
    });
    args._raw_params = reste.trim();
    return args;
  }
  const args: Args = {};
  for (const m of texte.matchAll(/([\w]+)=("[^"]*"|'[^']*'|\S+)/g)) args[m[1]] = m[2].replace(/^["']|["']$/g, '');
  return args;
}

// {{ variable }} : remplacé par la valeur (variables de l'hôte, puis du play).
function remplacer(v: Valeur, vars: Record<string, string>): Valeur {
  if (typeof v === 'string')
    return v.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (tout, nom: string) => {
      if (nom in vars) return vars[nom];
      throw new Error(`'${nom}' is undefined`);
    });
  if (Array.isArray(v)) return v.map((x) => remplacer(x, vars));
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remplacer(x, vars)]));
}

/** Lance un module sur un hôte, avec ou sans become. */
export function lancerModule(c: Contexte, h: Shell, module: string, args: Args, become: boolean): Resultat {
  const m = MODULES[module];
  const inconnus = Object.keys(args).filter((k) => !m.params.includes(k) && k !== '_raw_params');
  if (inconnus.length)
    return {
      changed: false,
      failed: true,
      msg: `Unsupported parameters for (ansible.builtin.${module}) module: ${inconnus.join(', ')}. Supported parameters include: ${[...m.params].filter((p) => p !== '_raw_params').sort().join(', ')}.`,
    };
  const manquants = (m.requis ?? []).filter((r) => !(r in args) && !(r === 'path' && ('dest' in args || 'name' in args)) && !(r === 'name' && 'pkg' in args));
  if (manquants.length) return { changed: false, failed: true, msg: `missing required arguments: ${manquants.join(', ')}` };
  const qui = h.qui;
  if (become) h.qui = 'root';
  try {
    return m.lancer(h, args, c, become);
  } finally {
    h.qui = qui;
  }
}

// ——— Les playbooks ———

export interface Tache {
  nom: string;
  module: string;
  args: Args;
  become?: boolean;
  notify: string[];
  changedWhen?: boolean;
  ligne: number;
  ecoute?: string[];
}

export interface Play {
  nom: string;
  hotes: string;
  become: boolean;
  faits: boolean;
  vars: Record<string, string>;
  taches: Tache[];
  handlers: Tache[];
}

export class ErreurAnsible extends Error {}

const MOTS_TACHE = ['name', 'become', 'become_user', 'notify', 'changed_when', 'tags', 'listen', 'check_mode', 'ignore_errors', 'vars', 'register', 'when', 'loop'];
const MOTS_PLAY = ['name', 'hosts', 'become', 'become_user', 'gather_facts', 'vars', 'tasks', 'handlers', 'remote_user', 'pre_tasks', 'post_tasks', 'serial'];

// « The offending line appears to be » : la ligne, et un ^ sous la colonne.
const apparait = (fichier: string, texte: string, ligne: number, colonne: number) => {
  const l = texte.split('\n')[ligne - 1] ?? '';
  const avant = texte.split('\n')[ligne - 2];
  return `The error appears to be in '${fichier}': line ${ligne}, column ${colonne}, but may\nbe elsewhere in the file depending on the exact syntax problem.\n\nThe offending line appears to be:\n\n${avant !== undefined ? `${avant}\n` : ''}${l}\n${' '.repeat(Math.max(0, colonne - 1))}^ here`;
};

function lireTache(t: Valeur, fichier: string, texte: string, ligne: number): Tache {
  if (typeof t !== 'object' || Array.isArray(t)) throw new ErreurAnsible(`ERROR! A malformed block was encountered while loading tasks: ${chaine(t)} should be a list or None\n\n${apparait(fichier, texte, ligne, 3)}`);
  const cles = Object.keys(t);
  const modules = cles.filter((k) => !MOTS_TACHE.includes(k));
  if (!modules.length) throw new ErreurAnsible(`ERROR! no module/action detected in task.\n\n${apparait(fichier, texte, ligne, 3)}`);
  if (modules.length > 1) {
    const connus = modules.filter((k) => moduleDe(k));
    if (connus.length > 1) throw new ErreurAnsible(`ERROR! conflicting action statements: ${connus.join(', ')}\n\n${apparait(fichier, texte, ligne, 3)}`);
    const inconnu = modules.find((k) => !moduleDe(k))!;
    throw new ErreurAnsible(`ERROR! couldn't resolve module/action '${inconnu}'. This often indicates a misspelling, missing collection, or incorrect module path.\n\n${apparait(fichier, texte, ligne, 3)}`);
  }
  const brut = modules[0];
  const module = moduleDe(brut);
  if (!module) throw new ErreurAnsible(`ERROR! couldn't resolve module/action '${brut}'. This often indicates a misspelling, missing collection, or incorrect module path.\n\n${apparait(fichier, texte, ligne, 3)}`);
  const valeur = t[brut];
  const args: Args = typeof valeur === 'string' ? argumentsEnLigne(module, valeur) : Array.isArray(valeur) ? {} : { ...valeur };
  if ((module === 'command' || module === 'shell') && typeof valeur === 'object' && !Array.isArray(valeur) && valeur.cmd) args._raw_params = valeur.cmd;
  return {
    nom: chaine(t.name) ?? `${module}`,
    module,
    args,
    become: t.become === undefined ? undefined : booleen(t.become),
    notify: liste(t.notify),
    changedWhen: t.changed_when === undefined ? undefined : booleen(t.changed_when),
    ligne,
    ecoute: liste(t.listen),
  };
}

/** Lit un playbook : une liste de plays ; lève ErreurAnsible au format d'Ansible. */
export function lirePlaybook(texte: string, fichier: string): Play[] {
  let donnees: Valeur;
  try {
    donnees = lireYaml(texte);
  } catch (e) {
    if (!(e instanceof ErreurYaml)) throw e;
    throw new ErreurAnsible(`ERROR! Syntax Error while loading YAML.\n  ${e.message}\n\n${apparait(fichier, texte, e.ligne, e.colonne)}`);
  }
  if (!Array.isArray(donnees)) throw new ErreurAnsible(`ERROR! A playbook must be a list of plays, got a ${typeof donnees === 'string' ? 'AnsibleUnicode' : 'AnsibleMapping'} instead\n\nThe error appears to be in '${fichier}': line 1, column 1, but may\nbe elsewhere in the file depending on the exact syntax problem.`);
  // Les numéros de ligne des « - name: » (pour les messages).
  const lignesTaches = texte.split('\n').map((l, i) => (/^\s*- /.test(l) ? i + 1 : 0)).filter(Boolean);
  let k = 0;
  return donnees.map((p) => {
    if (typeof p !== 'object' || Array.isArray(p)) throw new ErreurAnsible(`ERROR! A malformed play was found.`);
    const inconnu = Object.keys(p).find((x) => !MOTS_PLAY.includes(x));
    if (inconnu) throw new ErreurAnsible(`ERROR! '${inconnu}' is not a valid attribute for a Play\n\n${apparait(fichier, texte, lignesTaches[k] ?? 1, 3)}`);
    if (!p.hosts) throw new ErreurAnsible(`ERROR! the field 'hosts' is required but was not set`);
    k++;
    const taches = (Array.isArray(p.tasks) ? p.tasks : []).map((t) => lireTache(t, fichier, texte, lignesTaches[k++] ?? 1));
    const handlers = (Array.isArray(p.handlers) ? p.handlers : []).map((t) => lireTache(t, fichier, texte, lignesTaches[k++] ?? 1));
    const vars = typeof p.vars === 'object' && !Array.isArray(p.vars) ? Object.fromEntries(Object.entries(p.vars).map(([n, v]) => [n, chaine(v) ?? ''])) : {};
    return { nom: chaine(p.name) ?? chaine(p.hosts)!, hotes: chaine(p.hosts)!, become: booleen(p.become), faits: !faux(chaine(p.gather_facts)), vars, taches, handlers };
  });
}

// La bannière d'Ansible : le titre, puis des * jusqu'à 80 colonnes.
export const banniere = (titre: string) => `${titre} ${'*'.repeat(Math.max(3, 79 - titre.length))}`;

export interface Bilan {
  ok: number;
  changed: number;
  unreachable: number;
  failed: number;
  skipped: number;
  rescued: number;
  ignored: number;
}

const nouveauBilan = (): Bilan => ({ ok: 0, changed: 0, unreachable: 0, failed: 0, skipped: 0, rescued: 0, ignored: 0 });

export interface Execution {
  fichier?: string;
  verifier: boolean;
  hotes: Record<string, Bilan>;
  // Les chemins changés sur chaque hôte (pour les histoires).
  changes: Record<string, string[]>;
}

/** Joue un playbook ; renvoie la sortie, le bilan et le code de retour. */
export function jouer(c: Contexte, plays: Play[], limite: string | null, forcer = false): { execution: Execution; code: number } {
  const execution: Execution = { verifier: c.verifier, hotes: {}, changes: {} };
  const bilans = execution.hotes;
  const morts = new Set<string>();
  const sortie = c.sorties;
  let auMoinsUn = false;
  for (const p of plays) {
    let hotes = hotesDu(c.inventaire, p.hotes);
    if (limite) hotes = hotes.filter((h) => hotesDu(c.inventaire, limite).includes(h));
    if (motifInconnu(c.inventaire, p.hotes)) sortie.push(`[WARNING]: Could not match supplied host pattern, ignoring: ${p.hotes}`);
    sortie.push('', banniere(`PLAY [${p.nom}]`));
    if (!hotes.length) {
      sortie.push('skipping: no hosts matched');
      continue;
    }
    auMoinsUn = true;
    for (const h of hotes) bilans[h] ??= nouveauBilan();
    const vivants = () => hotes.filter((h) => !morts.has(h));
    const notifies: Record<string, Set<string>> = {};
    const tache = (t: Tache, gestionnaire = false) => {
      // --force-handlers : un handler notifié tourne même sur un hôte qui a échoué ensuite (pas sur un hôte injoignable).
      const candidats = gestionnaire && forcer ? hotes.filter((h) => bilans[h].unreachable === 0) : vivants();
      const actifs = candidats.filter((h) => !gestionnaire || notifies[t.nom]?.has(h) || t.ecoute?.some((e) => notifies[e]?.has(h)));
      if (!actifs.length) return;
      sortie.push('', banniere(`${gestionnaire ? 'RUNNING HANDLER' : 'TASK'} [${t.nom}]`));
      for (const h of actifs) {
        const s = joindre(c, h);
        if (typeof s === 'string') {
          sortie.push(`fatal: [${h}]: UNREACHABLE! => ${jsonLigne({ changed: false, msg: s, unreachable: true })}`);
          bilans[h].unreachable++;
          morts.add(h);
          continue;
        }
        let r: Resultat;
        try {
          const vars = { ...p.vars, ...(c.inventaire.hotes[h] ?? {}), inventory_hostname: h };
          r = lancerModule(c, s, t.module, remplacer(t.args, vars) as Args, t.become ?? p.become);
        } catch (e) {
          r = { changed: false, failed: true, msg: `The task includes an option with an undefined variable. The error was: ${(e as Error).message}` };
        }
        if (t.changedWhen === false && !r.failed) r.changed = false;
        if (r.failed) {
          const donnees = { changed: r.changed, ...(r.donnees ?? {}), msg: r.msg };
          sortie.push(`fatal: [${h}]: FAILED! => ${jsonLigne(donnees)}`);
          bilans[h].failed++;
          morts.add(h);
          continue;
        }
        if (r.skipped) {
          sortie.push(`skipping: [${h}]`);
          bilans[h].skipped++;
          continue;
        }
        if (c.difference && r.diff) sortie.push(r.diff);
        if (t.module === 'debug') sortie.push(`ok: [${h}] => ${json(r.donnees)}`);
        else sortie.push(`${r.changed ? 'changed' : 'ok'}: [${h}]`);
        bilans[h].ok++;
        if (r.changed) {
          bilans[h].changed++;
          const chemin = chaine(t.args.dest ?? t.args.path ?? t.args.name);
          if (chemin) (execution.changes[h] ??= []).push(chemin);
          for (const n of t.notify) {
            if (!p.handlers.some((x) => x.nom === n || x.ecoute?.includes(n)))
              throw new ErreurAnsible(`ERROR! The requested handler '${n}' was not found in either the main handlers list nor in the listening handlers list`);
            (notifies[n] ??= new Set()).add(h);
          }
        }
      }
    };
    if (p.faits) {
      sortie.push('', banniere('TASK [Gathering Facts]'));
      for (const h of vivants()) {
        const s = joindre(c, h);
        if (typeof s === 'string') {
          sortie.push(`fatal: [${h}]: UNREACHABLE! => ${jsonLigne({ changed: false, msg: s, unreachable: true })}`);
          bilans[h].unreachable++;
          morts.add(h);
        } else {
          sortie.push(`ok: [${h}]`);
          bilans[h].ok++;
        }
      }
    }
    for (const t of p.taches) {
      if (!vivants().length) break;
      tache(t);
    }
    for (const g of p.handlers) tache(g, true);
    if (!vivants().length) sortie.push('', 'NO MORE HOSTS LEFT *************************************************************');
  }
  if (!auMoinsUn) sortie.push('', '[WARNING]: No hosts matched, nothing to do');
  sortie.push('', banniere('PLAY RECAP'));
  for (const [h, b] of Object.entries(bilans))
    sortie.push(
      `${h.padEnd(26)} : ${[`ok=${b.ok}`, `changed=${b.changed}`, `unreachable=${b.unreachable}`, `failed=${b.failed}`, `skipped=${b.skipped}`, `rescued=${b.rescued}`, `ignored=${b.ignored}`]
        .map((x) => x.padEnd(x.indexOf('=') + 5))
        .join(' ')}`,
    );
  sortie.push('');
  const code = Object.values(bilans).some((b) => b.unreachable) ? 4 : Object.values(bilans).some((b) => b.failed) ? 2 : 0;
  return { execution, code };
}

/** Les commandes ad-hoc (ansible MOTIF -m MODULE -a ARGS) : une ligne par hôte. */
export function adhoc(c: Contexte, motif: string, module: string, texte: string, become: boolean): { lignes: string[]; code: number; resultats: Record<string, 'SUCCESS' | 'CHANGED' | 'FAILED' | 'UNREACHABLE'> } {
  const lignes: string[] = [];
  const resultats: Record<string, 'SUCCESS' | 'CHANGED' | 'FAILED' | 'UNREACHABLE'> = {};
  let code = 0;
  for (const h of hotesDu(c.inventaire, motif)) {
    const s = joindre(c, h);
    if (typeof s === 'string') {
      lignes.push(`${h} | UNREACHABLE! => ${json({ changed: false, msg: s, unreachable: true })}`);
      resultats[h] = 'UNREACHABLE';
      code = 4;
      continue;
    }
    const r = lancerModule(c, s, module, argumentsEnLigne(module, texte), become);
    if (module === 'command' || module === 'shell') {
      const etat = r.failed ? 'FAILED' : r.changed ? 'CHANGED' : 'SUCCESS';
      lignes.push(`${h} | ${etat} | rc=${r.rc ?? 0} >>`, ...(r.stdout ? [r.stdout] : []), ...(r.failed ? [String((r.donnees?.stderr as string) ?? '')] : []));
      resultats[h] = etat;
      if (r.failed && code < 2) code = 2;
      continue;
    }
    if (r.failed) {
      lignes.push(`${h} | FAILED! => ${json({ changed: false, ...(r.donnees ?? {}), msg: r.msg })}`);
      resultats[h] = 'FAILED';
      if (code < 2) code = 2;
      continue;
    }
    const etat = r.changed ? 'CHANGED' : 'SUCCESS';
    resultats[h] = etat;
    lignes.push(`${h} | ${etat} => ${json({ ansible_facts: { discovered_interpreter_python: '/usr/bin/python3' }, changed: r.changed, ...(r.donnees ?? {}) })}`);
  }
  return { lignes, code, resultats };
}

// ——— ansible-doc ———

// La documentation des modules (abrégée, en anglais comme ansible-doc).
export const DOCS: Record<string, { court: string; options: Record<string, string>; exemple: string }> = {
  ping: { court: 'Try to connect to host, verify a usable python and return `pong\' on success', options: { data: 'Data to return for the `ping\' return value.' }, exemple: '- name: Example from an Ansible Playbook\n  ansible.builtin.ping:' },
  apt: {
    court: 'Manages apt-packages',
    options: { name: 'A list of package names, like `foo\', or package specifier with version, like `foo=1.0\'.', state: 'Indicates the desired package state. `latest\' ensures that the latest version is installed. (Choices: absent, latest, present; default: present)', update_cache: 'Run the equivalent of `apt-get update\' before the operation.' },
    exemple: '- name: Install apache httpd (state=present is optional)\n  ansible.builtin.apt:\n    name: apache2\n    state: present',
  },
  copy: {
    court: 'Copy files to remote locations',
    options: { content: 'When used instead of `src\', sets the contents of a file directly to the specified value.', src: 'Local path to a file to copy to the remote server.', dest: 'Remote absolute path where the file should be copied to. (required)', owner: 'Name of the user that should own the filesystem object.', group: 'Name of the group that should own the filesystem object.', mode: 'The permissions the resulting filesystem object should have, like \'0644\'.' },
    exemple: '- name: Copy using inline content\n  ansible.builtin.copy:\n    content: \'# This file was moved to /etc/other.conf\'\n    dest: /etc/mine.conf',
  },
  file: {
    court: 'Manage files and file properties',
    options: { path: 'Path to the file being managed. (required)', state: 'If `directory\', all intermediate subdirectories will be created if they do not exist. If `absent\', directories will be recursively deleted. (Choices: absent, directory, file, hard, link, touch; default: file)', mode: 'The permissions the resulting filesystem object should have.', owner: 'Name of the user that should own the filesystem object.' },
    exemple: '- name: Create a directory if it does not exist\n  ansible.builtin.file:\n    path: /etc/some_directory\n    state: directory\n    mode: \'0755\'',
  },
  lineinfile: {
    court: 'Manage lines in text files',
    options: { path: 'The file to modify. (required)', regexp: 'The regular expression to look for in every line of the file. When modifying a line the regexp should typically match both the initial state of the line as well as its state after replacement by `line\' to ensure idempotence.', line: 'The line to insert/replace into the file.', state: 'Whether the line should be there or not. (Choices: absent, present; default: present)', create: 'Used with `state=present\'. If specified, the file will be created if it does not already exist.' },
    exemple: '- name: Ensure SELinux is set to enforcing mode\n  ansible.builtin.lineinfile:\n    path: /etc/selinux/config\n    regexp: \'^SELINUX=\'\n    line: SELINUX=enforcing',
  },
  user: {
    court: 'Manage user accounts',
    options: { name: 'Name of the user to create, remove or modify. (required)', state: 'Whether the account should exist or not. (Choices: absent, present; default: present)', shell: 'Optionally set the user\'s shell.', groups: 'A list of supplementary groups which the user is also a member of.', append: 'If `true\', add the user to the groups specified in `groups\'.' },
    exemple: '- name: Add the user \'johnd\' with a specific uid and a primary group of \'admin\'\n  ansible.builtin.user:\n    name: johnd\n    comment: John Doe',
  },
  service: {
    court: 'Manage services',
    options: { name: 'Name of the service. (required)', state: '`started\'/`stopped\' are idempotent actions that will not run commands unless necessary. `restarted\' will always bounce the service. `reloaded\' will always reload. (Choices: reloaded, restarted, started, stopped)', enabled: 'Whether the service should start on boot.' },
    exemple: '- name: Restart service httpd, in all cases\n  ansible.builtin.service:\n    name: httpd\n    state: restarted',
  },
  command: {
    court: 'Execute commands on targets',
    options: { cmd: 'The command to run.', creates: 'A filename or (since 2.0) glob pattern. If a matching file already exists, this step will not be run.', chdir: 'Change into this directory before running the command.' },
    exemple: '- name: Run command if /path/to/database does not exist (without \'args\')\n  ansible.builtin.command: /usr/bin/make_database.sh db_user db_name creates=/path/to/database',
  },
  shell: {
    court: 'Execute shell commands on targets',
    options: { cmd: 'The shell command to run.', creates: 'A filename, when it already exists, this step will not be run.', chdir: 'Change into this directory before running the command.' },
    exemple: '- name: Execute the command in remote shell; stdout goes to the specified file on the remote\n  ansible.builtin.shell: somescript.sh >> somelog.txt',
  },
  debug: { court: 'Print statements during execution', options: { msg: 'The customized message that is printed. If omitted, prints a generic message.' }, exemple: '- name: Print the gateway for each host when defined\n  ansible.builtin.debug:\n    msg: System {{ inventory_hostname }} has gateway {{ ansible_default_ipv4.gateway }}' },
};
DOCS.systemd = { ...DOCS.service, court: 'Manage systemd units' };

export const modulesConnus = () => Object.keys(DOCS).sort();
