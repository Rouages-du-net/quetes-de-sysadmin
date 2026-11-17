// GnuCOBOL, as far as the story "The Night Batch" needs it: cobc reads a
// source in fixed format (or free with -free), brings in its copybooks
// (COPY, searched in the current directory and the -I directories), and
// builds an executable (-x) or a module (NAME.so, the default). The
// programs it builds are recognised by their PROGRAM-ID: the story's two
// (EBC2ASC, which converts the bureau's EBCDIC file field by field, and
// CONTRIB, the nightly batch) run in TypeScript from their input files;
// any other program only shows its DISPLAY literals.
// After the GnuCOBOL 3.1 manual (https://gnucobol.sourceforge.io/doc/gnucobol.html):
// reference format (sequence area in columns 1-6, the indicator in column 7,
// the program text in columns 8-72), "invalid indicator 'X' at column 7",
// COPY and -I, -x, -free, the RETURN-CODE special register that becomes
// the process's exit code.
// Differences: no real compiler. Only the reference format's indicator,
// the copybooks, PROGRAM-ID and the paragraphs named by PERFORM are
// checked; any other mistake compiles; free format refuses the first line
// that starts with a sequence number or a lone *.

import type { Shell } from './shell';
import type { File } from './world';
import { content } from './tools';
import { systemd } from './systemd';
import { CP037, bytesOf, unpackDecimal } from './ebcdic';

export interface Program {
  // An executable (cobc -x) or a module (NAME.so, loaded by cobcrun or another program).
  kind: 'executable' | 'module';
  // Its PROGRAM-ID, in capitals.
  id: string;
  // CONTRIB: the control totals are compared with the trailer (MOVE 8 TO RETURN-CODE is in the code).
  checksControl?: boolean;
  // Another program: its DISPLAY literals, in order.
  displays?: string[];
}

/** A line of program text after the reference format: where it comes from, and its columns 8-72 (or the whole line, free). */
interface Line {
  file: string;
  number: number;
  code: string;
}

