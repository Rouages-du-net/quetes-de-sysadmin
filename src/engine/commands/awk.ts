// awk : un petit langage pour découper des lignes en champs, filtrer et
// compter. Debian installe mawk (awk est un lien vers lui) ; on suit POSIX
// (https://pubs.opengroup.org/onlinepubs/9799919799/utilities/awk.html) et
// les messages de mawk.
// Ce qui est simulé : BEGIN, END, motifs (expressions, /regex/), actions
// (print, printf, if/else, for, for…in, while, next, delete), champs ($1,
// $NF, $0), NR, NF, FS, OFS, tableaux associatifs, opérateurs (arithmétique,
// comparaisons, ~ et !~, &&, ||, !, concaténation, ++, +=…), fonctions
// length, substr, index, split, sub, gsub, tolower, toupper, int, sprintf ;
// options -F et -v.
// Écarts : pas de getline, de redirection dans print, de fonctions définies
// par l'utilisateur, ni d'opérateur ternaire.

import type { Commande } from './index';

type Valeur = string | number;

class ErreurAwk extends Error {}

// ——— Découpage en jetons ———

interface Jeton {
  type: 'nombre' | 'chaine' | 'regex' | 'nom' | 'mot' | 'op' | 'fin';
  valeur: string;
}

const MOTS = ['BEGIN', 'END', 'print', 'printf', 'if', 'else', 'for', 'in', 'while', 'next', 'delete', 'getline'];
const OPS = [
  '&&',
  '||',
  '==',
  '!=',
  '<=',
  '>=',
  '!~',
  '++',
  '--',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '{',
  '}',
  '(',
  ')',
  '[',
  ']',
  ';',
  ',',
  '+',
  '-',
  '*',
  '/',
  '%',
  '<',
  '>',
  '!',
  '~',
  '=',
  '$',
  '\n',
];

function jetons(source: string): Jeton[] {
  const liste: Jeton[] = [];
  let i = 0;
  // Un / commence une regex là où on attend une valeur.
  const attendValeur = () => {
    const d = liste.at(-1);
    if (!d) return true;
    if (d.type === 'nombre' || d.type === 'chaine' || d.type === 'regex' || d.type === 'nom') return false;
    return !(d.type === 'op' && [')', ']', '++', '--', '$'].includes(d.valeur));
  };
  while (i < source.length) {
    const c = source[i];
    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }
    if (c === '#') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (c === '\\' && source[i + 1] === '\n') {
      i += 2;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(source[i + 1] ?? ''))) {
      const m = /^[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/.exec(source.slice(i))!;
      liste.push({ type: 'nombre', valeur: m[0] });
      i += m[0].length;
      continue;
    }
    if (c === '"') {
      let s = '';
      i++;
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\\') {
          const e = source[++i];
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e;
        } else s += source[i];
        i++;
      }
      if (source[i] !== '"') throw new ErreurAwk('runaway string constant "' + s.slice(0, 10) + ' ...');
      i++;
      liste.push({ type: 'chaine', valeur: s });
      continue;
    }
    if (c === '/' && attendValeur()) {
      let r = '';
      i++;
      while (i < source.length && source[i] !== '/') {
        if (source[i] === '\\' && source[i + 1] === '/') r += source[++i];
        else r += source[i];
        i++;
      }
      if (source[i] !== '/') throw new ErreurAwk('runaway regular expression /' + r.slice(0, 10) + ' ...');
      i++;
      liste.push({ type: 'regex', valeur: r });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i))!;
      liste.push({ type: MOTS.includes(m[0]) ? 'mot' : 'nom', valeur: m[0] });
      i += m[0].length;
      continue;
    }
    const op = OPS.find((o) => source.startsWith(o, i));
    if (!op) throw new ErreurAwk(`syntax error at or near ${c}`);
    liste.push({ type: 'op', valeur: op });
    i += op.length;
  }
  liste.push({ type: 'fin', valeur: 'end of file' });
  return liste;
}

// ——— Arbre ———

