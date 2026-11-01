// The teachers' class table: the students' saves (the "My progress" files,
// or their short codes), read in the teacher's browser, without sending
// anything anywhere. One row per student: chapters finished, rank,
// achievements, exam-mode records, and progress in each story. It isn't
// proof of work (a file can be edited, a code copied): a status check.

import { STORIES } from './chapters';
import { grade } from './achievements';
import { readCode, readFile } from './progress';

export interface Student {
  name: string;
  // Where the row comes from: a file (its name) or a code.
  source: string;
  finished: string[];
  achievements: number;
  // Meilleurs temps en mode examen, par chapitre (ms).
  records: Record<string, number>;
  // Date of the save (ISO), for a file.
  date: string | null;
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
      return { name: m[1].trim() || m[2].trim(), source: m[2].trim().toUpperCase(), finished: read.finished, achievements: 0, records: {}, date: null };
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

/** The table as CSV (separator ;, like spreadsheets in French), with its headers; no formula possible. */
export function inCsv(students: Student[], headers: string[], line: (e: Student) => (string | number)[]): string {
  const cell = (x: string | number) => {
    // A name written by a student starting with = + - @ would become a formula
    // in the spreadsheet (CSV injection): it is neutralised with an apostrophe.
    const s = typeof x === 'string' && /^[=+\-@\t\r]/.test(x) ? `'${x}` : String(x);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...students.map(line)].map((l) => l.map(cell).join(';')).join('\n');
}
