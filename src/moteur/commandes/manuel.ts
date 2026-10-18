// Le manuel : pages « man » au format habituel (NOM, SYNOPSIS, DESCRIPTION,
// OPTIONS, EXEMPLES, VOIR AUSSI), « commande --help », « man -k » (apropos)
// et « whatis ». Les pages sont fabriquées à partir de la définition de
// chaque commande (champ manuel, et options, exemples, voir s'ils existent),
// pour apprendre le bon réflexe : chercher dans le manuel avant de demander.
// Les messages reprennent ceux de man-db et des coreutils en français.

import type { Commande } from './index';

// « ls [-a] [lieu] — liste ce qu'il y a ici. » → synopsis et description.
function decouper(c: Commande): { synopsis: string; description: string } {
  const i = c.manuel.indexOf(' — ');
  return i < 0 ? { synopsis: '', description: c.manuel } : { synopsis: c.manuel.slice(0, i), description: c.manuel.slice(i + 3) };
}

// La première phrase, sans point final, pour la ligne NOM et whatis.
const resume = (texte: string) => texte.split(/(?<=\.)\s|\n/)[0].replace(/\.$/, '');

const retrait = (texte: string, n = 7) =>
  texte
    .split('\n')
    .map((l) => (l ? ' '.repeat(n) + l : l))
    .join('\n');

export function ligneWhatis(nom: string, c: Commande): string {
  return `${`${nom} (1)`.padEnd(21)}- ${resume(decouper(c).description)}`;
}

const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function pageMan(nom: string, c: Commande): string {
  const { synopsis, description } = decouper(c);
  const titre = `${nom.toUpperCase()}(1)`;
  const milieu = 'Manuel du jeu';
  const blanc = Math.max(2, Math.floor((60 - titre.length * 2 - milieu.length) / 2));
  // Comme une vraie page : le titre de section, puis son texte en retrait.
  const sections: [string, string][] = [['NOM', retrait(`${nom} - ${resume(description)}`)]];
  if (synopsis) sections.push(['SYNOPSIS', retrait(synopsis)]);
  sections.push(['DESCRIPTION', retrait(majuscule(description))]);
  if (c.options && Object.keys(c.options).length)
    sections.push(['OPTIONS', Object.entries(c.options).map(([o, d]) => retrait(`-${o}`) + '\n' + retrait(majuscule(d), 14)).join('\n\n')]);
  if (c.exemples?.length) sections.push(['EXEMPLES', c.exemples.map(([cmd, d]) => retrait(cmd) + '\n' + retrait(majuscule(d), 14)).join('\n\n')]);
  if (c.voir?.length) sections.push(['VOIR AUSSI', retrait(c.voir.map((v) => `${v}(1)`).join(', '))]);
  return [`${titre}${' '.repeat(blanc)}${milieu}${' '.repeat(blanc)}${titre}`, ...sections.map(([t, x]) => `${t}\n${x}`)].join('\n\n');
}

export function aide(nom: string, c: Commande): string {
  const { synopsis, description } = decouper(c);
  const lignes = [`Utilisation : ${synopsis || nom}`, majuscule(resume(description)) + '.'];
  if (c.options && Object.keys(c.options).length) {
    lignes.push('');
    for (const [o, d] of Object.entries(c.options)) lignes.push(`  -${o.padEnd(5)} ${d}`);
  }
  lignes.push('', `Manuel complet : man ${nom}`);
  return lignes.join('\n');
}

/** man -k / apropos : les commandes dont le nom ou le manuel contient le mot. */
export function apropos(mot: string, commandes: [string, Commande][]): string[] {
  const m = mot.toLowerCase();
  return commandes.filter(([nom, c]) => nom.includes(m) || c.manuel.toLowerCase().includes(m)).map(([nom, c]) => ligneWhatis(nom, c));
}

/**
 * Vérifie les options courtes (-a, -la…) d'une commande qui déclare les
 * siennes. Renvoie le message d'erreur des coreutils, ou null.
 */
export function optionInvalide(nom: string, c: Commande, args: string[]): string | null {
  if (!c.options) return null;
  for (const a of args) {
    if (!a.startsWith('-') || a === '-' || a.startsWith('--') || /^-\d+$/.test(a)) continue;
    for (const lettre of a.slice(1))
      if (!(lettre in c.options)) return `${nom} : option invalide -- '${lettre}'\nSaisissez « ${nom} --help » pour plus d'informations.`;
  }
  return null;
}
