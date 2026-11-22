// Autosave inside a chapter (src/engine/autosave.ts): the inputs kept in
// localStorage are replayed on a fresh game, and give back the same machine.
import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { storyMachine } from '../src/engine/machines';
import {
  AUTOSAVE_MAX_INPUTS,
  autosaveKey,
  clearAutosave,
  decode,
  encode,
  fingerprint,
  hash,
  readAutosave,
  recordOf,
  resume,
  writeAutosave,
  type AutosaveRecord,
} from '../src/engine/autosave';
import { translator } from '../src/texts';
import { inLanguage } from './names';

const L = (text: string) => inLanguage(translator('fr'), text);
const ERASER = ['lighthouse', 'village', 'root', 'backup'];

// localStorage as a browser has it, in memory; `full`: the quota is reached.
function fakeStorage(full = false) {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (full) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
  };
}

// The game opening a chapter straight from the menu (as the interface's launch does).
function openChapter(language: 'fr' | 'en', finished: string[], story: string, chapter?: string) {
  const c = new Console({ language, finished });
  const h = STORIES.find((x) => x.id === story)!;
  c.connect(storyMachine(story)!.name, chapter ? h.chapters.find((x) => x.id === chapter) : undefined);
  return c;
}

describe('Autosave', () => {
  it('encodes inputs compactly (a run of follows as one) and decodes them back', () => {
    const inputs = [
      { line: 'ls' },
      { follow: 3 },
      { follow: 3 },
      { follow: 3 },
      { interrupt: true as const },
      { save: 'text\n' },
      { quit: true as const },
      { suspend: true as const },
      { follow: 2 },
    ];
    const packed = encode(inputs);
    expect(packed).toEqual(['ls', ['f', 3, 3], ['c'], ['s', 'text\n'], ['q'], ['z'], ['f', 2, 1]]);
    expect(decode(JSON.parse(JSON.stringify(packed)))).toEqual(inputs);
    expect(decode([['x']])).toBeNull();
    expect(decode('ls')).toBeNull();
    expect(hash('a')).not.toBe(hash('b'));
    expect(hash('abc')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('the inputs kept, replayed on a new game, give back the same machine', () => {
    const store = fakeStorage();
    const key = autosaveKey('quetes-de-sysadmin', 'fr');
    expect(key).toBe('quetes-de-sysadmin-autosave-fr');
    const c = openChapter('fr', [], 'eraser');
    c.execute(L('mv Pier/net Harbour/Boathouse'));
    c.execute(L('cd Harbour'));
    c.execute(L('ls Boathouse'));
    c.execute(L('cat nowhere.txt'));
    c.remote!.shell.requestsHints.add(':manual');
    const record = recordOf(c, { exam: false })!;
    expect(record.n).toBe(4);
    expect(writeAutosave(store, key, record)).toBe(true);
    const listing = c.execute('ls');

    // The tab is closed; the game opens again, on the same chapter, and replays.
    const read = readAutosave(store, key)!;
    expect(read).toEqual(record);
    const fresh = openChapter('fr', [], read.story, read.chapter);
    const result = resume(fresh, read);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The end of the terminal: the opening, then each line with its output.
    expect(result.transcript[0].output).toContain(fresh.opening.split('\n')[0]);
    expect(result.transcript.map((s) => s.line).slice(1)).toEqual([L('mv Pier/net Harbour/Boathouse'), L('cd Harbour'), L('ls Boathouse'), L('cat nowhere.txt')]);
    expect(fresh.shell.cwd).toBe(c.shell.cwd);
    expect(fresh.execute('ls')).toBe(listing);
    expect(fresh.execute(L('ls Boathouse'))).toContain(L('net'));
    expect(fresh.remote!.shell.commandsInError).toBe(c.remote!.shell.commandsInError);
    expect(fresh.remote!.shell.requestsHints.has(':manual')).toBe(true);
    // The replay is the chapter's new journal: the autosave goes on from there.
    expect(fresh.journal!.length).toBe(6);
    clearAutosave(store, key);
    expect(readAutosave(store, key)).toBeNull();
  });

  it('nano saves and answers are replayed too', () => {
    const d = new Console({ language: 'fr', finished: [...ERASER, 'datacenter', 'second-day'] });
    d.connect(storyMachine('datacenter')!.name);
    d.execute('nano note.txt');
    d.save('premier jet\n');
    d.quitEdition();
    const r = recordOf(d, { exam: false })!;
    const fresh = new Console({ language: 'fr', finished: [...ERASER, 'datacenter', 'second-day'] });
    fresh.connect(storyMachine('datacenter')!.name, d.remote!.shell.chapter);
    expect(resume(fresh, JSON.parse(JSON.stringify(r))).ok).toBe(true);
    expect(fresh.execute('cat note.txt')).toBe('premier jet');
  });

  it('a chapter changed since (another opening, or a replay that ends elsewhere) is detected', () => {
    const c = openChapter('fr', [], 'eraser');
    c.execute(L('cd Pier'));
    const r = recordOf(c, { exam: false })!;
    // Another opening text: the chapter was rewritten.
    expect(resume(openChapter('fr', [], 'eraser', r.chapter), { ...r, opening: hash('another text') })).toEqual({ ok: false, reason: 'changed' });
    // The same inputs, but the machine they led to was another one.
    expect(resume(openChapter('fr', [], 'eraser', r.chapter), { ...r, check: 'deadbeef' })).toEqual({ ok: false, reason: 'changed' });
    // A command that now fails where it succeeded: the errors differ.
    const failing: AutosaveRecord = { ...r, inputs: ['cd nowhere'], n: 1 };
    const f = openChapter('fr', [], 'eraser', r.chapter);
    expect(resume(f, failing).ok).toBe(false);
    // Not the chapter that is open.
    expect(resume(openChapter('fr', [...ERASER], 'datacenter'), r)).toEqual({ ok: false, reason: 'failed' });
  });

  it('nothing to keep once the session left the chapter, nor on the workstation', () => {
    const c = new Console({ language: 'fr', finished: [] });
    expect(recordOf(c, { exam: false })).toBeNull();
    c.execute('ssh royaume');
    c.execute('yes');
    c.execute('ls');
    expect(recordOf(c, { exam: false })!.n).toBe(1);
    c.execute('exit');
    expect(c.journal).toBeNull();
    expect(recordOf(c, { exam: false })).toBeNull();
  });

  it('exam mode keeps when the chapter started (the timer goes on); only then', () => {
    const c = openChapter('fr', [], 'eraser');
    c.execute('ls');
    expect(recordOf(c, { exam: true, examStart: 1234 })!.examStart).toBe(1234);
    expect(recordOf(c, { exam: false, examStart: 1234 })!.examStart).toBeUndefined();
  });

  it('a full storage, a record too long or a broken one: no error, nothing kept', () => {
    const c = openChapter('fr', [], 'eraser');
    c.execute('ls');
    const r = recordOf(c, { exam: false })!;
    const key = autosaveKey('k', 'fr');
    expect(writeAutosave(fakeStorage(true), key, r)).toBe(false);
    expect(writeAutosave(fakeStorage(), key, { ...r, n: AUTOSAVE_MAX_INPUTS + 1 })).toBe(false);
    expect(writeAutosave(fakeStorage(), key, { ...r, inputs: ['x'.repeat(1_100_000)] })).toBe(false);
    const store = fakeStorage();
    store.data.set(key, '{not json');
    expect(readAutosave(store, key)).toBeNull();
    store.data.set(key, JSON.stringify({ ...r, v: 99 }));
    expect(readAutosave(store, key)).toBeNull();
    store.data.set(key, JSON.stringify({ ...r, n: 7 }));
    expect(readAutosave(store, key)).toBeNull();
    const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => {}, removeItem: () => { throw new Error('blocked'); } };
    expect(readAutosave(throwing, key)).toBeNull();
    expect(() => clearAutosave(throwing, key)).not.toThrow();
  });

  it('the fingerprint follows the machine, not the screen', () => {
    const a = openChapter('fr', [], 'eraser');
    const b = openChapter('fr', [], 'eraser');
    b.columns = 40;
    b.colours = true;
    for (const x of [a, b]) x.execute('ls');
    expect(fingerprint(a)).toBe(fingerprint(b));
    a.execute('cd nowhere');
    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });
});
