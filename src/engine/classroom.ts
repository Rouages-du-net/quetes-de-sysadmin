// Le tableau de classe des enseignant·es : les sauvegardes des élèves (les
// fichiers de « Ma progression », ou leurs codes courts), lues dans le
// navigateur de l'enseignant·e, sans rien envoyer nulle part. Une ligne par
// élève : chapitres terminés, grade, succès, records du mode examen, et
// l'avancée dans chaque histoire. Ce n'est pas une preuve de travail (un
// fichier se modifie, un code se recopie) : un point de situation.

import { STORIES } from './chapters';
import { grade } from './achievements';
import { readCode, readFile } from './progress';

export interface Student {
  name: string;
  // D'où vient la ligne : un fichier (son nom) ou un code.
  source: string;
  finished: string[];
  achievements: number;
  // Meilleurs temps en mode examen, par chapitre (ms).
  records: Record<string, number>;
  // Date de la sauvegarde (ISO), pour un fichier.
  date: string | null;
}

export type ClassError = { source: string; error: string };

const ALL = () => STORIES.flatMap((h) => h.chapters.map((c) => c.id));

/** Un élève d'après son fichier de sauvegarde ; sans nom dans le fichier, celui du fichier. */
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
 * Des élèves d'après leurs codes, un par ligne : « Nom QDS-XXXX-… » (le nom
 * est tout ce qui précède le code ; sans nom, le code lui-même).
 */
export function codesStudents(text: string): (Student | ClassError)[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = /^(.*?)[\s:;,]*\b(qds[\s-]*[0-9a-z][0-9a-z\s-]*)$/i.exec(line);
      if (!m) return { source: line, error: 'code-illisible' };
      const read = readCode(m[2]);
      if ('error' in read) return { source: line, error: read.error };
      return { name: m[1].trim() || m[2].trim(), source: m[2].trim().toUpperCase(), finished: read.finished, achievements: 0, records: {}, date: null };
    });
}

/** Les chapitres terminés d'une histoire, et combien elle en a. */
export const progress = (e: Student, story: string) => {
  const h = STORIES.find((x) => x.id === story)!;
  return { done: h.chapters.filter((c) => e.finished.includes(c.id)).length, total: h.chapters.length };
};

export const gradeFor = (e: Student) => grade(e.finished);
export const bestTime = (e: Student) => (Object.keys(e.records).length ? Math.min(...Object.values(e.records)) : null);
export const chaptersTotal = () => ALL().length;

/** Le tableau en CSV (séparateur ;, comme les tableurs en français), avec ses en-têtes ; sans formule possible. */
export function inCsv(students: Student[], headers: string[], line: (e: Student) => (string | number)[]): string {
  const cell = (x: string | number) => {
    // Un nom écrit par un·e élève qui commence par = + - @ deviendrait une formule
    // dans le tableur (injection CSV) : on le neutralise avec une apostrophe.
    const s = typeof x === 'string' && /^[=+\-@\t\r]/.test(x) ? `'${x}` : String(x);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...students.map(line)].map((l) => l.map(cell).join(';')).join('\n');
}
