// Le manuel : pages « man » au format habituel (NOM, SYNOPSIS, DESCRIPTION,
// OPTIONS, EXEMPLES, VOIR AUSSI), « commande --help », « man -k » (apropos)
// et « whatis ». Les pages sont fabriquées à partir du texte de chaque
// commande (man-<commande> dans manuel.ftl) et de sa partie technique
// (pages.ts), pour apprendre le bon réflexe : chercher dans le manuel avant
// de demander. Les messages reprennent ceux de man-db et des coreutils.

import { translator, type Translate } from '../../texts';
import { translateHosts } from '../machines';
import { COMMANDS, type Command } from './index';
import { player } from '../world';

// Identifiant Fluent de la page : le point est réservé aux attributs
// (« jail.conf » → man-jail_conf).
export const page = (name: string) => `man-${name.replace(/\./g, '_')}`;

const section = (name: string) => COMMANDS[name]?.section ?? 1;

function texts(name: string, t: Translate) {
  const synopsis = t.exists(`${page(name)}.synopsis`) ? t(`${page(name)}.synopsis`) : '';
  const options = (name: string, c: Command): [string, string][] => (c.options ?? []).map((o) => [o, t(`${page(name)}.option-${o}`)]);
  // Une langue peut adapter la commande d'un exemple qui contient des mots (.commande-N) : grep "my password".
  const examples = (name: string, c: Command): [string, string][] =>
    (c.examples ?? []).map((e, i) => {
      const own = `${page(name)}.commande-${i + 1}`;
      // Le compte du joueur (vous@wiki, /home/vous) et les machines (ssh royaume) prennent leur nom dans la langue (you@wiki, ssh kingdom).
      const command = t.exists(own) ? t(own) : translateHosts(e.replace(/\byou\b/g, player(t)), t, [translator('en')]);
      return [command, t(`${page(name)}.exemple-${i + 1}`)];
    });
  return { synopsis, description: t(page(name)), options, examples };
}

// La première phrase, sans point final, pour la ligne NOM et whatis.
export const recap = (text: string) => text.split(/(?<=\.)\s|(?<=。)|\n/)[0].replace(/[.。]$/, '');

const indent = (text: string, n = 7) =>
  text
    .split('\n')
    .map((l) => (l ? ' '.repeat(n) + l : l))
    .join('\n');

export function whatisLine(name: string, t: Translate): string {
  return `${`${name} (${section(name)})`.padEnd(21)}- ${recap(t(page(name)))}`;
}

const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function pageMan(name: string, c: Command, t: Translate): string {
  const { synopsis, description, options, examples } = texts(name, t);
  const title = `${name.toUpperCase()}(${section(name)})`;
  const middle = t('manual-header');
  const white = Math.max(2, Math.floor((60 - title.length * 2 - middle.length) / 2));
  // Comme une vraie page : le titre de section, puis son texte en retrait.
  const sections: [string, string][] = [[t('manual-section-name'), indent(`${name} - ${recap(description)}`)]];
  if (synopsis) sections.push([t('manual-section-synopsis'), indent(synopsis)]);
  sections.push([t('manual-section-description'), indent(majuscule(description))]);
  const opts = options(name, c);
  if (opts.length)
    sections.push([t('manual-section-options'), opts.map(([o, d]) => indent(`-${o}`) + '\n' + indent(majuscule(d), 14)).join('\n\n')]);
  const ex = examples(name, c);
  if (ex.length) sections.push([t('manual-section-examples'), ex.map(([cmd, d]) => indent(cmd) + '\n' + indent(majuscule(d), 14)).join('\n\n')]);
  if (c.see?.length) sections.push([t('manual-section-see-also'), indent(c.see.map((v) => `${v}(${section(v)})`).join(', '))]);
  return [`${title}${' '.repeat(white)}${middle}${' '.repeat(white)}${title}`, ...sections.map(([s, x]) => `${s}\n${x}`)].join('\n\n');
}

export function help(name: string, c: Command, t: Translate): string {
  const { synopsis, description, options } = texts(name, t);
  const lines = [t('manual-use', { synopsis: synopsis || name }), majuscule(recap(description)) + '.'];
  const opts = options(name, c);
  if (opts.length) {
    lines.push('');
    for (const [o, d] of opts) lines.push(`  -${o.padEnd(5)} ${d}`);
  }
  lines.push('', t('manual-complete', { commande: name }));
  return lines.join('\n');
}

/** man -k / apropos : les commandes dont le nom, le synopsis ou la description contient le mot. */
export function apropos(word: string, names: string[], t: Translate): string[] {
  const m = word.toLowerCase();
  return names
    .filter((name) => {
      const { synopsis, description } = texts(name, t);
      return name.includes(m) || `${synopsis} — ${description}`.toLowerCase().includes(m);
    })
    .map((name) => whatisLine(name, t));
}

/**
 * Vérifie les options courtes (-a, -la…) d'une commande qui déclare les
 * siennes. Renvoie le message d'erreur des coreutils, ou null.
 */
/** Les options longues connues, réécrites en options courtes (--all → -a), comme les lit la commande. */
export const shorten = (c: Command, args: string[]): string[] => {
  const end = args.indexOf('--');
  return args.map((a, i) => (c.long && a.startsWith('--') && !a.includes('=') && (end < 0 || i < end) && c.long[a.slice(2)] ? `-${c.long[a.slice(2)]}` : a));
};

export function invalidOption(name: string, c: Command, args: string[], t: Translate): string | null {
  if (!c.options || c.ownOptions) return null;
  for (const a of args) {
    // Après « -- », plus aucune option.
    if (a === '--') break;
    if (a.startsWith('--')) {
      const long = a.slice(2).split('=')[0];
      if (c.long && long in c.long) continue;
      return t('manual-option-long-unknown', { commande: name, option: a.split('=')[0] });
    }
    if (!a.startsWith('-') || a === '-' || /^-\d+$/.test(a)) continue;
    for (const letter of a.slice(1)) if (!c.options.includes(letter)) return t('manual-option-invalid', { commande: name, lettre: letter });
  }
  return null;
}
