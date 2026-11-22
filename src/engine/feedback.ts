// "Report a problem or an idea": the text of a report, built from what the
// player chose to include. The game never sends anything: the interface
// shows this text, then the player opens a GitHub issue prefilled with it
// (a link, in a new tab) or copies it.
//
// A pure function: the same choices and context give the same report. The
// context (version, chapter, commands typed and their outputs, browser,
// settings, notebook) is read by the interface; each part is in the report
// only when the player ticked it, and `partLines` gives, for each part,
// exactly the lines it would add (the dialog shows them next to its box).
// Whatever looks like a progress code (QDS-XXXX-XXXX…) is removed
// everywhere, the player's message included; a masked input (a password)
// never reaches the commands' transcript.
//
// The headings are in the player's language (the reader sees them in the
// issue); the lines under them start with stable English labels
// (`version:`, `chapter:`…), the same in every language, for whoever sorts
// the reports. GitHub's issue form reads `title` and `body` from the URL
// (https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue#creating-an-issue-from-a-url-query);
// a URL over about 8 KB fails, so the link's report drops the oldest lines
// of the transcript (then the end of a very long message) until it fits,
// and says so. The copied text is always whole. Texts: feedback-*
// (feedback.ftl).

import type { Translate } from '../texts';

export const FEEDBACK_KINDS = ['bug', 'text', 'idea', 'other'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** The parts of the context a report may include, in the order of the report. */
export const FEEDBACK_PARTS = ['version', 'language', 'chapter', 'commands', 'browser', 'settings', 'notebook'] as const;
export type FeedbackPart = (typeof FEEDBACK_PARTS)[number];
/** Ticked when the dialog opens: what says where the report comes from, nothing the player typed or their browser. */
export const DEFAULT_PARTS: readonly FeedbackPart[] = ['version', 'language', 'chapter'];

export const ISSUES_URL = 'https://github.com/Rouages-du-net/quetes-de-sysadmin/issues/new';
/** The issue template the link names (.github/ISSUE_TEMPLATE/feedback.md). */
export const ISSUE_TEMPLATE = 'feedback.md';
/** The longest link (characters, once encoded): GitHub refuses URLs much over 8 KB. */
export const URL_LIMIT = 8000;
/** The commands offered: the last ones typed in the chapter. */
export const STEPS_KEPT = 10;
/** An output longer than this keeps its first lines. */
export const OUTPUT_LINES = 30;
/** The title's summary, taken from the message's first line. */
const TITLE_LENGTH = 72;
/** The first line of every report: tells a report from the dialog (stable, not translated). */
export const REPORT_MARK = '<!-- sysadmin-quests feedback v1 -->';

/** A command typed and what it answered (colours already removed). */
export interface Step {
  prompt: string;
  line: string;
  /** A masked input (a password): only its prompt is kept. */
  masked?: boolean;
  output: string;
}

export interface FeedbackContext {
  version: string;
  language: string;
  /** Where the player is; null on the workstation, between chapters. */
  chapter?: {
    story: string;
    chapter: string;
    number: number;
    machine: string;
    directory: string;
    /** The chapter's events reached so far (the mission's log). */
    events: number;
    finished: boolean;
  } | null;
  /** The transcript of the last commands, as the player left it (see transcript()). */
  commands?: string;
  browser?: { userAgent: string; viewport: string; screen?: string };
  settings?: Record<string, string | number | boolean>;
  /** The commands noted in the notebook (their names only). */
  notebook?: string[];
}

export interface FeedbackInput {
  kind: FeedbackKind;
  message: string;
  parts: readonly FeedbackPart[];
  context: FeedbackContext;
  t: Translate;
  /** The longest link (default URL_LIMIT). */
  limit?: number;
}

export interface Report {
  title: string;
  /** The whole report (what "Copy" copies, after the title). */
  body: string;
  /** The link to a new issue, title and body prefilled (body shortened if needed). */
  url: string;
  /** The link's body is shorter than `body`. */
  truncated: boolean;
  /** The transcript's lines left out of the link. */
  omittedLines: number;
  /** The message was cut in the link too. */
  messageCut: boolean;
}

const PROGRESS_CODE = /\bQDS(?:[-\s][0-9A-Z]{1,4}){2,}\b/gi;
/** Removes whatever looks like a progress code. */
export const redact = (text: string, t: Translate) => text.replace(PROGRESS_CODE, t('feedback-redacted'));

// A fence longer than any run of backticks inside: the text cannot close it.
const fence = (text: string) => '`'.repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((m) => m[0].length + 1)));
const block = (text: string, info = '') => {
  const f = fence(text);
  return `${f}${info}\n${text}\n${f}`;
};

/**
 * The transcript offered for the report: the last `kept` steps, each its
 * prompt and line then its output (the first OUTPUT_LINES lines). A masked
 * input shows its prompt alone; the chapter's opening text (a step without
 * a prompt) is left out.
 */
export function transcript(steps: readonly Step[], t: Translate, kept = STEPS_KEPT): string {
  return steps
    .filter((s) => s.prompt)
    .slice(-kept)
    .map((s) => {
      const lines = s.output.replace(/\n+$/, '').split('\n');
      const output = lines.length > OUTPUT_LINES ? [...lines.slice(0, OUTPUT_LINES), t('feedback-output-cut', { count: lines.length - OUTPUT_LINES })] : s.output ? lines : [];
      return [s.masked ? s.prompt : `${s.prompt} ${s.line}`.trimEnd(), ...output].join('\n');
    })
    .join('\n');
}