type Noeud =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'regex'; v: string }
  | { t: 'var'; nom: string }
  | { t: 'champ'; e: Noeud }
  | { t: 'elem'; nom: string; cle: Noeud[] }
  | { t: 'bin'; op: string; a: Noeud; b: Noeud }
  | { t: 'un'; op: string; e: Noeud }
  | { t: 'affect'; op: string; cible: Noeud; e: Noeud }
  | { t: 'incr'; op: string; pre: boolean; cible: Noeud }
  | { t: 'dans'; cle: Noeud[]; tableau: string }
  | { t: 'appel'; nom: string; args: Noeud[] }
  | { t: 'groupe'; e: Noeud };

type Instr =
  | { t: 'expr'; e: Noeud }
  | { t: 'print'; args: Noeud[] }
  | { t: 'printf'; args: Noeud[] }
  | { t: 'si'; cond: Noeud; alors: Instr; sinon?: Instr }
  | { t: 'pourDans'; variable: string; tableau: string; corps: Instr }
  | { t: 'pour'; init?: Instr; cond?: Noeud; pas?: Instr; corps: Instr }
  | { t: 'tantque'; cond: Noeud; corps: Instr }
  | { t: 'bloc'; corps: Instr[] }
  | { t: 'next' }
  | { t: 'delete'; nom: string; cle?: Noeud[] };

interface Regle {
  quand: 'BEGIN' | 'END' | 'ligne';
  motif?: Noeud;
  action?: Instr;
}

const FONCTIONS = ['length', 'substr', 'index', 'split', 'sub', 'gsub', 'tolower', 'toupper', 'int', 'sprintf', 'match'];

