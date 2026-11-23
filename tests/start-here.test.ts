// "Where do I start?" (start-here.ts): every combination of answers gives a
// path and a chapter that can be played now, from any point of progress;
// teachers are pointed to their page; the texts exist in every language.
import { describe, expect, it } from 'vitest';
import { CATALOGUE as STORIES } from '../src/engine/catalogue';
import { CODE_ORDER } from '../src/engine/progress';
import { PATH } from '../src/engine/paths';
import { isOpen } from '../src/engine/unlocking';
import { allAnswers, complete, playable, QUESTIONS, readAnswers, recommend, suggestion, TEACHERS_PAGE, type Recommendation } from '../src/engine/start-here';
import { LANGUAGES, translator } from '../src/texts';

const ALL = STORIES.flatMap((s) => s.chapters.map((c) => c.id));
// A chapter is open when its story is open and the chapter before it is finished.
const canPlay = (chapter: string, finished: readonly string[]) => {
  const story = STORIES.find((s) => s.chapters.some((c) => c.id === chapter))!;
  const i = story.chapters.findIndex((c) => c.id === chapter);
  return !finished.includes(chapter) && isOpen(story.id, finished) && (i === 0 || finished.includes(story.chapters[i - 1].id));
};
// Progress as a player makes it: chapters finished in the game's order, each one open when finished.
const prefixes = (): string[][] => {
  const out: string[][] = [[]];
  const done: string[] = [];
  for (let next = ALL.find((c) => canPlay(c, done)); next; next = ALL.find((c) => canPlay(c, done))) {
    done.push(next);
    out.push([...done]);
  }
  return out;
};
// Every fifth point, and the end.
const progressions = () => prefixes().filter((f, i, all) => i % 5 === 0 || i === all.length - 1);

const valid = (r: Recommendation, finished: readonly string[]) => {
  for (const s of [r.main, ...r.alternatives]) {
    expect(PATH.map((p) => p.id)).toContain(s.path);
    expect(ALL).toContain(s.chapter);
    expect(canPlay(s.chapter, finished), `${s.chapter} playable after ${finished.length} chapters`).toBe(true);
    expect(PATH.find((p) => p.id === s.path)!.chapters).toContain(s.target);
    expect(finished).not.toContain(s.target);
    if (s.before === 0) expect(s.chapter).toBe(s.target);
    else expect(canPlay(s.target, finished)).toBe(false);
  }
  const paths = [r.main, ...r.alternatives].map((s) => s.path);
  expect(new Set(paths).size).toBe(paths.length);
  expect(r.alternatives.length).toBeLessThanOrEqual(2);
};