// The first n UTF-16 units, never half a character (encodeURIComponent refuses a lone surrogate).
const cut = (text: string, n: number) => text.slice(0, n).replace(/[\uD800-\uDBFF]$/, '');

const onOff = (v: string | number | boolean) => (v === true ? 'on' : v === false ? 'off' : String(v));

/** The lines a part adds to the report's context ([] when there is nothing to say). */
export function partLines(part: FeedbackPart, context: FeedbackContext, t: Translate): string[] {
  const c = context;
  switch (part) {
    case 'version':
      return [`version: ${c.version}`];
    case 'language':
      return [`language: ${c.language}`];
    case 'chapter': {
      const ch = c.chapter;
      if (!ch) return ['chapter: none (workstation)'];
      return [
        `story: ${ch.story} (${t(`story-${ch.story}`)})`,
        `chapter: ${ch.chapter} (${ch.number}, ${t(`chapter-${ch.chapter}`)})`,
        `machine: ${ch.machine}`,
        `directory: ${ch.directory}`,
        `events: ${ch.events}${ch.finished ? ', finished' : ''}`,
      ];
    }
    case 'commands':
      return c.commands?.trim() ? redact(c.commands.replace(/\s+$/, ''), t).split('\n') : [];
    case 'browser':
      return c.browser ? [`user-agent: ${c.browser.userAgent}`, `viewport: ${c.browser.viewport}`, ...(c.browser.screen ? [`screen: ${c.browser.screen}`] : [])] : [];
    case 'settings':
      return c.settings && Object.keys(c.settings).length ? [`settings: ${Object.entries(c.settings).map(([k, v]) => `${k}=${onOff(v)}`).join(', ')}`] : [];
    case 'notebook':
      return [`notebook: ${c.notebook?.length ? c.notebook.join(', ') : '-'}`];
  }
}

/** The title: the kind, then the message's first line (or the chapter's title). */
function titleOf(input: FeedbackInput): string {
  const first = redact(input.message, input.t).trim().split('\n')[0].trim();
  const ch = input.parts.includes('chapter') ? input.context.chapter : null;
  const summary = first || (ch ? input.t(`chapter-${ch.chapter}`) : input.t(`feedback-kind-${input.kind}`));
  const short = summary.length > TITLE_LENGTH ? `${cut(summary, TITLE_LENGTH - 1).trimEnd()}…` : summary;
  return `[${input.kind}] ${short}`;
}

// The body, from a message and the transcript's lines (both possibly shortened).
function bodyOf(input: FeedbackInput, message: string, commands: string[], notes: string[]): string {
  const { t, context, parts } = input;
  const context0 = parts.filter((p) => p !== 'commands').flatMap((p) => partLines(p, context, t));
  const out = [REPORT_MARK, '', `### ${t('feedback-heading-kind')}`, '', `kind: ${input.kind} (${t(`feedback-kind-${input.kind}`)})`, '', `### ${t('feedback-heading-message')}`, '', message || t('feedback-no-message')];
  if (context0.length) out.push('', `### ${t('feedback-heading-context')}`, '', ...context0.map((l) => `- ${l}`));
  if (parts.includes('commands') && (commands.length || notes.length)) {
    out.push('', `### ${t('feedback-heading-commands')}`, '');
    if (notes.length) out.push(...notes, '');
    if (commands.length) out.push(block(commands.join('\n'), 'text'));
  }
  return `${out.join('\n')}\n`;
}

const urlOf = (title: string, body: string) =>
  `${ISSUES_URL}?template=${encodeURIComponent(ISSUE_TEMPLATE)}&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;

/** The report: its title, its whole body, and the link (shortened to fit, if needed). */
export function buildReport(input: FeedbackInput): Report {
  const { t } = input;
  const limit = input.limit ?? URL_LIMIT;
  const title = titleOf(input);
  const message = redact(input.message, t).trim();
  const commands = input.parts.includes('commands') ? partLines('commands', input.context, t) : [];
  const body = bodyOf(input, message, commands, []);
  let url = urlOf(title, body);
  if (url.length <= limit) return { title, body, url, truncated: false, omittedLines: 0, messageCut: false };
  // Too long: the oldest lines of the transcript go first (the last ones are where the problem shows).
  const withLines = (kept: number) => {
    const omitted = commands.length - kept;
    const notes = omitted ? [t('feedback-truncated', { count: omitted })] : [];
    return urlOf(title, bodyOf(input, message, commands.slice(omitted), notes));
  };
  let low = 0;
  let high = commands.length;
  // The most lines that fit (0 if none does).
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (withLines(mid).length <= limit) low = mid;
    else high = mid - 1;
  }
  url = withLines(low);
  const omittedLines = commands.length - low;
  if (url.length <= limit) return { title, body, url, truncated: true, omittedLines, messageCut: false };
  // Still too long: the end of the message goes too.
  const cutNote = t('feedback-message-cut');
  const notes = omittedLines ? [t('feedback-truncated', { count: omittedLines })] : [];
  const withMessage = (n: number) => urlOf(title, bodyOf(input, `${cut(message, n).trimEnd()}…\n\n${cutNote}`, [], notes));
  let lo = 0;
  let hi = message.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (withMessage(mid).length <= limit) lo = mid;
    else hi = mid - 1;
  }
  return { title, body, url: withMessage(lo), truncated: true, omittedLines, messageCut: true };
}

/** The text "Copy" puts on the clipboard: the title, then the whole body. */
export const reportText = (r: Report) => `${r.title}\n\n${r.body}`;
