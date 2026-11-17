// The IBM i Control Language (CL): how a command line is read, after IBM's
// "CL command syntax" and "Command definition" pages
// (https://www.ibm.com/docs/en/i/7.5?topic=language-cl-command-syntax,
// https://www.ibm.com/docs/en/i/7.5?topic=commands-command-definition).
//   - a command name (up to 10 characters), possibly qualified by its
//     library (QSYS/WRKACTJOB); case doesn't matter outside quotes;
//   - parameters: KEYWORD(value) in any order, or positional values (in
//     the command's order, up to its positional limit: MAXPOS);
//   - a value: a name (ORDERS), a qualified name (ORDERS/ORDHDR,
//     412907/ORDBATCH/ORDIMPORT), a special value (*ALL, *CURRENT), a
//     number, a quoted string ('/home/you/orders.csv', '' for a quote), or
//     a list of elements in parentheses (SELECT(ORDBATCH *ALL *ALL DEBUG));
//     a CMD parameter holds a whole command (CMD(CALL PGM(ORDERS/ORDIMP))).
// The analyser's errors are those of the message file QCPFMSG, each
// followed by CPF0001 "Error found on &1 command.".
// Simplifications (docs/SCENARIOS.md): no prompting (F4, ?), no
// continuation lines (+, -), no variables (&VAR) nor expressions (*CAT).

export interface ClCall {
  // The command's name, in capitals, without its library.
  name: string;
  library: string | null;
  // The positional values, in order, as written (before they are given keywords).
  positional: string[];
  // KEYWORD → the text between its parentheses, as written.
  keywords: Record<string, string>;
}

export interface ClError {
  id: string;
  text: string;
}

const NAME = /^[A-Z#@$][A-Z0-9_#@$.]{0,9}$/;

/** The words of a line, outside quotes and parentheses: KEYWORD(…), 'string', name… */
function words(line: string): string[] | ClError {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (/\s/.test(line[i])) {
      i++;
      continue;
    }
    let w = '';
    let depth = 0;
    let quoted = false;
    for (; i < line.length; i++) {
      const c = line[i];
      if (quoted) {
        w += c;
        if (c === "'") {
          if (line[i + 1] === "'") w += line[++i];
          else quoted = false;
        }
        continue;
      }
      if (c === "'") quoted = true;
      else if (c === '(') depth++;
      else if (c === ')') {
        depth--;
        if (depth < 0) return { id: 'CPD0013', text: 'A matching parenthesis not found.' };
      } else if (/\s/.test(c) && depth === 0) break;
      w += c;
    }
    if (quoted) return { id: 'CPD0018', text: 'Quoted string not ended.' };
    if (depth > 0) return { id: 'CPD0013', text: 'A matching parenthesis not found.' };
    out.push(w);
  }
  return out;
}

/** Reads a command line; returns the call, or the analyser's error. */
export function parseCl(line: string): ClCall | ClError {
  const w = words(line.trim());
  if (!Array.isArray(w)) return w;
  if (!w.length) return { id: '', text: '' };
  const [head, ...rest] = w;
  const parts = head.toUpperCase().split('/');
  const name = parts.at(-1)!;
  const library = parts.length > 1 ? parts[0] : null;
  if (parts.length > 2 || !NAME.test(name) || (library !== null && !NAME.test(library))) return { id: 'CPD0020', text: `Character '${head[0]}' not valid in command name.` };
  const call: ClCall = { name, library, positional: [], keywords: {} };
  for (const word of rest) {
    const m = /^([A-Za-z][A-Za-z0-9]*)\((.*)\)$/s.exec(word);
    if (m) {
      const kw = m[1].toUpperCase();
      if (kw in call.keywords) return { id: 'CPD0040', text: `Keyword ${kw} specified more than once.` };
      call.keywords[kw] = m[2];
    } else {
      if (Object.keys(call.keywords).length) return { id: 'CPD0006', text: 'Positional parameter not valid after a keyword parameter.' };
      call.positional.push(word);
    }
  }
  return call;
}

export const isError = <T extends object>(x: T | ClError): x is ClError => 'id' in x && 'text' in x && !('name' in x);

/** The elements of a value: blanks separate them, outside quotes and parentheses ("ORDBATCH *ALL *ALL DEBUG" → 4). */
export function elements(value: string): string[] {
  const w = words(value);
  return Array.isArray(w) ? w : [value];
}

/** A value as the command reads it: a quoted string loses its quotes ('' → '), the rest goes to capitals. */
export function plain(value: string): string {
  const v = value.trim();
  if (/^'.*'$/s.test(v)) return v.slice(1, -1).replace(/''/g, "'");
  return v.toUpperCase();
}

/** A qualified name: ORDERS/ORDHDR → { library: 'ORDERS', name: 'ORDHDR' }; ORDHDR → library *LIBL. */
export function qualified(value: string, byDefault = '*LIBL'): { library: string; name: string } {
  const v = plain(value);
  const i = v.lastIndexOf('/');
  return i < 0 ? { library: byDefault, name: v } : { library: v.slice(0, i), name: v.slice(i + 1) };
}

/** A qualified job name: number/user/name (or just name). */
export function jobName(value: string): { number?: string; user?: string; name: string } {
  const parts = plain(value).split('/');
  if (parts.length === 3) return { number: parts[0], user: parts[1], name: parts[2] };
  if (parts.length === 2) return { user: parts[0], name: parts[1] };
  return { name: parts[0] };
}

/** A command's parameters: their keywords in positional order, the positional limit, the required ones. */
export interface ClDefinition {
  params: string[];
  maxPos?: number;
  required?: string[];
}

/**
 * Gives keywords to the positional values and checks the call against the
 * command's definition: the parameters by keyword, or the analyser's error
 * (CPD0043, CPD0065, CPD0071).
 */
export function bind(call: ClCall, def: ClDefinition): Record<string, string> | ClError {
  const maxPos = def.maxPos ?? def.params.length;
  if (call.positional.length > maxPos) return { id: 'CPD0065', text: `Number of positional parameters exceeds limit of ${maxPos}.` };
  const out: Record<string, string> = {};
  call.positional.forEach((v, i) => (out[def.params[i]] = v));
  for (const [kw, v] of Object.entries(call.keywords)) {
    if (!def.params.includes(kw)) return { id: 'CPD0043', text: `Keyword ${kw} not valid for this command.` };
    if (kw in out) return { id: 'CPD0040', text: `Keyword ${kw} specified more than once.` };
    out[kw] = v;
  }
  for (const r of def.required ?? []) if (!(r in out) || out[r].trim() === '') return { id: 'CPD0071', text: `Parameter ${r} required.` };
  return out;
}
