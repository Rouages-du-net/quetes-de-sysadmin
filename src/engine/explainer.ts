// The error explainer: when a command fails with an error beginners often
// misread ("Permission denied", "No such file or directory", "Connection
// refused"…), the interface offers a short explanation in plain words, under
// the output, which the player may open. The output itself never changes: it
// stays the real tool's. An explanation says what the message means and
// which manual page or diagnostic command to turn to, never the chapter's
// answer. Never in exam mode, and it can be turned off (an interface setting).
//
// The engine only recognises the error. What it looks for are the messages
// as the game prints them: each explanation's `.match` attribute in
// src/texts/<language>/explainer.ftl lists them, one per line (`*` stands
// for any text, a final `$` for the end of the line). Many tools answer in
// English whatever the language, as on a real system, and the game prints
// some messages in the player's language (as with LANG=fr_FR.UTF-8): the
// markers of the game's language and English's are both read. The
// explanation's text is the message itself (explainer-<id>).

import type { Translate } from '../texts';
import { translator } from '../texts';

/** The explanations, in the order they are tried: the most specific first. */
export const EXPLANATIONS = [
  'sudo-password',
  'sudoers',
  'ssh-denied',
  'config-test',
  'yaml',
  'unit-not-found',
  'unit-failed',
  'db-access-denied',
  'db-unreachable',
  'db-too-many',
  'db-syntax',
  'db-read-only',
  'sieve-compile',
  'dovecot-config',
  'mail-unknown-user',
  'search-query',
  'ups-unknown',
  'ups-denied',
  'ups-driver',
  's3-date',
  's3-region',
  's3-access-denied',
  's3-no-bucket',
  's3-credentials',
  'garage-layout',
  'tofu-lock',
  'tofu-init',
  'tofu-variable',
  'tofu-argument',
  'sops-no-key',
  'sops-mac',
  'sops-no-rule',
  'age-keygen-exists',
  'refused',
  'timed-out',
  'no-route',
  'resolve',
  'address-in-use',
  'read-only',
  'no-space',
  'syntax',
  'ps-not-recognized',
  'not-found',
  'access-denied',
  'permission',
  'not-permitted',
  'not-directory',
  'is-directory',
  'no-such-file',
] as const;
export type Explanation = (typeof EXPLANATIONS)[number];

/** What the interface knows of a line just run. */
export interface Failure {
  // Did the line fail (an error, or a non-zero exit code)? Nothing is explained otherwise.
  failed: boolean;
  // What was printed on the screen.
  output: string;
  // The error messages alone (standard error), when known: read instead of the output,
  // so that a file's content (cat of a log) is never taken for the command's error.
  errors?: readonly string[] | null;
}

// Messages that have their own story in the game (a script saved with CR LF
// line endings: "bad interpreter"): no general explanation would be right.
const LEFT_ALONE = [/\^M: bad interpreter/];

const escape = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
/** A marker (`*`: any text on the line, a final `$`: end of line) as a regular expression. */
export function markerPattern(marker: string): RegExp {
  const end = marker.endsWith('$');
  const body = (end ? marker.slice(0, -1) : marker)
    .split('*')
    .map((part) => escape(part).replace(/ /g, '[ \\u00a0\\u202f]'))
    .join('[^\\n]*');
  return new RegExp(body + (end ? '[ \\t]*$' : ''), 'm');
}

// The markers of each explanation, per language (read once).
const cache = new Map<string, Map<Explanation, RegExp[]>>();
const markersOf = (t: Translate): Map<Explanation, RegExp[]> => {
  let m = cache.get(t.language);
  if (!m) {
    const english = t.language === 'en' ? null : translator('en');
    const lines = (tr: Translate, id: string) => (tr.exists(`${id}.match`) ? tr(`${id}.match`).split('\n') : []);
    m = new Map(
      EXPLANATIONS.map((e) => {
        const id = `explainer-${e}`;
        const all = [...lines(t, id), ...(english ? lines(english, id) : [])].map((l) => l.trim()).filter(Boolean);
        return [e, [...new Set(all)].map(markerPattern)];
      }),
    );
    // English's markers come with its core texts, loaded after a translation's: kept once they are there.
    if (!english || english.exists('explainer-button')) cache.set(t.language, m);
  }
  return m;
};

/** The markers of an explanation in this language (tests). */
export const markers = (t: Translate, e: Explanation): RegExp[] => markersOf(t).get(e) ?? [];

/** The explanation for a line that failed, or null (none fits, or the line didn't fail). */
export function explain(f: Failure, t: Translate): Explanation | null {
  if (!f.failed) return null;
  const text = (f.errors?.length ? f.errors.join('\n') : f.output).trim();
  if (!text || LEFT_ALONE.some((r) => r.test(text))) return null;
  const all = markersOf(t);
  return EXPLANATIONS.find((e) => all.get(e)!.some((r) => r.test(text))) ?? null;
}
