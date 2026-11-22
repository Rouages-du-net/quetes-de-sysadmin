// "Report a problem or an idea" (src/engine/feedback.ts): the report holds
// only the parts ticked, never a progress code nor a password, keeps its
// stable labels in every language, and its link stays under GitHub's limit
// by dropping the oldest lines of commands (then the message's end), saying so.
import { describe, expect, it } from 'vitest';
import {
  buildReport,
  DEFAULT_PARTS,
  FEEDBACK_KINDS,
  FEEDBACK_PARTS,
  ISSUES_URL,
  OUTPUT_LINES,
  partLines,
  REPORT_MARK,
  reportText,
  transcript,
  URL_LIMIT,
  type FeedbackContext,
  type Step,
} from '../src/engine/feedback';
import { progressCode } from '../src/engine/progress';
import { translator } from '../src/texts';

const en = translator('en');
const fr = translator('fr');

const steps: Step[] = [
  { prompt: '', line: '', output: 'Welcome to the chapter' },
  { prompt: 'player@desk:~$', line: 'ls', output: 'notes.txt' },
  { prompt: '[sudo] password for player:', line: 'hunter2', masked: true, output: 'Sorry, try again.' },
  { prompt: 'player@desk:~$', line: 'cat notes.txt', output: 'line\n'.repeat(OUTPUT_LINES + 5) },
];

const context = (commands = transcript(steps, en)): FeedbackContext => ({
  version: '0.1.0+abc1234 2026-11-22',
  language: 'en',
  chapter: { story: 'eraser', chapter: 'first-day', number: 1, machine: 'kingdom', directory: '/home/player', events: 2, finished: false },
  commands,
  browser: { userAgent: 'Mozilla/5.0 (Test)', viewport: '375x900', screen: '375x812' },
  settings: { theme: 'phosphor', size: 2, colours: true, exam: false },
  notebook: ['cd', 'ls'],
});

const decoded = (url: string) => {
  const u = new URL(url);
  return { title: u.searchParams.get('title')!, body: u.searchParams.get('body')!, template: u.searchParams.get('template') };
};

describe('the transcript of the last commands', () => {
  const text = transcript(steps, en);
  it('keeps prompts and lines, never a masked input nor the opening', () => {
    expect(text).toContain('player@desk:~$ ls\nnotes.txt');
    expect(text).toContain('[sudo] password for player:\nSorry, try again.');
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('Welcome to the chapter');
  });
  it('cuts a long output and keeps only the last steps', () => {
    expect(text).toContain('[… 5 more lines]');
    expect(text.split('\n').filter((l) => l === 'line')).toHaveLength(OUTPUT_LINES);
    const many = Array.from({ length: 30 }, (_, i) => ({ prompt: '$', line: `echo ${i}`, output: String(i) }));
    const kept = transcript(many, en, 10);
    expect(kept.startsWith('$ echo 20\n20')).toBe(true);
    expect(kept).not.toContain('echo 19');
  });
});