function analyser(source: string): Regle[] {
  const j = jetons(source);
  let p = 0;
  const voir = (v?: string) => (v === undefined ? j[p] : j[p].valeur === v && j[p].type !== 'chaine' ? j[p] : null);
  const erreur = (): never => {
    throw new ErreurAwk(`syntax error at or near ${j[p].type === 'fin' ? 'end of file' : j[p].valeur === '\n' ? 'end of line' : j[p].valeur}`);
  };
  const attendre = (v: string) => (voir(v) ? j[p++] : erreur());
  const sauterLignes = () => {
    while (voir('\n') || voir(';')) p++;
  };
  const sauterNl = () => {
    while (voir('\n')) p++;
  };

  // Expressions, de la priorité la plus basse à la plus haute.
  const expression = (sansSup = false): Noeud => affectation(sansSup);
  const affectation = (sansSup: boolean): Noeud => {
    const gauche = ou(sansSup);
    const op = ['=', '+=', '-=', '*=', '/=', '%='].find((o) => voir(o));
    if (op && (gauche.t === 'var' || gauche.t === 'champ' || gauche.t === 'elem')) {
      p++;
      return { t: 'affect', op, cible: gauche, e: affectation(sansSup) };
    }
    return gauche;
  };
  const ou = (s: boolean): Noeud => {
    let a = et(s);
    while (voir('||')) {
      p++;
      sauterNl();
      a = { t: 'bin', op: '||', a, b: et(s) };
    }
    return a;
  };
  const et = (s: boolean): Noeud => {
    let a = dans(s);
    while (voir('&&')) {
      p++;
      sauterNl();
      a = { t: 'bin', op: '&&', a, b: dans(s) };
    }
    return a;
  };
  const dans = (s: boolean): Noeud => {
    const a = correspond(s);
    if (voir('in') && j[p + 1].type === 'nom') {
      p++;
      return { t: 'dans', cle: [a], tableau: j[p++].valeur };
    }
    return a;
  };
  const correspond = (s: boolean): Noeud => {
    let a = comparaison(s);
    while (voir('~') || voir('!~')) {
      const op = j[p++].valeur;
      a = { t: 'bin', op, a, b: comparaison(s) };
    }
    return a;
  };
  const comparaison = (s: boolean): Noeud => {
    const a = concat();
    // Dans print, > serait une redirection (non simulée) : pas une comparaison.
    const op = ['==', '!=', '<=', '>=', '<', '>'].find((o) => voir(o) && !(s && o === '>'));
    if (op) {
      p++;
      return { t: 'bin', op, a, b: concat() };
    }
    return a;
  };
  // Deux valeurs côte à côte : concaténation.
  const debutValeur = () => {
    const t = j[p];
    if (t.type === 'nombre' || t.type === 'chaine' || t.type === 'regex' || t.type === 'nom') return true;
    // (+ et - entre deux valeurs sont des opérations, pas une concaténation.)
    return t.type === 'op' && ['$', '(', '++', '--'].includes(t.valeur);
  };
  const concat = (): Noeud => {
    let a = additif();
    while (debutValeur() && !voir('in')) a = { t: 'bin', op: 'concat', a, b: additif() };
    return a;
  };
  const additif = (): Noeud => {
    let a = multiplicatif();
    while (voir('+') || voir('-')) {
      const op = j[p++].valeur;
      a = { t: 'bin', op, a, b: multiplicatif() };
    }
    return a;
  };
  const multiplicatif = (): Noeud => {
    let a = unaire();
    while (voir('*') || voir('/') || voir('%')) {
      const op = j[p++].valeur;
      a = { t: 'bin', op, a, b: unaire() };
    }
    return a;
  };
  const unaire = (): Noeud => {
    if (voir('!')) {
      p++;
      return { t: 'un', op: '!', e: unaire() };
    }
    if (voir('-') || voir('+')) {
      const op = j[p++].valeur;
      return { t: 'un', op, e: unaire() };
    }
    return incrementation();
  };
  const incrementation = (): Noeud => {
    if (voir('++') || voir('--')) {
      const op = j[p++].valeur;
      return { t: 'incr', op, pre: true, cible: primaire() };
    }
    const e = primaire();
    if ((voir('++') || voir('--')) && (e.t === 'var' || e.t === 'champ' || e.t === 'elem'))
      return { t: 'incr', op: j[p++].valeur, pre: false, cible: e };
    return e;
  };
  const primaire = (): Noeud => {
    const t = j[p];
    if (t.type === 'nombre') return (p++, { t: 'num', v: Number(t.valeur) });
    if (t.type === 'chaine') return (p++, { t: 'str', v: t.valeur });
    if (t.type === 'regex') return (p++, { t: 'regex', v: t.valeur });
    if (voir('$')) {
      p++;
      return { t: 'champ', e: incrementationSansPostfixe() };
    }
    if (voir('(')) {
      p++;
      const e = expression();
      // (a, b) in tableau
      attendre(')');
      return { t: 'groupe', e };
    }
    if (t.type === 'nom') {
      p++;
      if (FONCTIONS.includes(t.valeur)) {
        const args: Noeud[] = [];
        if (voir('(')) {
          p++;
          if (!voir(')')) {
            args.push(expression());
            while (voir(',')) {
              p++;
              args.push(expression());
            }
          }
          attendre(')');
        }
        return { t: 'appel', nom: t.valeur, args };
      }
      if (voir('[')) {
        p++;
        const cle = [expression()];
        while (voir(',')) {
          p++;
          cle.push(expression());
        }
        attendre(']');
        return { t: 'elem', nom: t.valeur, cle };
      }
      return { t: 'var', nom: t.valeur };
    }
    return erreur();
  };
  // Après $ : un nombre, une variable, ou (expression).
  const incrementationSansPostfixe = (): Noeud => {
    if (voir('-')) {
      p++;
      return { t: 'un', op: '-', e: primaire() };
    }
    return primaire();
  };

  const listeExpressions = (): Noeud[] => {
    const args: Noeud[] = [];
    if (voir(';') || voir('\n') || voir('}') || j[p].type === 'fin') return args;
    // print (a, b) : les parenthèses entourent la liste.
    args.push(expression(true));
    while (voir(',')) {
      p++;
      sauterNl();
      args.push(expression(true));
    }
    if (args.length === 1 && args[0].t === 'groupe') return [args[0].e];
    return args;
  };

  const instruction = (): Instr => {
    sauterNl();
    if (voir('{')) return bloc();
    if (voir('if')) {
      p++;
      attendre('(');
      const cond = expression();
      attendre(')');
      const alors = instruction();
      const avant = p;
      sauterLignes();
      if (voir('else')) {
        p++;
        return { t: 'si', cond, alors, sinon: instruction() };
      }
      p = avant;
      return { t: 'si', cond, alors };
    }
    if (voir('while')) {
      p++;
      attendre('(');
      const cond = expression();
      attendre(')');
      return { t: 'tantque', cond, corps: instruction() };
    }
    if (voir('for')) {
      p++;
      attendre('(');
      if (j[p].type === 'nom' && j[p + 1].valeur === 'in' && j[p + 2].type === 'nom' && j[p + 3].valeur === ')') {
        const variable = j[p].valeur;
        const tableau = j[p + 2].valeur;
        p += 4;
        return { t: 'pourDans', variable, tableau, corps: instruction() };
      }
      const init = voir(';') ? undefined : ({ t: 'expr', e: expression() } as Instr);
      attendre(';');
      const cond = voir(';') ? undefined : expression();
      attendre(';');
      const pas = voir(')') ? undefined : ({ t: 'expr', e: expression() } as Instr);
      attendre(')');
      return { t: 'pour', init, cond, pas, corps: instruction() };
    }
    let i: Instr;
    if (voir('print')) {
      p++;
      i = { t: 'print', args: listeExpressions() };
    } else if (voir('printf')) {
      p++;
      i = { t: 'printf', args: listeExpressions() };
    } else if (voir('next')) {
      p++;
      i = { t: 'next' };
    } else if (voir('delete')) {
      p++;
      const nom = j[p].type === 'nom' ? j[p++].valeur : erreur();
      let cle: Noeud[] | undefined;
      if (voir('[')) {
        p++;
        cle = [expression()];
        attendre(']');
      }
      i = { t: 'delete', nom, cle };
    } else if (voir(';')) {
      i = { t: 'bloc', corps: [] };
    } else i = { t: 'expr', e: expression() };
    if (voir(';') || voir('\n')) p++;
    else if (!voir('}') && j[p].type !== 'fin') erreur();
    return i;
  };
  const bloc = (): Instr => {
    attendre('{');
    const corps: Instr[] = [];
    sauterLignes();
    while (!voir('}')) {
      if (j[p].type === 'fin') erreur();
      corps.push(instruction());
      sauterLignes();
    }
    p++;
    return { t: 'bloc', corps };
  };

  const regles: Regle[] = [];
  sauterLignes();
  while (j[p].type !== 'fin') {
    if (voir('BEGIN') || voir('END')) {
      const quand = j[p++].valeur as 'BEGIN' | 'END';
      sauterNl();
      regles.push({ quand, action: bloc() });
    } else if (voir('{')) regles.push({ quand: 'ligne', action: bloc() });
    else {
      const motif = expression();
      regles.push({ quand: 'ligne', motif, action: voir('{') ? bloc() : undefined });
    }
    sauterLignes();
  }
  return regles;
}

