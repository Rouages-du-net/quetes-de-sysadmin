// Replaying a chapter and comparing: each finished chapter keeps its last
// runs in the browser (the numbers of the end-of-chapter summary, see
// summary.ts, and the lines the player typed), so that a replay can be set
// next to the runs before it: commands, distinct commands, failed commands,
// hints, time, and the two lists of commands, diff-like.
// The expected route stays the summary's (the hints' reference solutions):
// nothing more is revealed here. The engine stays deterministic: the date
// and the time spent come from the interface.

/** One finished run of a chapter. */
export interface Run {
  chapter: string;
  /** When it ended (ISO, given by the interface). */
  date: string;
  /** Time spent in ms (null: not measured). */
  time: number | null;
  /** Commands typed (an answer to a question is not one), and those that failed. */
  commands: number;
  errors: number;
  hints: number;
  /** Distinct command names (ls, sudo systemctl… counts systemctl). */
  distinct: number;
  /** Played in exam mode. */
  exam: boolean;
  /** The lines typed, in order (capped: LINES_KEPT, each LINE_MAX characters). */
  lines: string[];
}

export type Runs = Record<string, Run[]>;

// What is kept: the last runs of each chapter, the most recent chapters,
// and a bounded number of lines (a few hundred KB at worst in localStorage).
export const RUNS_KEPT = 3;
export const CHAPTERS_KEPT = 30;
export const LINES_KEPT = 60;
export const LINE_MAX = 120;

// Words that run the command after them (sudo systemctl → systemctl).
const PREFIXES = new Set(['sudo', 'doas', 'time', 'nohup', 'env', 'nice', 'ionice', 'command', 'exec', 'watch']);
const OPTION_VALUE = new Set(['-u', '-g', '-n', '-c', '-p', '-C']);

/**
 * The command names of a line: the first word of each simple command
 * (split on |, ;, &&, ||, &), past variable assignments, sudo and the like,
 * and their options. Rough on purpose (a count for the comparison), never
 * used to check anything.
 */
export function commandNames(line: string): string[] {
  const names: string[] = [];
  for (const part of line.split(/\|\|?|&&?|;/)) {
    const words = part.trim().split(/\s+/).filter(Boolean);
    let i = 0;
    while (i < words.length) {
      if (/^[A-Za-z_]\w*=/.test(words[i])) i++;
      else if (PREFIXES.has(words[i])) {
        i++;
        // The prefix's options, and the value of those that take one (sudo -u bob, nice -n 10).
        while (words[i]?.startsWith('-')) i += OPTION_VALUE.has(words[i]) ? 2 : 1;
      } else break;
    }
    const name = words[i]?.replace(/^[({!]+/, '');
    if (name && /^[\w./:-]+$/.test(name)) names.push(name);
  }
  return names;
}

/** A run from what the interface measured: the lines capped, the distinct commands counted. */
export function makeRun(r: Omit<Run, 'distinct' | 'lines'> & { lines: readonly string[] }): Run {
  const distinct = new Set(r.lines.flatMap(commandNames)).size;
  const lines = r.lines.slice(-LINES_KEPT).map((l) => (l.length > LINE_MAX ? `${l.slice(0, LINE_MAX - 1)}…` : l));
  return { ...r, distinct, lines };
}

/** The store with this run added: the chapter's last RUNS_KEPT, the CHAPTERS_KEPT chapters played last. */
export function addRun(runs: Runs, run: Run): Runs {
  const out: Runs = { ...runs, [run.chapter]: [...(runs[run.chapter] ?? []), run].slice(-RUNS_KEPT) };
  const latest = (id: string) => out[id].at(-1)?.date ?? '';
  const chapters = Object.keys(out).sort((a, b) => (latest(b) < latest(a) ? -1 : latest(b) > latest(a) ? 1 : 0));
  return Object.fromEntries(chapters.slice(0, CHAPTERS_KEPT).map((id) => [id, out[id]]));
}

const count = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;

/** The store as read from localStorage, cleaned (anything odd is dropped). */
export function readRuns(x: unknown): Runs {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {};
  const out: Runs = {};
  for (const [id, list] of Object.entries(x as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const runs = list.filter(
      (r): r is Run =>
        !!r &&
        typeof r === 'object' &&
        r.chapter === id &&
        typeof r.date === 'string' &&
        (r.time === null || count(r.time)) &&
        [r.commands, r.errors, r.hints, r.distinct].every(count) &&
        typeof r.exam === 'boolean' &&
        Array.isArray(r.lines) &&
        r.lines.every((l: unknown) => typeof l === 'string'),
    );
    if (runs.length) out[id] = runs.slice(-RUNS_KEPT).map((r) => ({ ...r, lines: r.lines.slice(-LINES_KEPT) }));
  }
  return out;
}

export type DiffKind = 'both' | 'before' | 'after';
export interface DiffLine {
  kind: DiffKind;
  line: string;
}

/**
 * Two lists of commands, diff-like: the longest common subsequence kept as
 * "both", the rest marked as only in the earlier run ("before") or only in
 * this one ("after"), each removal before the addition at the same place.
 */
export function diffLines(before: readonly string[], after: readonly string[]): DiffLine[] {
  const n = before.length;
  const m = after.length;
  // lcs[i][j]: the longest common subsequence of before[i..] and after[j..].
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) lcs[i][j] = before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && before[i] === after[j]) {
      out.push({ kind: 'both', line: before[i] });
      i++;
      j++;
    } else if (j >= m || (i < n && lcs[i + 1][j] >= lcs[i][j + 1])) out.push({ kind: 'before', line: before[i++] });
    else out.push({ kind: 'after', line: after[j++] });
  }
  return out;
}

export const METRICS = ['commands', 'distinct', 'errors', 'hints', 'time'] as const;
export type Metric = (typeof METRICS)[number];

export interface Comparison {
  /** The runs compared, oldest first; the last one is this run. */
  runs: Run[];
  /** For each metric, its value in each run (null: not measured), and whether this run did better, worse or the same as the one before. */
  rows: { metric: Metric; values: (number | null)[]; trend: 'better' | 'worse' | 'same' | null }[];
  /** This run's commands next to the previous run's. */
  diff: DiffLine[];
}

/** This run next to the ones before it (null: no earlier run to compare with). */
export function compare(earlier: readonly Run[], current: Run): Comparison | null {
  if (!earlier.length) return null;
  const runs = [...earlier.slice(-(RUNS_KEPT - 1)), current];
  const previous = runs.at(-2)!;
  const rows = METRICS.map((metric) => {
    const values = runs.map((r) => r[metric]);
    const [a, b] = [previous[metric], current[metric]];
    // Fewer is better: commands, errors, hints, time. The number of distinct
    // commands is neither (more tools tried is not worse): no trend.
    const trend: 'better' | 'worse' | 'same' | null = metric === 'distinct' || a === null || b === null ? null : b < a ? 'better' : b > a ? 'worse' : 'same';
    return { metric, values, trend };
  });
  return { runs, rows, diff: diffLines(previous.lines, current.lines) };
}