describe('the report', () => {
  it('holds only the parts ticked', () => {
    const r = buildReport({ kind: 'bug', message: 'ls shows nothing', parts: DEFAULT_PARTS, context: context(), t: en });
    expect(r.body.startsWith(REPORT_MARK)).toBe(true);
    expect(r.body).toContain('kind: bug (A command that behaves wrongly)');
    expect(r.body).toContain('- version: 0.1.0+abc1234 2026-11-22');
    expect(r.body).toContain('- language: en');
    expect(r.body).toContain('- chapter: first-day (1, ');
    expect(r.body).toContain('- machine: kingdom');
    for (const absent of ['user-agent', 'viewport', 'settings:', 'notebook:', 'player@desk', '### Last commands']) expect(r.body).not.toContain(absent);
    const all = buildReport({ kind: 'bug', message: 'x', parts: FEEDBACK_PARTS, context: context(), t: en });
    for (const present of ['- user-agent: Mozilla/5.0 (Test)', '- viewport: 375x900', '- settings: theme=phosphor, size=2, colours=on, exam=off', '- notebook: cd, ls', '### Last commands', '```text\nplayer@desk:~$ ls']) expect(all.body).toContain(present);
    const none = buildReport({ kind: 'idea', message: 'x', parts: [], context: context(), t: en });
    expect(none.body).not.toContain('### Context');
    expect(none.body).not.toContain('version:');
  });

  it('shows each part exactly as its box says', () => {
    const r = buildReport({ kind: 'other', message: 'x', parts: FEEDBACK_PARTS, context: context(), t: en });
    for (const part of FEEDBACK_PARTS) for (const line of partLines(part, context(), en)) expect(r.body).toContain(line);
    expect(partLines('chapter', { ...context(), chapter: null }, en)).toEqual(['chapter: none (workstation)']);
    expect(partLines('commands', context(''), en)).toEqual([]);
  });

  it('removes progress codes, wherever they are', () => {
    const code = progressCode(['lighthouse', 'first-day']);
    const r = buildReport({ kind: 'bug', message: `my code is ${code} and ${code.toLowerCase()}`, parts: ['commands'], context: context(`$ echo ${code}\n${code}`), t: en });
    expect(reportText(r)).not.toMatch(/QDS-/i);
    expect(r.body).toContain('[progress code removed]');
    expect(r.title).not.toMatch(/QDS-/i);
  });

  it('a title from the kind and the message, or the chapter', () => {
    expect(buildReport({ kind: 'text', message: '  The hint is unclear\nmore', parts: [], context: context(), t: en }).title).toBe('[text] The hint is unclear');
    const long = buildReport({ kind: 'idea', message: 'a'.repeat(200), parts: [], context: context(), t: en }).title;
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith('…')).toBe(true);
    expect(buildReport({ kind: 'bug', message: '', parts: ['chapter'], context: context(), t: en }).title).toBe(`[bug] ${en('chapter-first-day')}`);
    expect(buildReport({ kind: 'bug', message: '', parts: [], context: context(), t: en }).body).toContain('(no message)');
  });

  it('a link to a new issue, title and body prefilled and encoded', () => {
    const message = 'Accents é, & ? # % + and a fence ``` inside';
    const r = buildReport({ kind: 'bug', message, parts: FEEDBACK_PARTS, context: context(), t: en });
    expect(r.url.startsWith(`${ISSUES_URL}?`)).toBe(true);
    expect(r.truncated).toBe(false);
    const d = decoded(r.url);
    expect(d.title).toBe(r.title);
    expect(d.body).toBe(r.body);
    expect(d.template).toBe('feedback.md');
    expect(r.body).toContain(message);
    // An output with ``` cannot close the transcript's block.
    const fenced = buildReport({ kind: 'bug', message: 'x', parts: ['commands'], context: context('$ cat a.md\n```\ncode\n```'), t: en });
    expect(fenced.body).toContain('````text\n$ cat a.md');
  });

  it('a link too long drops the oldest lines of commands, and says so', () => {
    const many = Array.from({ length: 400 }, (_, i) => ({ prompt: '$', line: `echo ${'x'.repeat(20)} ${i}`, output: `${'y'.repeat(20)} ${i}` }));
    const commands = transcript(many, en, 400);
    const r = buildReport({ kind: 'bug', message: 'too long', parts: FEEDBACK_PARTS, context: context(commands), t: en });
    expect(r.url.length).toBeLessThanOrEqual(URL_LIMIT);
    expect(r.truncated).toBe(true);
    expect(r.messageCut).toBe(false);
    expect(r.omittedLines).toBeGreaterThan(0);
    const d = decoded(r.url);
    expect(d.body).toContain(`(The ${r.omittedLines} oldest lines were left out to fit in the link.)`);
    // The last lines are kept; the whole text still has everything.
    expect(d.body).toContain('y'.repeat(20) + ' 399');
    expect(d.body).not.toContain('echo ' + 'x'.repeat(20) + ' 0\n');
    expect(r.body).toContain('echo ' + 'x'.repeat(20) + ' 0\n');
    // As many lines as fit: one more would not.
    const more = buildReport({ kind: 'bug', message: 'too long', parts: FEEDBACK_PARTS, context: context(commands), t: en, limit: r.url.length + 200 });
    expect(more.omittedLines).toBeLessThanOrEqual(r.omittedLines);
  });

  it('a message too long for the link is cut short, and says so', () => {
    const r = buildReport({ kind: 'idea', message: 'é'.repeat(5000) + '😀'.repeat(500), parts: DEFAULT_PARTS, context: context(), t: en });
    expect(r.url.length).toBeLessThanOrEqual(URL_LIMIT);
    expect(r.truncated && r.messageCut).toBe(true);
    expect(decoded(r.url).body).toContain('(The message was cut short to fit in the link.)');
    expect(r.body).toContain('😀'.repeat(500));
  });

  it('in French: headings in the reader’s language, the same stable labels', () => {
    const ctx = { ...context(transcript(steps, fr)), language: 'fr' };
    const a = buildReport({ kind: 'bug', message: 'x', parts: FEEDBACK_PARTS, context: ctx, t: en }).body;
    const b = buildReport({ kind: 'bug', message: 'x', parts: FEEDBACK_PARTS, context: ctx, t: fr }).body;
    expect(b).toContain('### Type');
    expect(b).toContain('### Contexte');
    expect(b).toContain('### Dernières commandes');
    expect(b).toContain('kind: bug (Une commande qui se comporte mal)');
    const labels = (s: string) => s.split('\n').filter((l) => /^(- )?[a-z-]+: /.test(l)).map((l) => l.replace(/^- /, '').split(':')[0]);
    expect(labels(b)).toEqual(labels(a));
    expect(labels(b)).toEqual(['kind', 'version', 'language', 'story', 'chapter', 'machine', 'directory', 'events', 'user-agent', 'viewport', 'screen', 'settings', 'notebook']);
    // Same structure: as many headings, in the same order.
    expect(b.match(/^### /gm)!.length).toBe(a.match(/^### /gm)!.length);
  });

  it('the marker closes, and the player\'s text is never retouched by typography', () => {
    for (const t of [en, fr]) {
      const message = 'Pourquoi ? ls : « erreur » ; vraiment !';
      const commands = 'vous@royaume:~$ echo "a : b ?"\na : b ?';
      const r = buildReport({ kind: 'bug', message, parts: ['commands'], context: context(commands), t });
      expect(r.body.startsWith('<!-- sysadmin-quests feedback v1 -->\n')).toBe(true);
      expect(r.body).not.toContain('→');
      expect(r.body).toContain(message);
      expect(r.body).toContain(commands);
      expect(r.body).not.toMatch(/[\u00a0\u202f]/);
    }
  });

  it('every kind has its label in both languages', () => {
    for (const t of [en, fr]) for (const k of FEEDBACK_KINDS) expect(t.exists(`feedback-kind-${k}`)).toBe(true);
    for (const t of [en, fr]) for (const p of FEEDBACK_PARTS) expect(t.exists(`feedback-part-${p}`)).toBe(true);
  });
});
