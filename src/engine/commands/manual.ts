// The manual: "man" pages in the usual format (NAME, SYNOPSIS, DESCRIPTION,
// OPTIONS, EXAMPLES, SEE ALSO), "command --help", "man -k" (apropos)
// and "whatis". The pages are built from each command's text
// (man-<command> in manual.ftl) and from its technical part
// (pages.ts), to learn the right reflex: look in the manual before
// asking. The messages follow those of man-db and coreutils.

import { translator, type Translate } from '../../texts';
import { translateHosts } from '../machines';
import { COMMANDS, type Command } from './index';
import { player } from '../world';

// The page's Fluent identifier: the dot is reserved for attributes
// ("jail.conf" → man-jail_conf).
export const page = (name: string) => `man-${name.replace(/\./g, '_')}`;

const section = (name: string) => COMMANDS[name]?.section ?? 1;

function texts(name: string, t: Translate) {
  const synopsis = t.exists(`${page(name)}.synopsis`) ? t(`${page(name)}.synopsis`) : '';
  const options = (name: string, c: Command): [string, string][] => (c.options ?? []).map((o) => [o, t(`${page(name)}.option-${o}`)]);
  // A language can adapt the command of an example that contains words (.command-N): grep "my password".
  const examples = (name: string, c: Command): [string, string][] =>
    (c.examples ?? []).map((e, i) => {
      const own = `${page(name)}.command-${i + 1}`;
      // The player's account (vous@wiki, /home/vous) and the machines (ssh royaume) take their name in the language (you@wiki, ssh kingdom).
      const command = t.exists(own) ? t(own) : translateHosts(e.replace(/\byou\b/g, player(t)), t, [translator('en')]);
      return [command, t(`${page(name)}.example-${i + 1}`)];
    });
  return { synopsis, description: t(page(name)), options, examples };
}

// The first sentence, without a final full stop, for the NAME line and whatis.
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
  // Like a real page: the section title, then its indented text.
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
  lines.push('', t('manual-complete', { command: name }));
  return lines.join('\n');
}

/** man -k / apropos: the commands whose name, synopsis or description contains the word. */
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
 * Checks the short options (-a, -la…) of a command that declares
 * its own. Returns coreutils' error message, or null.
 */
/** The known long options, rewritten as short options (--all → -a), as the command reads them. */
export const shorten = (c: Command, args: string[]): string[] => {
  const end = args.indexOf('--');
  return args.map((a, i) => (c.long && a.startsWith('--') && !a.includes('=') && (end < 0 || i < end) && c.long[a.slice(2)] ? `-${c.long[a.slice(2)]}` : a));
};

export function invalidOption(name: string, c: Command, args: string[], t: Translate): string | null {
  if (!c.options || c.ownOptions) return null;
  for (const a of args) {
    // After "--", no more options.
    if (a === '--') break;
    if (a.startsWith('--')) {
      const long = a.slice(2).split('=')[0];
      if (c.long && long in c.long) continue;
      return t('manual-option-long-unknown', { command: name, option: a.split('=')[0] });
    }
    if (!a.startsWith('-') || a === '-' || /^-\d+$/.test(a)) continue;
    for (const letter of a.slice(1)) if (!c.options.includes(letter)) return t('manual-option-invalid', { command: name, letter: letter });
  }
  return null;
}
