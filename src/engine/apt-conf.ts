// La configuration d'apt, lue comme apt.conf(5) : /etc/apt/apt.conf.d/*,
// dans l'ordre alphabétique (les fichiers dont le nom contient autre chose
// que lettres, chiffres, « _ », « - » et « . » sont ignorés), puis
// /etc/apt/apt.conf. Une valeur lue plus tard remplace la précédente ; une
// liste ({ "a"; "b"; }) s'allonge d'un fichier à l'autre. Commentaires //,
// /* */ et #. Chaque affectation finit par « ; ».
// Source : https://manpages.debian.org/trixie/apt/apt.conf.5.en.html
// Écarts : pas de #include ni de #clear, pas de portée « Clé::Sous { … } »
// imbriquée sur plusieurs niveaux (seulement les listes).

import type { Jeu } from './shell';

export const DOSSIER_APT = '/etc/apt/apt.conf.d';

export interface ConfApt {
  valeurs: Record<string, string>;
  listes: Record<string, string[]>;
  erreurs: string[];
}

// Les fichiers lus, dans l'ordre.
function fichiers(jeu: Jeu): string[] {
  const n = jeu.trouver(DOSSIER_APT);
  const noms =
    n?.type === 'dossier'
      ? Object.keys(n.enfants)
          .filter((f) => /^[A-Za-z0-9_.-]+$/.test(f) && n.enfants[f].type === 'fichier')
          .sort()
      : [];
  return [...noms.map((f) => `${DOSSIER_APT}/${f}`), ...(jeu.existe('/etc/apt/apt.conf') ? ['/etc/apt/apt.conf'] : [])];
}

/** Lit toute la configuration d'apt ; les erreurs sont celles d'apt (« E: Syntax error … »). */
export function lireConfApt(jeu: Jeu): ConfApt {
  const valeurs: Record<string, string> = {};
  const listes: Record<string, string[]> = {};
  const erreurs: string[] = [];
  for (const fichier of fichiers(jeu)) {
    const texte = (jeu.lire(fichier) ?? '').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
    const lignes = texte.split('\n').map((l) => l.replace(/(^|\s)(\/\/|#).*$/, '$1'));
    let liste: string | null = null;
    for (let i = 0; i < lignes.length && !erreurs.length; i++) {
      let reste = lignes[i].trim();
      while (reste && !erreurs.length) {
        const fin = /^};?\s*/.exec(reste);
        if (liste !== null && fin) {
          liste = null;
          reste = reste.slice(fin[0].length);
          continue;
        }
        if (liste !== null) {
          const v = /^"([^"]*)"\s*;\s*/.exec(reste);
          if (!v) {
            erreurs.push(`E: Syntax error ${fichier}:${i + 1}: Extra junk after value`);
            break;
          }
          (listes[liste] ??= []).push(v[1]);
          reste = reste.slice(v[0].length);
          continue;
        }
        const ouvre = /^([A-Za-z0-9_:.-]+)\s*{\s*/.exec(reste);
        if (ouvre) {
          liste = ouvre[1];
          listes[liste] ??= [];
          reste = reste.slice(ouvre[0].length);
          continue;
        }
        const affectation = /^([A-Za-z0-9_:.-]+)\s+"([^"]*)"\s*(;?)\s*/.exec(reste);
        if (!affectation) {
          erreurs.push(`E: Syntax error ${fichier}:${i + 1}: Malformed tag`);
          break;
        }
        if (!affectation[3]) {
          erreurs.push(`E: Syntax error ${fichier}:${i + 1}: Extra junk after value`);
          break;
        }
        valeurs[affectation[1]] = affectation[2];
        reste = reste.slice(affectation[0].length);
      }
    }
    if (!erreurs.length && liste !== null) erreurs.push(`E: Syntax error ${fichier}:${lignes.length}: Unbalanced braces`);
    if (erreurs.length) break;
  }
  if (erreurs.length) erreurs.push('E: Unable to parse configuration');
  return { valeurs, listes, erreurs };
}

/** Une option booléenne d'apt : « 1 », « true », « yes », « on ». */
export const vrai = (v: string | undefined) => /^(1|true|yes|on|enable)$/i.test(v ?? '');

/** Ce qu'affiche apt-config dump : une ligne par valeur, les listes en « Clé:: ». */
export function vider(c: ConfApt): string {
  const lignes = Object.entries(c.valeurs).map(([k, v]) => `${k} "${v}";`);
  for (const [k, l] of Object.entries(c.listes)) lignes.push(`${k} "";`, ...l.map((v) => `${k}:: "${v}";`));
  return lignes.join('\n');
}