// ——— Exécution ———

class Suivante {}

const estNombre = (v: Valeur) => typeof v === 'number' || /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/.test(v);
const nombre = (v: Valeur): number => (typeof v === 'number' ? v : parseFloat(v) || 0);
// Un nombre affiché : entier tel quel, sinon %.6g (CONVFMT).
const texte = (v: Valeur): string => {
  if (typeof v === 'string') return v;
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toPrecision(6)));
};

function formater(format: string, args: Valeur[]): string {
  let i = 0;
  return format.replace(
    /%([-+ 0#]*)(\d+|\*)?(?:\.(\d+))?([a-zA-Z%])/g,
    (tout, drapeaux: string, largeurBrute: string | undefined, precision: string | undefined, conv: string) => {
      if (conv === '%') return '%';
      const largeur = largeurBrute === '*' ? nombre(args[i++] ?? 0) : Number(largeurBrute ?? 0);
      const v = args[i++] ?? '';
      let s: string;
      if (conv === 'd' || conv === 'i') s = String(Math.trunc(nombre(v)));
      else if (conv === 'f') s = nombre(v).toFixed(precision === undefined ? 6 : Number(precision));
      else if (conv === 'c') s = typeof v === 'number' ? String.fromCharCode(v) : v.charAt(0);
      else if (conv === 'x') s = Math.trunc(nombre(v)).toString(16);
      else if (conv === 's') s = precision === undefined ? texte(v) : texte(v).slice(0, Number(precision));
      else return tout;
      if (s.length < largeur)
        s = drapeaux.includes('-') ? s.padEnd(largeur) : s.padStart(largeur, drapeaux.includes('0') && conv !== 's' ? '0' : ' ');
      return s;
    },
  );
}

function executer(regles: Regle[], lignes: string[], variables: Record<string, Valeur>): string {
  const sortie: string[] = [];
  const tableaux: Record<string, Map<string, Valeur>> = {};
  const v: Record<string, Valeur> = { FS: ' ', OFS: ' ', ORS: '\n', NR: 0, NF: 0, SUBSEP: '\u001c', RSTART: 0, RLENGTH: -1, ...variables };
  let champs: string[] = [''];
  let pas = 0;
  const decouper = (ligne: string) => {
    const fs = texte(v.FS);
    const parties =
      fs === ' '
        ? ligne
            .trim()
            .split(/[ \t]+/)
            .filter(Boolean)
        : fs.length === 1
          ? ligne.split(fs)
          : ligne.split(new RegExp(fs));
    champs = [ligne, ...(ligne === '' ? [] : parties)];
    v.NF = champs.length - 1;
  };
  const reconstruire = () => {
    champs[0] = champs.slice(1).join(texte(v.OFS));
  };
  const tableau = (nom: string) => (tableaux[nom] ??= new Map());
  const cleDe = (cle: Noeud[]) => cle.map((c) => texte(evaluer(c))).join(texte(v.SUBSEP));
  const regex = (n: Noeud): RegExp => new RegExp(n.t === 'regex' ? n.v : texte(evaluer(n)));
  const lire = (n: Noeud): Valeur => evaluer(n);
  const ecrire = (cible: Noeud, valeur: Valeur) => {
    if (cible.t === 'var') {
      v[cible.nom] = valeur;
      if (cible.nom === 'NF') {
        champs = champs.slice(0, nombre(valeur) + 1);
        reconstruire();
      }
    } else if (cible.t === 'elem') tableau(cible.nom).set(cleDe(cible.cle), valeur);
    else if (cible.t === 'champ') {
      const k = Math.trunc(nombre(evaluer(cible.e)));
      if (k === 0) decouper(texte(valeur));
      else {
        while (champs.length <= k) champs.push('');
        champs[k] = texte(valeur);
        v.NF = champs.length - 1;
        reconstruire();
      }
    }
  };
  function evaluer(n: Noeud): Valeur {
    if (++pas > 2_000_000) throw new ErreurAwk('program too long to run here');
    switch (n.t) {
      case 'num':
        return n.v;
      case 'str':
        return n.v;
      case 'regex':
        return new RegExp(n.v).test(champs[0]) ? 1 : 0;
      case 'groupe':
        return evaluer(n.e);
      case 'var':
        return v[n.nom] ?? '';
      case 'champ': {
        const k = Math.trunc(nombre(evaluer(n.e)));
        if (k < 0) throw new ErreurAwk(`negative field index $${k}`);
        return champs[k] ?? '';
      }
      case 'elem':
        return tableau(n.nom).get(cleDe(n.cle)) ?? (tableau(n.nom).set(cleDe(n.cle), ''), '');
      case 'dans':
        return tableau(n.tableau).has(cleDe(n.cle)) ? 1 : 0;
      case 'un': {
        if (n.op === '!') return vrai(evaluer(n.e)) ? 0 : 1;
        const x = nombre(evaluer(n.e));
        return n.op === '-' ? -x : x;
      }
      case 'incr': {
        const avant = nombre(lire(n.cible));
        const apres = n.op === '++' ? avant + 1 : avant - 1;
        ecrire(n.cible, apres);
        return n.pre ? apres : avant;
      }
      case 'affect': {
        const valeur = evaluer(n.e);
        if (n.op === '=') {
          ecrire(n.cible, valeur);
          return valeur;
        }
        const a = nombre(lire(n.cible));
        const b = nombre(valeur);
        const r = n.op === '+=' ? a + b : n.op === '-=' ? a - b : n.op === '*=' ? a * b : n.op === '/=' ? a / b : a % b;
        ecrire(n.cible, r);
        return r;
      }
      case 'bin': {
        if (n.op === '&&') return vrai(evaluer(n.a)) && vrai(evaluer(n.b)) ? 1 : 0;
        if (n.op === '||') return vrai(evaluer(n.a)) || vrai(evaluer(n.b)) ? 1 : 0;
        if (n.op === '~' || n.op === '!~') {
          const ok = regex(n.b).test(texte(evaluer(n.a)));
          return (n.op === '~') === ok ? 1 : 0;
        }
        const a = evaluer(n.a);
        const b = evaluer(n.b);
        if (n.op === 'concat') return texte(a) + texte(b);
        if (['==', '!=', '<', '>', '<=', '>='].includes(n.op)) {
          // Comparaison numérique si les deux ressemblent à des nombres.
          const num = estNombre(a) && estNombre(b);
          const x = num ? nombre(a) : texte(a);
          const y = num ? nombre(b) : texte(b);
          const r = n.op === '==' ? x === y : n.op === '!=' ? x !== y : n.op === '<' ? x < y : n.op === '>' ? x > y : n.op === '<=' ? x <= y : x >= y;
          return r ? 1 : 0;
        }
        const x = nombre(a);
        const y = nombre(b);
        if ((n.op === '/' || n.op === '%') && y === 0) throw new ErreurAwk('division by zero');
        return n.op === '+' ? x + y : n.op === '-' ? x - y : n.op === '*' ? x * y : n.op === '/' ? x / y : x % y;
      }
      case 'appel':
        return appeler(n.nom, n.args);
    }
  }
  const vrai = (x: Valeur) => (typeof x === 'number' ? x !== 0 : x !== '');
  function appeler(nom: string, args: Noeud[]): Valeur {
    const a = (i: number) => evaluer(args[i]);
    switch (nom) {
      case 'length':
        if (args[0]?.t === 'var' && tableaux[args[0].nom]) return tableaux[args[0].nom].size;
        return texte(args.length ? a(0) : champs[0]).length;
      case 'substr': {
        const s = texte(a(0));
        const debut = Math.round(nombre(a(1)));
        const longueur = args.length > 2 ? Math.round(nombre(a(2))) : Infinity;
        const de = Math.max(1, debut);
        const jusqua = Math.min(s.length + 1, debut + longueur);
        return jusqua > de ? s.slice(de - 1, jusqua - 1) : '';
      }
      case 'index':
        return texte(a(0)).indexOf(texte(a(1))) + 1;
      case 'split': {
        const s = texte(a(0));
        const nomTableau = args[1]?.t === 'var' ? args[1].nom : '';
        const sep = args.length > 2 ? (args[2].t === 'regex' ? new RegExp(args[2].v) : texte(a(2))) : texte(v.FS);
        const parties =
          sep === ' '
            ? s
                .trim()
                .split(/[ \t]+/)
                .filter(Boolean)
            : s.split(sep);
        const t = tableau(nomTableau);
        t.clear();
        parties.forEach((x, i) => t.set(String(i + 1), x));
        return parties.length;
      }
      case 'sub':
      case 'gsub': {
        const re = new RegExp(args[0].t === 'regex' ? args[0].v : texte(a(0)), nom === 'gsub' ? 'g' : '');
        // Dans le remplacement, & est le texte trouvé, et \& un vrai &.
        const modele = texte(a(1));
        const cible: Noeud = args[2] ?? { t: 'champ', e: { t: 'num', v: 0 } };
        const avant = texte(lire(cible));
        let n = 0;
        const apres = avant.replace(re, (trouve: string) => (n++, modele.replace(/\\&|&/g, (x) => (x === '&' ? trouve : '&'))));
        if (n) ecrire(cible, apres);
        return n;
      }
      case 'match': {
        const m = new RegExp(args[1].t === 'regex' ? args[1].v : texte(a(1))).exec(texte(a(0)));
        v.RSTART = m ? m.index + 1 : 0;
        v.RLENGTH = m ? m[0].length : -1;
        return v.RSTART;
      }
      case 'tolower':
        return texte(a(0)).toLowerCase();
      case 'toupper':
        return texte(a(0)).toUpperCase();
      case 'int':
        return Math.trunc(nombre(a(0)));
      case 'sprintf':
        return formater(
          texte(a(0)),
          args.slice(1).map((x) => evaluer(x)),
        );
    }
    return '';
  }
  function faire(i: Instr): void {
    switch (i.t) {
      case 'expr':
        evaluer(i.e);
        return;
      case 'print':
        sortie.push(i.args.length ? i.args.map((x) => texte(evaluer(x))).join(texte(v.OFS)) : champs[0]);
        return;
      case 'printf': {
        const [format, ...reste] = i.args.map((x) => evaluer(x));
        sortie.push('\u0001' + formater(texte(format ?? ''), reste));
        return;
      }
      case 'si':
        if (vrai(evaluer(i.cond))) faire(i.alors);
        else if (i.sinon) faire(i.sinon);
        return;
      case 'tantque':
        while (vrai(evaluer(i.cond))) faire(i.corps);
        return;
      case 'pour':
        for (i.init && faire(i.init); i.cond ? vrai(evaluer(i.cond)) : true; i.pas && faire(i.pas)) faire(i.corps);
        return;
      case 'pourDans':
        for (const cle of [...tableau(i.tableau).keys()]) {
          v[i.variable] = cle;
          faire(i.corps);
        }
        return;
      case 'bloc':
        i.corps.forEach(faire);
        return;
      case 'next':
        throw new Suivante();
      case 'delete':
        if (i.cle) tableau(i.nom).delete(cleDe(i.cle));
        else tableau(i.nom).clear();
    }
  }
  for (const r of regles.filter((x) => x.quand === 'BEGIN')) faire(r.action!);
  for (const ligne of lignes) {
    v.NR = nombre(v.NR) + 1;
    decouper(ligne);
    try {
      for (const r of regles.filter((x) => x.quand === 'ligne')) {
        if (r.motif && !vrai(evaluer(r.motif))) continue;
        if (r.action) faire(r.action);
        else sortie.push(champs[0]);
      }
    } catch (e) {
      if (!(e instanceof Suivante)) throw e;
    }
  }
  for (const r of regles.filter((x) => x.quand === 'END')) faire(r.action!);
  // printf n'ajoute pas de fin de ligne : on recolle avec ce qui précède.
  let texteSortie = '';
  for (const s of sortie) texteSortie += s.startsWith('\u0001') ? s.slice(1) : s + '\n';
  return texteSortie.replace(/\n$/, '');
}

export const AWK: Record<string, Commande> = {
  awk: {
    propresOptions: true,
    lancer: ({ args, entree, jeu }) => {
      const variables: Record<string, Valeur> = {};
      const reste: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-F') variables.FS = args[++i] ?? ' ';
        else if (a.startsWith('-F')) variables.FS = a.slice(2);
        else if (a === '-v') {
          const [nom, ...valeur] = (args[++i] ?? '').split('=');
          variables[nom] = valeur.join('=');
        } else reste.push(a);
      }
      if (variables.FS === '\\t') variables.FS = '\t';
      const [programme, ...fichiers] = reste;
      if (programme === undefined) return jeu.erreur(jeu.t('awk-usage'));
      let regles: Regle[];
      try {
        regles = analyser(programme);
      } catch (e) {
        if (e instanceof ErreurAwk) return jeu.erreur(`awk: line 1: ${e.message}`);
        throw e;
      }
      const lignes: string[] = [];
      if (!fichiers.length) lignes.push(...(entree ?? '').split('\n').filter((l, i, t) => l !== '' || i < t.length - 1));
      for (const f of fichiers) {
        const t = jeu.lirePour('awk', f);
        if (t === null) return '';
        lignes.push(...t.split('\n'));
      }
      try {
        return executer(regles, lignes, variables);
      } catch (e) {
        if (e instanceof ErreurAwk) return jeu.erreur(`awk: run time error: ${e.message}`);
        if (e instanceof SyntaxError) return jeu.erreur(`awk: line 1: regular expression compile failed (${e.message})`);
        throw e;
      }
    },
  },
};
