// Le tableau de classe des enseignant·es : les sauvegardes des élèves (les
// fichiers de « Ma progression », ou leurs codes courts), lues dans le
// navigateur de l'enseignant·e, sans rien envoyer nulle part. Une ligne par
// élève : chapitres terminés, grade, succès, records du mode examen, et
// l'avancée dans chaque histoire. Ce n'est pas une preuve de travail (un
// fichier se modifie, un code se recopie) : un point de situation.

import { HISTOIRES } from './chapitres';
import { grade } from './succes';
import { lireCode, lireFichier } from './progression';

export interface Eleve {
  nom: string;
  // D'où vient la ligne : un fichier (son nom) ou un code.
  source: string;
  termines: string[];
  succes: number;
  // Meilleurs temps en mode examen, par chapitre (ms).
  records: Record<string, number>;
  // Date de la sauvegarde (ISO), pour un fichier.
  date: string | null;
}

export type ErreurClasse = { source: string; erreur: string };

const TOUS = () => HISTOIRES.flatMap((h) => h.chapitres.map((c) => c.id));

/** Un élève d'après son fichier de sauvegarde ; sans nom dans le fichier, celui du fichier. */
export function eleveDeFichier(nomFichier: string, texte: string): Eleve | ErreurClasse {
  const lu = lireFichier(texte);
  if ('erreur' in lu) return { source: nomFichier, erreur: lu.erreur };
  let date: string | null = null;
  try {
    const brut = JSON.parse(texte);
    if (typeof brut.date === 'string' && !Number.isNaN(Date.parse(brut.date))) date = brut.date;
  } catch {}
  const s = lu.sauvegarde;
  return {
    nom: s.nom || nomFichier.replace(/\.json$/i, ''),
    source: nomFichier,
    termines: s.termines ?? [],
    succes: Object.keys(s.succes ?? {}).length,
    records: s.records ?? {},
    date,
  };
}

/**
 * Des élèves d'après leurs codes, un par ligne : « Nom QDS-XXXX-… » (le nom
 * est tout ce qui précède le code ; sans nom, le code lui-même).
 */
export function elevesDeCodes(texte: string): (Eleve | ErreurClasse)[] {
  return texte
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((ligne) => {
      const m = /^(.*?)[\s:;,]*\b(qds[\s-]*[0-9a-z][0-9a-z\s-]*)$/i.exec(ligne);
      if (!m) return { source: ligne, erreur: 'code-illisible' };
      const lu = lireCode(m[2]);
      if ('erreur' in lu) return { source: ligne, erreur: lu.erreur };
      return { nom: m[1].trim() || m[2].trim(), source: m[2].trim().toUpperCase(), termines: lu.termines, succes: 0, records: {}, date: null };
    });
}

/** Les chapitres terminés d'une histoire, et combien elle en a. */
export const avancee = (e: Eleve, histoire: string) => {
  const h = HISTOIRES.find((x) => x.id === histoire)!;
  return { faits: h.chapitres.filter((c) => e.termines.includes(c.id)).length, total: h.chapitres.length };
};

export const gradeDe = (e: Eleve) => grade(e.termines);
export const meilleurTemps = (e: Eleve) => (Object.keys(e.records).length ? Math.min(...Object.values(e.records)) : null);
export const totalChapitres = () => TOUS().length;

/** Le tableau en CSV (séparateur ;, comme les tableurs en français), avec ses en-têtes ; sans formule possible. */
export function enCSV(eleves: Eleve[], entetes: string[], ligne: (e: Eleve) => (string | number)[]): string {
  const cellule = (x: string | number) => {
    // Un nom écrit par un·e élève qui commence par = + - @ deviendrait une formule
    // dans le tableur (injection CSV) : on le neutralise avec une apostrophe.
    const s = typeof x === 'string' && /^[=+\-@\t\r]/.test(x) ? `'${x}` : String(x);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [entetes, ...eleves.map(ligne)].map((l) => l.map(cellule).join(';')).join('\n');
}