describe('Where do I start?', () => {
  it('every combination of answers, on a first visit, gives a playable chapter and one or two alternatives', () => {
    expect(allAnswers().length).toBe(3 * 4 * 6 * 3);
    for (const a of allAnswers()) {
      const r = recommend(a)!;
      expect(r, JSON.stringify(a)).not.toBeNull();
      valid(r, []);
      expect(r.alternatives.length).toBeGreaterThanOrEqual(1);
      // On a first visit, only The Eraser is open.
      expect(r.main.chapter).toBe('lighthouse');
    }
  });

  it('every combination stays playable as the player progresses, until everything is done', () => {
    for (const finished of progressions())
      for (const a of allAnswers()) {
        const r = recommend(a, finished);
        if (r) valid(r, finished);
        else expect(PATH.every((p) => p.chapters.every((c) => finished.includes(c)))).toBe(true);
      }
    expect(recommend(allAnswers()[0], ALL)).toBeNull();
  });

  it('a beginner starts with the first steps, the others with what interests them', () => {
    expect(recommend({ experience: 'never', goal: 'job', systems: 'security', time: 'medium' })!.main).toMatchObject({ path: 'start', reason: 'start-here-reason-beginner', before: 0 });
    const security = recommend({ experience: 'daily', goal: 'job', systems: 'security', time: 'medium' })!;
    expect(security.main.path).toBe('security');
    expect(security.main.target).toBe('shut-the-door');
    // shut-the-door opens with The Letters: after reboot-night and lost-packet, and what they assume.
    expect(security.main.before).toBeGreaterThan(0);
    expect(security.main.chapter).toBe('lighthouse');
    expect(recommend({ experience: 'little', goal: 'curiosity', systems: 'windows', time: 'medium' })!.main.path).toBe('identities');
    expect(recommend({ experience: 'daily', goal: 'curiosity', systems: 'vintage', time: 'medium' })!.main.path).toBe('production');
    expect(recommend({ experience: 'daily', goal: 'studies', systems: 'network', time: 'medium' })!.main.path).toBe('network');
    expect(recommend({ experience: 'daily', goal: 'job', systems: 'linux', time: 'medium' })!.main.path).toBe('deployment');
  });

  it('teachers are pointed to the teachers’ page, and start where their students do', () => {
    for (const a of allAnswers().filter((x) => x.goal === 'teacher')) {
      const r = recommend(a)!;
      expect(r.teacher).toBe(true);
      expect(r.main).toMatchObject({ path: 'start', reason: 'start-here-reason-teacher' });
    }
    expect(allAnswers().filter((x) => x.goal !== 'teacher').every((a) => !recommend(a)!.teacher)).toBe(true);
    for (const language of LANGUAGES) expect(TEACHERS_PAGE[language], language).toMatch(/^\/[a-z]+\/[a-z]+\/$/);
  });

  it('the suggestion follows progress: a finished path gives way, a chapter opens once what it needs is done', () => {
    const start = PATH.find((p) => p.id === 'start')!.chapters;
    const a = { experience: 'never', goal: 'curiosity', systems: 'linux', time: 'medium' } as const;
    // The first steps done: the next path is suggested instead.
    const finished = prefixes().find((f) => start.every((c) => f.includes(c)))!;
    expect(recommend(a, finished)!.main.path).not.toBe('start');
    // The Letters open: shut-the-door is the suggestion itself.
    const open = prefixes().find((f) => canPlay('shut-the-door', f))!;
    expect(suggestion('security', 'x', open)).toMatchObject({ target: 'shut-the-door', chapter: 'shut-the-door', before: 0 });
    // A story opened by the host page (the story attribute) counts as open.
    expect(suggestion('security', 'x', [], (s) => s === 'letters' || isOpen(s, []))).toMatchObject({ chapter: 'shut-the-door', before: 0 });
  });

  it('with little time, the way in that opens soonest comes first', () => {
    const short = recommend({ experience: 'daily', goal: 'job', systems: 'security', time: 'short' })!;
    expect(short.alternatives.map((s) => s.before)).toEqual([...short.alternatives.map((s) => s.before)].sort((x, y) => x - y));
    expect(short.note).toBe('start-here-note-short');
  });

  it('playable(): the rules of the menu', () => {
    expect(playable('lighthouse', [])).toBe(true);
    expect(playable('village', [])).toBe(false);
    expect(playable('village', ['lighthouse'])).toBe(true);
    expect(playable('first-day', ['lighthouse', 'village'])).toBe(false);
    expect(playable('lighthouse', ['lighthouse'])).toBe(false);
  });

  it('answers read back: unknown values dropped, partial answers kept', () => {
    expect(readAnswers(null)).toEqual({});
    expect(readAnswers({ experience: 'daily', goal: 'nope', time: 3 })).toEqual({ experience: 'daily' });
    expect(complete(readAnswers({ experience: 'daily' }))).toBe(false);
    expect(complete(readAnswers(allAnswers()[5]))).toBe(true);
  });

  it('the CODE_ORDER is untouched: the answers are not progress', () => {
    expect(CODE_ORDER.length).toBe(ALL.length);
  });

  for (const language of LANGUAGES)
    it(`every text in ${language}`, () => {
      const t = translator(language);
      const keys = new Set(['start-here-title', 'start-here-intro', 'start-here-offer-title', 'start-here-offer-text', 'start-here-offer-answer', 'start-here-offer-dismiss', 'start-here-button', 'start-here-result', 'start-here-incomplete', 'start-here-alternatives', 'start-here-teachers', 'start-here-teachers-link', 'start-here-all-done', 'start-here-locked', 'start-here-close', 'tour-start-here', 'start-here-announce', 'start-here-path', 'start-here-chapter']);
      for (const q of Object.keys(QUESTIONS) as (keyof typeof QUESTIONS)[]) {
        keys.add(`start-here-${q}`);
        for (const v of QUESTIONS[q]) keys.add(`start-here-${q}-${v}`);
      }
      for (const a of allAnswers()) {
        const r = recommend(a)!;
        for (const s of [r.main, ...r.alternatives]) keys.add(s.reason);
        keys.add(r.note);
      }
      for (const p of PATH) keys.add(`start-here-why-${p.id}`);
      for (const k of keys) expect(t.exists(k), `${k} in ${language}`).toBe(true);
    });
});
