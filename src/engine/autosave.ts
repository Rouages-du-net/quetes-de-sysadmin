// Autosave inside a chapter. The engine is deterministic (see
// Console.restore): reopening a chapter and replaying what was typed since
// it opened (commands, answers, nano saves, Ctrl-C, Ctrl-Z, a follow's
// seconds) gives back exactly the same machine. So the interface keeps, in
// this browser's localStorage, the current chapter and its inputs after
// each one; when the game opens again (a tab closed, a phone that killed
// it), it offers to replay them. Nothing leaves the browser.
//
// What is kept is a log of inputs, written compactly (`encode`), with a
// fingerprint of the machine after them (`fingerprint`) and of the chapter's
// opening text (`hash`): after a new version of the game, a replay that
// does not lead to the same machine is detected and dropped.
//
// Not covered: what follows a passage through the workstation (exit, a
// reboot that closes the connection, a resumed session), nor a 5250 session:
// the console stops recording (Console.journal is null) and the autosave
// keeps the last point it could replay.

import type { Console, Input } from './console';

/** The format of the record (raised if it changes in an incompatible way). */
export const AUTOSAVE_VERSION = 1;
/** Beyond this many inputs, or this size, the autosave stops following (it keeps its last point). */
export const AUTOSAVE_MAX_INPUTS = 4000;
export const AUTOSAVE_MAX_CHARS = 1_000_000;

/** An input written compactly: a line as itself, the rest as a short array (a run of follows as one). */
export type Packed = string | ['s', string] | ['q'] | ['c'] | ['z'] | ['f', number, number];

export interface AutosaveRecord {
  v: number;
  story: string;
  chapter: string;
  /** The hash of the chapter's opening text (it changes when the chapter is rewritten). */
  opening: string;
  /** The number of inputs. */
  n: number;
  inputs: Packed[];
  /** The machine after the inputs (see fingerprint). */
  check: string;
  /** The hints already asked for (they stay counted). */
  hints: string[];
  exam: boolean;
  /** In exam mode, when the chapter started (ms since the epoch, read by the interface): the timer goes on. */
  examStart?: number;
}

/** The localStorage key of the autosave: one per language, since names and passwords are typed in it. */
export const autosaveKey = (saveKey: string, language: string) => `${saveKey}-autosave-${language}`;

export function encode(inputs: Input[]): Packed[] {
  const out: Packed[] = [];
  for (const i of inputs) {
    if ('line' in i) out.push(i.line);
    else if ('save' in i) out.push(['s', i.save]);
    else if ('quit' in i) out.push(['q']);
    else if ('interrupt' in i) out.push(['c']);
    else if ('suspend' in i) out.push(['z']);
    else {
      const last = out.at(-1);
      if (Array.isArray(last) && last[0] === 'f' && last[1] === i.follow) last[2]++;
      else out.push(['f', i.follow, 1]);
    }
  }
  return out;
}

/** The inputs back; null if the data is not a log the game wrote. */
export function decode(packed: unknown): Input[] | null {
  if (!Array.isArray(packed)) return null;
  const out: Input[] = [];
  for (const p of packed) {
    if (typeof p === 'string') out.push({ line: p });
    else if (!Array.isArray(p)) return null;
    else if (p[0] === 's' && typeof p[1] === 'string') out.push({ save: p[1] });
    else if (p[0] === 'q') out.push({ quit: true });
    else if (p[0] === 'c') out.push({ interrupt: true });
    else if (p[0] === 'z') out.push({ suspend: true });
    else if (p[0] === 'f' && typeof p[1] === 'number' && Number.isInteger(p[2]) && p[2] > 0 && p[2] <= AUTOSAVE_MAX_INPUTS)
      for (let k = 0; k < p[2]; k++) out.push({ follow: p[1] });
    else return null;
  }
  return out;
}

/** FNV-1a, 32 bits, in hexadecimal: enough to tell two texts apart. */
export function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * What the machine looks like after the inputs, in a few values that a
 * diverging replay would change (an error more or less, an objective not
 * reached, another directory, another machine). Not the outputs: they
 * depend on the screen's width and colours.
 */