const COPY = /\bCOPY\s+["']?([A-Za-z0-9_-]+(?:\.[A-Za-z0-9]+)?)["']?\s*\./i;
const COPY_DIR = '/usr/share/gnucobol/copy';
const EXTENSIONS = ['', '.CPY', '.cpy', '.CBL', '.cbl', '.COB', '.cob'];

/** Reads a source (or a copybook) in fixed or free format; COPY brings in the copybooks. */
function read(game: Shell, file: string, text: string, free: boolean, dirs: string[], errors: string[], depth = 0): Line[] {
  const lines: Line[] = [];
  text.split('\n').forEach((raw, i) => {
    const number = i + 1;
    let code: string;
    if (free) {
      code = raw.replace(/\*>.*$/, '');
      // Free format has no sequence area: a sequence number, or a lone * (a fixed-format comment), is a syntax error.
      if (!errors.length && /^\s*\d{6}/.test(code)) errors.push(`${file}:${number}: error: syntax error, unexpected Literal`);
      else if (!errors.length && /^\s*\*(?!>)/.test(code)) errors.push(`${file}:${number}: error: syntax error, unexpected *`);
    } else {
      if (raw.length < 7) return;
      const indicator = raw[6];
      if (indicator === '*' || indicator === '/' || indicator === 'D' || indicator === 'd') return;
      if (indicator !== ' ' && indicator !== '-') {
        errors.push(`${file}:${number}: error: invalid indicator '${indicator}' at column 7`);
        return;
      }
      code = raw.slice(7, 72).replace(/\*>.*$/, '');
    }
    const copy = COPY.exec(code);
    if (copy && depth < 5) {
      const name = copy[1];
      const found = [game.cwd, ...dirs, COPY_DIR].flatMap((d) => EXTENSIONS.map((e) => `${d}/${name}${e}`)).find((p) => game.find(p)?.type === 'file');
      if (!found) {
        errors.push(`${file}:${number}: error: ${name}: No such file or directory`);
        return;
      }
      lines.push(...read(game, found.split('/').at(-1)!, content(game.find(found) as File, game), free, dirs, errors, depth + 1));
      return;
    }
    lines.push({ file, number, code });
  });
  return lines;
}

const NOT_PARAGRAPHS = new Set(['UNTIL', 'VARYING', 'WITH', 'TEST', 'TIMES', 'THRU', 'THROUGH']);

/** cobc on a source: the errors (cobc's messages), or the program it builds. */
export function compile(game: Shell, file: string, text: string, o: { free: boolean; dirs: string[]; kind: Program['kind'] }): { errors: string[] } | { program: Program } {
  const errors: string[] = [];
  const name = file.split('/').at(-1)!;
  const lines = read(game, name, text, o.free, o.dirs, errors);
  if (errors.length) return { errors };
  const code = lines.map((l) => l.code.toUpperCase());
  const all = code.join('\n');
  const id = /PROGRAM-ID\.\s*["']?([A-Z0-9][A-Z0-9-]*)/.exec(all)?.[1];
  if (!id) return { errors: [`${name}:1: error: PROGRAM-ID header missing`] };
  // PERFORM of a paragraph that doesn't exist (commented out, misspelt).
  const start = code.findIndex((l) => /PROCEDURE\s+DIVISION/.test(l));
  const paragraphs = new Set(code.slice(start + 1).flatMap((l) => /^\s*([A-Z0-9][A-Z0-9-]*)\.\s*$/.exec(l)?.[1] ?? []));
  for (const [i, l] of code.entries()) {
    if (i <= start) continue;
    for (const m of l.matchAll(/\bPERFORM\s+([A-Z0-9][A-Z0-9-]*)/g))
      if (!NOT_PARAGRAPHS.has(m[1]) && !paragraphs.has(m[1]) && !/^\d+$/.test(m[1])) errors.push(`${lines[i].file}:${lines[i].number}: error: '${m[1]}' is not defined`);
  }
  if (errors.length) return { errors };
  const program: Program = { kind: o.kind, id };
  if (id === 'CONTRIB') program.checksControl = /\bMOVE\s+8\s+TO\s+RETURN-CODE\b/.test(all);
  else if (id !== 'EBC2ASC') {
    const procedure = lines.slice(start + 1).map((l) => l.code).join('\n');
    program.displays = [...procedure.matchAll(/\bDISPLAY\s+((?:(?:"[^"]*"|'[^']*')\s*)+)/gi)].map((m) => [...m[1].matchAll(/"([^"]*)"|'([^']*)'/g)].map((x) => x[1] ?? x[2]).join(''));
  }
  return { program };
}

// ——— Running the programs ———

/** A run of the story's programs, kept for the chapters (who ran what, on which file, with which return code). */
export interface Run {
  time: number;
  program: string;
  input: string;
  // CONTRIB: the run date of the header (YYMMDD), the details and their total (in cents).
  runDate?: string;
  details?: number;
  total?: number;
  report?: string;
  rc: number;
}
export const runs = (game: { state: Record<string, any> }): Run[] => (game.state.batchRuns ??= []);

/** A file the program opens for input: its content, or the COBOL file status (35: not found, 37: no permission). */
function openInput(game: Shell, path: string): { text: string; binary: boolean } | { status: string } {
  const n = game.find(path);
  if (!n || n.type !== 'file') return { status: '35' };
  if (!game.traverses(path) || !game.can(n, 'r')) return { status: '37' };
  return { text: content(n, game), binary: n.charset === 'binary' };
}

/** Writes an output file (OPEN OUTPUT: created or replaced); a file status if refused. */
function writeOutput(game: Shell, path: string, text: string): string | null {
  const n = game.find(path);
  if (n?.type === 'directory') return '30';
  if (n) {
    if (!game.traverses(path) || !game.can(n, 'w')) return '37';
    n.content = text;
    n.lines = true;
    delete n.size;
    delete n.charset;
    n.mtime = systemd(game)?.clock;
    return null;
  }
  // The batch's files stay writable by its group (the runtime follows a umask of 002, as Ramón set it).
  return game.place('cobc', path, { type: 'file', content: text, owner: game.who, mode: 'rw-rw-r--', lines: true, mtime: systemd(game)?.clock }) ? '37' : null;
}

/** "1234.5" style: cents → a report amount (Z,ZZZ,ZZ9.99). */
export const amount = (cents: number) => {
  const sign = cents < 0 ? '-' : '';
  const a = Math.abs(cents);
  return `${sign}${Math.floor(a / 100).toLocaleString('en-US')}.${String(a % 100).padStart(2, '0')}`;
};

/** EBC2ASC: the bureau's EBCDIC file (40-byte records) → the ASCII file CONTRIB reads (43 characters per line). */
function ebc2asc(game: Shell, args: string[], record: (r: Omit<Run, 'time' | 'program'>) => void): { output: string[]; rc: number } {
  const [input, output] = args;
  if (!input || !output) return { output: ['EBC2ASC: USAGE: ebc2asc EBCDIC-FILE ASCII-FILE'], rc: 16 };
  const opened = openInput(game, input);
  if ('status' in opened) return { output: [`EBC2ASC: CANNOT OPEN ${input}, FILE STATUS ${opened.status}`], rc: 12 };
  const b = opened.binary ? bytesOf(opened.text) : [...new TextEncoder().encode(opened.text)];
  const lines: string[] = [];
  const out: string[] = [];
  let rc = 0;
  for (let i = 0; i < b.length; i += 40) {
    const r = b.slice(i, i + 40);
    const n = i / 40 + 1;
    if (r.length < 40) {
      out.push(`EBC2ASC: SHORT RECORD ${n} (${r.length} BYTES): FILE TRUNCATED?`);
      rc = 12;
      break;
    }
    const value = unpackDecimal(r.slice(33, 38));
    if (value === null) {
      out.push(`EBC2ASC: INVALID PACKED AMOUNT IN RECORD ${n}`);
      rc = 8;
      break;
    }
    const text = r.slice(0, 33).map((x) => String.fromCharCode(CP037[x])).join('');
    lines.push(`${text}${value < 0 ? '-' : '+'}${String(Math.abs(value)).padStart(9, '0')}`);
  }
  const status = writeOutput(game, output, lines.join('\n'));
  if (status) return { output: [`EBC2ASC: CANNOT OPEN ${output}, FILE STATUS ${status}`], rc: 12 };
  out.push(`EBC2ASC: ${lines.length} RECORDS CONVERTED`);
  record({ input: game.resolve(input), rc });
  return { output: out, rc };
}

/** CONTRIB: reads the converted file, writes the collection report, compares with the trailer. */
function contrib(game: Shell, program: Program, args: string[], record: (r: Omit<Run, 'time' | 'program'>) => void): { output: string[]; rc: number } {
  const [input, report] = args;
  if (!input || !report) return { output: ['CONTRIB: USAGE: contrib INPUT-FILE REPORT-FILE'], rc: 16 };
  const opened = openInput(game, input);
  if ('status' in opened) return { output: [`CONTRIB: CANNOT OPEN INPUT, STATUS ${opened.status}`], rc: 12 };
  // LINE SEQUENTIAL: a record ends at a newline; a longer line is cut at the record's length.
  const records = opened.text.split('\n').filter((l) => l !== '').map((l) => l.slice(0, 43));
  const out: string[] = [];
  let runDate = '';
  let count = 0;
  let total = 0;
  let trailer: { count: number; total: number } | null = null;
  const lines: string[] = [];
  const done = (rc: number) => {
    record({ input: game.resolve(input), runDate, details: count, total, rc, ...(rc < 12 ? { report: game.resolve(report) } : {}) });
    return { output: out, rc };
  };
  for (const [i, r] of records.entries()) {
    const type = r[0];
    const value = /^[+-]\d{9}$/.test(r.slice(33, 43)) ? Number(r.slice(33, 43)) : null;
    if (type === 'H') {
      runDate = r.slice(27, 33);
      lines.push(`THE MUTUAL - NIGHTLY CONTRIBUTIONS        RUN DATE ${runDate.slice(4, 6)}/${runDate.slice(2, 4)}/${runDate.slice(0, 2)}`);
      lines.push('MEMBER  NAME                  PERIOD          AMOUNT');
    } else if (type === 'D') {
      if (value === null || !/^\d{6}$/.test(r.slice(1, 7))) {
        out.push(`CONTRIB: INVALID AMOUNT IN RECORD ${i + 1}`);
        return done(12);
      }
      count++;
      total += value;
      lines.push(`${r.slice(1, 7)}  ${r.slice(7, 27)}  ${r.slice(27, 31)}-${r.slice(31, 33)}  ${amount(value).padStart(12)}`);
    } else if (type === 'T') {
      trailer = { count: Number(r.slice(1, 7)) || 0, total: value ?? 0 };
      break;
    } else {
      out.push(`CONTRIB: UNKNOWN RECORD TYPE IN RECORD ${i + 1}`);
      return done(12);
    }
  }
  if (!trailer) {
    out.push('CONTRIB: NO TRAILER RECORD, FILE INCOMPLETE?');
    return done(12);
  }
  lines.push(`TOTAL   ${String(count).padStart(6)} CONTRIBUTIONS             ${amount(total).padStart(12)}`);
  lines.push(`CONTROL ${String(trailer.count).padStart(6)} (TRAILER)                   ${amount(trailer.total).padStart(12)}`);
  const status = writeOutput(game, report, lines.join('\n'));
  if (status) {
    out.push(`CONTRIB: CANNOT OPEN REPORT, STATUS ${status}`);
    return done(12);
  }
  out.push(`CONTRIB: RUN DATE ${runDate}`, `CONTRIB: ${count} CONTRIBUTIONS, TOTAL ${amount(total)}`);
  if (program.checksControl && (trailer.count !== count || trailer.total !== total)) {
    out.push('CONTRIB: CONTROL TOTALS DO NOT MATCH');
    return done(8);
  }
  return done(0);
}

/** Runs a compiled program: its DISPLAY lines are the output, RETURN-CODE the exit code. */
export function runProgram(game: Shell, program: Program, args: string[]): string {
  // A module has no entry point of its own: executed directly, it crashes (cobcrun runs it).
  if (program.kind === 'module') {
    game.status = 139;
    return game.error('Segmentation fault');
  }
  const record = (r: Omit<Run, 'time' | 'program'>) => runs(game).push({ time: systemd(game)?.clock ?? 0, program: program.id, ...r });
  const r = program.id === 'EBC2ASC' ? ebc2asc(game, args, record) : program.id === 'CONTRIB' ? contrib(game, program, args, record) : { output: program.displays ?? [], rc: 0 };
  game.status = r.rc;
  return r.output.join('\n');
}
