// The teachers' class table: the students' saves (the "My progress" files,
// or their short codes), read in the teacher's browser, without sending
// anything anywhere. One row per student: chapters finished, rank,
// achievements, exam-mode records, and progress in each story. It isn't
// proof of work (a file can be edited, a code copied): a status check.

import { CATALOGUE as STORIES } from './catalogue';
import { grade } from './achievements';
import { readCode, readFile } from './progress';
import { streak } from './streak';

export interface Student {
  name: string;
  // Where the row comes from: a file (its name) or a code.
  source: string;
  finished: string[];
  achievements: number;
  // Best times in exam mode, per chapter (ms).
  records: Record<string, number>;
  // Date of the save (ISO), for a file.
  date: string | null;
  // The days whose incident of the day was solved (YYYY-MM-DD), for a file
  // (the on-call streak travels with it); null for a code, which has none.
  onCall: string[] | null;
}

export type ClassError = { source: string; error: string };

const ALL = () => STORIES.flatMap((h) => h.chapters.map((c) => c.id));

/** A student from their save file; with no name in the file, the file's name. */
export function fileStudent(fileName: string, text: string): Student | ClassError {
  const read = readFile(text);
  if ('error' in read) return { source: fileName, error: read.error };
  let date: string | null = null;
  try {
    const raw = JSON.parse(text);
    if (typeof raw.date === 'string' && !Number.isNaN(Date.parse(raw.date))) date = raw.date;
  } catch {}
  const s = read.backup;
  return {
    name: s.name || fileName.replace(/\.json$/i, ''),
    source: fileName,
    finished: s.finished ?? [],
    achievements: Object.keys(s.achievements ?? {}).length,
    records: s.records ?? {},
    date,
    onCall: Object.keys(s.onCall ?? {}).sort(),
  };
}

/**
 * Students from their codes, one per line: "Name QDS-XXXX-…" (the name is
 * everything before the code; with no name, the code itself).
 */
export function codesStudents(text: string): (Student | ClassError)[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = /^(.*?)[\s:;,]*\b(qds[\s-]*[0-9a-z][0-9a-z\s-]*)$/i.exec(line);
      if (!m) return { source: line, error: 'code-unreadable' };
      const read = readCode(m[2]);
      if ('error' in read) return { source: line, error: read.error };
      return { name: m[1].trim() || m[2].trim(), source: m[2].trim().toUpperCase(), finished: read.finished, achievements: 0, records: {}, date: null, onCall: null };
    });
}

/** A story's finished chapters, and how many it has. */
export const progress = (e: Student, story: string) => {
  const h = STORIES.find((x) => x.id === story)!;
  return { done: h.chapters.filter((c) => e.finished.includes(c.id)).length, total: h.chapters.length };
};

export const gradeFor = (e: Student) => grade(e.finished);
export const bestTime = (e: Student) => (Object.keys(e.records).length ? Math.min(...Object.values(e.records)) : null);
export const chaptersTotal = () => ALL().length;

/**
 * The on-call streak on `today` (YYYY-MM-DD, given by the interface: the
 * engine never reads the time), current and best; null for a code.
 */
export function streakFor(e: Student, today: string): { current: number; best: number } | null {
  if (!e.onCall) return null;
  const s = streak(e.onCall, today);
  return { current: s.current, best: s.best };
}

/**
 * The CSV separator a spreadsheet expects in this language: where the
 * decimal separator is a comma (French, German…), spreadsheets split on
 * semicolons; elsewhere (English…), on commas.
 */
export const csvSeparator = (language: string): ',' | ';' =>
  new Intl.NumberFormat(language).formatToParts(1.5).some((p) => p.type === 'decimal' && p.value === ',') ? ';' : ',';

// Spreadsheet apps read a UTF-8 file as UTF-8 (accents included) when it
// starts with a byte order mark.
export const BOM = '\uFEFF';

/**
 * One CSV cell. A text a student wrote that starts with = + - @ (or a tab, a
 * carriage return) would become a formula in the spreadsheet (CSV
 * injection): it gets an apostrophe in front. A cell with the separator, a
 * quote or a line break goes between quotes, its quotes doubled (RFC 4180).
 */
export function csvCell(x: string | number, separator: string = ';'): string {
  const s = typeof x === 'string' && /^[=+\-@\t\r]/.test(x) ? `'${x}` : String(x);
  return s.includes(separator) || /["\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows as CSV, lines ended by CRLF (RFC 4180). */
export const csvTable = (rows: (string | number)[][], separator: string = ';') =>
  rows.map((l) => l.map((x) => csvCell(x, separator)).join(separator)).join('\r\n');

/** The table as CSV (separator ;, like spreadsheets in French), with its headers; no formula possible. */
export function inCsv(students: Student[], headers: string[], line: (e: Student) => (string | number)[], separator: string = ';'): string {
  return csvTable([headers, ...students.map(line)], separator);
}

/** What the export writes in the page's language (the interface gives it). */
export interface ExportLabels {
  student: string;
  chapters: string;
  grade: string;
  achievements: string;
  exam: string;
  date: string;
  streak: string;
  bestStreak: string;
  /** A story's column: its finished chapters (a number, out of `total`). */
  story: (story: string, total: number) => string;
  /** A chapter's column: 1 finished, 0 not. */
  chapter: (story: string, chapter: string, number: number) => string;
  gradeName: (grade: string) => string;
  /** A save's date (ISO), as the teacher reads it. */
  when: (iso: string) => string;
  /** An exam time (ms). */
  time: (ms: number) => string;
}

/**
 * The export: a header row, then one row per student. Counts are numbers
 * (never "5/12", which a spreadsheet would read as a date): the chapters
 * finished, each story's finished chapters, then one column per chapter,
 * 1 finished, 0 not. What a code doesn't carry (date, streak) stays empty.
 */
export function exportTable(students: Student[], labels: ExportLabels, today: string): (string | number)[][] {
  const chapters = STORIES.flatMap((h) => h.chapters.map((c, i) => ({ story: h.id, id: c.id, number: i + 1 })));
  const header = [
    labels.student,
    labels.chapters,
    labels.grade,
    labels.achievements,
    labels.exam,
    labels.date,
    labels.streak,
    labels.bestStreak,
    ...STORIES.map((h) => labels.story(h.id, h.chapters.length)),
    ...chapters.map((c) => labels.chapter(c.story, c.id, c.number)),
  ];
  const rows = students.map((e) => {
    const best = bestTime(e);
    const s = streakFor(e, today);
    return [
      e.name,
      e.finished.filter((c) => chapters.some((x) => x.id === c)).length,
      labels.gradeName(gradeFor(e)),
      e.achievements,
      best === null ? '' : labels.time(best),
      e.date ? labels.when(e.date) : '',
      s ? s.current : '',
      s ? s.best : '',
      ...STORIES.map((h) => progress(e, h.id).done),
      ...chapters.map((c) => (e.finished.includes(c.id) ? 1 : 0)),
    ];
  });
  return [header, ...rows];
}

/** The CSV file: byte order mark, then the table. */
export const csvFile = (rows: (string | number)[][], separator: string) => BOM + csvTable(rows, separator);