export function fingerprint(c: Console): string {
  const sh = c.shell;
  const p = sh.principal;
  return hash([sh.host, sh.cwd, p.typedCommands, p.commandsInError, p.log.length, p.finished, c.inside.length].join('|'));
}

/** The record for the console's current chapter; null if it cannot be replayed (or nothing to keep). */
export function recordOf(c: Console, extra: { exam: boolean; examStart?: number | null }): AutosaveRecord | null {
  const journal = c.journal;
  if (!c.remote || !journal) return null;
  return {
    v: AUTOSAVE_VERSION,
    story: c.remote.story.id,
    chapter: c.remote.shell.chapter.id,
    opening: hash(c.opening),
    n: journal.length,
    inputs: encode(journal),
    check: fingerprint(c),
    hints: [...c.remote.shell.requestsHints],
    exam: extra.exam,
    ...(extra.exam && typeof extra.examStart === 'number' ? { examStart: extra.examStart } : {}),
  };
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Writes the record; false if it is too big or the browser refuses (quota, storage blocked). */
export function writeAutosave(store: Store, key: string, r: AutosaveRecord): boolean {
  if (r.n > AUTOSAVE_MAX_INPUTS) return false;
  const text = JSON.stringify(r);
  if (text.length > AUTOSAVE_MAX_CHARS) return false;
  try {
    store.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}

/** The record kept, checked; null if there is none or it isn't one. */
export function readAutosave(store: Store, key: string): AutosaveRecord | null {
  let raw: unknown;
  try {
    raw = JSON.parse(store.getItem(key) ?? 'null');
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== AUTOSAVE_VERSION) return null;
  if (typeof r.story !== 'string' || typeof r.chapter !== 'string' || typeof r.opening !== 'string' || typeof r.check !== 'string') return null;
  if (typeof r.n !== 'number' || !Array.isArray(r.inputs) || typeof r.exam !== 'boolean') return null;
  const inputs = decode(r.inputs);
  if (!inputs || inputs.length !== r.n) return null;
  return {
    v: AUTOSAVE_VERSION,
    story: r.story,
    chapter: r.chapter,
    opening: r.opening,
    n: r.n,
    inputs: r.inputs as Packed[],
    check: r.check,
    hints: Array.isArray(r.hints) ? r.hints.filter((x): x is string => typeof x === 'string') : [],
    exam: r.exam,
    ...(typeof r.examStart === 'number' ? { examStart: r.examStart } : {}),
  };
}

export function clearAutosave(store: Store, key: string): void {
  try {
    store.removeItem(key);
  } catch {}
}

export type ResumeResult =
  | { ok: true; transcript: ReplayStep[] }
  | { ok: false; reason: 'changed' | 'failed' };

/** One step of a replay, to show the end of the terminal as it was. */
export interface ReplayStep {
  prompt: string;
  line: string;
  /** A password typed: shown as the prompt alone. */
  masked: boolean;
  output: string;
}

/**
 * Replays a record on the console, whose current chapter must be the
 * record's, freshly opened: the machine comes back as it was, or the
 * reason it can't (the chapter changed since: another opening text, or a
 * replay that doesn't reach the same machine; or the replay failed).
 */
export function resume(c: Console, r: AutosaveRecord): ResumeResult {
  if (!c.remote || c.remote.shell.chapter.id !== r.chapter) return { ok: false, reason: 'failed' };
  const inputs = decode(r.inputs);
  if (!inputs) return { ok: false, reason: 'failed' };
  if (hash(c.opening) !== r.opening) return { ok: false, reason: 'changed' };
  let transcript: ReplayStep[];
  try {
    const replayed = c.replay(inputs);
    if (!replayed) return { ok: false, reason: 'failed' };
    transcript = replayed;
  } catch {
    return { ok: false, reason: 'failed' };
  }
  if (!c.remote || fingerprint(c) !== r.check) return { ok: false, reason: 'changed' };
  for (const h of r.hints) c.remote.shell.requestsHints.add(h);
  return { ok: true, transcript };
}
