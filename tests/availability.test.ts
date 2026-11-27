// The commands a chapter has: its own, and those of the chapters it assumes
// that exist on its machine (see src/engine/availability.ts).
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { assumed } from '../src/engine/unlocking';
import { EVERYDAY, everydayHere, inherited, inheritedHere, installed } from '../src/engine/availability';
import { allSheets } from '../src/engine/sheets';
import { colourise } from '../src/engine/highlighting';
import { COMMANDS } from '../src/engine/commands';
import type { Chapter } from '../src/engine/world';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const storyOf = (id: string) => STORIES.find((s) => s.chapters.some((c) => c.id === id))!;
const shell = (c: Chapter | string) => new Shell(typeof c === 'string' ? chapter(c) : c, 'en');

describe('Commands inherited from the chapters a chapter assumes', () => {
  it('a chapter keeps the commands of its story’s earlier chapters and of its prerequisites', () => {
    // The Neighbourhood Letters open after The Lost Package: its commands come along.
    const c = chapter('shut-the-door');
    const fromPackage = chapter('lost-packet').commands.filter((x) => !c.commands.includes(x));
    expect(fromPackage.length).toBeGreaterThan(0);
    const s = shell(c);
    for (const x of fromPackage) expect(s.known()).toContain(x);
    // And within a story: what the first chapter taught, the second still has.
    const second = chapter('second-day');
    const fromFirst = chapter('first-day').commands.filter((x) => !second.commands.includes(x));
    expect(fromFirst.length).toBeGreaterThan(0);
    for (const x of fromFirst) expect(shell(second).known()).toContain(x);
  });

  it('it depends only on the chapter: the assumed chapters are those of difficulty.ts', () => {
    for (const s of STORIES)
      for (const c of s.chapters) {
        const sources = new Set(assumed(c.id).flatMap((id) => chapter(id).commands));
        for (const x of inherited(c)) expect(sources.has(x)).toBe(true);
        for (const x of inherited(c)) expect(c.commands).not.toContain(x);
      }
  });

  it('a command of a chapter it does not assume is still not learned', () => {
    // The Data Centre's first day assumes only The Eraser: The Pool's kubectl is not there yet.
    const s = shell('first-day');
    expect(assumed('first-day')).not.toContain('wont-start');
    expect(s.known()).not.toContain('kubectl');
    expect(s.execute('kubectl get pods')).toContain("kubectl: you don't have this command yet in this chapter");
    // Nor a command of a sibling story (Archives opens after the same chapter, root).
    const tar = shell('lost-packet');
    if (!chapter('lost-packet').commands.includes('tar')) expect(tar.execute('tar --version')).toContain("you don't have this command yet");
  });

  it('help lists the chapter’s own commands, then the inherited ones', () => {
    const s = shell('second-day');
    const out = s.execute('help') ?? '';
    const [own, kept] = out.split('\n');
    expect(own).toMatch(/^Known commands: /);
    expect(kept).toMatch(/^Learned in earlier chapters: /);
    for (const x of chapter('second-day').commands) expect(kept).not.toMatch(new RegExp(`[ ,]${x}(,|\\.$)`));
    expect(new Shell(chapter('second-day'), 'fr').execute('aide')).toContain('Apprises dans les chapitres précédents : ');
    // The first chapter has nothing before it.
    expect(shell('lighthouse').execute('help')).not.toContain('Learned in earlier chapters');
  });

  it('Tab completion, highlighting, type and man follow the inherited commands', () => {
    const c = chapter('shut-the-door');
    const x = chapter('lost-packet').commands.find((n) => !c.commands.includes(n) && n.length > 3)!;
    const s = shell(c);
    expect(s.complete(x.slice(0, -1))).toContain(x);
    expect(colourise(s, x)[0].kind).toBe('command');
    expect(s.execute(`type ${x}`)).toContain(`${x} is`);
    expect(s.execute(`man ${x}`)).not.toContain("You don't have this command yet");
  });

  it('the teachers’ sheets and the hints keep only the chapter’s own new commands', () => {
    for (const f of allSheets()) for (const x of f.fresh) expect(f.chapter.commands).toContain(x);
  });

  it('sudo comes with the chapter’s password', () => {
    // The Eraser's last chapter gives no password: sudo, learned in "root", stays out.
    const c = chapter('backup');
    expect(c.password).toBeUndefined();
    expect(assumed('backup')).toContain('root');
    expect(inherited(c)).not.toContain('sudo');
    expect(shell(c).execute('sudo ls')).toContain("you don't have this command yet");
  });

  it('withhold keeps a command gated although the chapter assumes it', () => {
    const c = chapter('second-day');
    const x = inherited(c).find((n) => n !== 'sudo')!;
    expect(shell(c).known()).toContain(x);
    const strict: Chapter = { ...c, withhold: [x] };
    const s = shell(strict);
    expect(s.known()).not.toContain(x);
    expect(s.execute(`${x} --help`)).toContain("you don't have this command yet");
  });
});

describe('The everyday commands', () => {
  it('a chapter has them although no chapter it assumes teaches them', () => {
    // The first chapter assumes nothing: ps, df, whoami… are there all the same.
    const c = chapter('lighthouse');
    expect(assumed('lighthouse')).toEqual([]);
    const s = shell(c);
    for (const x of ['ps', 'df', 'free', 'uptime', 'whoami', 'id', 'date', 'hostname', 'uname', 'which']) {
      expect(c.commands).not.toContain(x);
      expect(s.known()).toContain(x);
    }
    expect(s.execute('whoami')).toBe('you');
    expect(s.execute('ps')).not.toContain("you don't have this command yet");
    // help lists them with the chapter's own commands, not as learned earlier.
    expect(s.execute('help')).toContain('whoami');
    expect(s.execute('help')).not.toContain('Learned in earlier chapters');
  });

  it('only the basic ones: a tool to learn stays not learned', () => {
    const s = shell('lighthouse');
    for (const x of ['kill', 'find', 'grep', 'tar', 'chmod', 'systemctl']) if (!chapter('lighthouse').commands.includes(x)) expect(s.known()).not.toContain(x);
  });

  it('a chapter that teaches one keeps it as its own, and the sheets keep only own new commands', () => {
    const teaching = STORIES.flatMap((h) => h.chapters).find((c) => c.commands.includes('ps'))!;
    expect(shell(teaching).known()).toContain('ps');
    for (const f of allSheets()) for (const x of f.fresh) expect(f.chapter.commands).toContain(x);
  });

  it('withhold still keeps one out', () => {
    const strict: Chapter = { ...chapter('lighthouse'), withhold: ['ps'] };
    const s = shell(strict);
    expect(s.known()).not.toContain('ps');
    expect(s.execute('ps')).toContain("you don't have this command yet");
  });

  it('only where the machine’s system has them', () => {
    // Windows has none of the Unix ones.
    const s = shell('service-logon');
    expect(everydayHere(s, chapter('service-logon')).filter((x) => !COMMANDS[x]?.winexe && !COMMANDS[x]?.cmdlet)).toEqual([]);
    // FreeBSD has the POSIX ones.
    const bsd = shell('rc-services');
    expect(everydayHere(bsd, chapter('rc-services'))).toEqual(expect.arrayContaining(['ps', 'df', 'id', 'date', 'uname']));
  });

  it('none of them breaks on any chapter’s machine', () => {
    for (const story of STORIES)
      for (const c of story.chapters) {
        const s = shell(c);
        for (const x of everydayHere(s, c)) expect(() => s.execute(x), `${c.id}: ${x}`).not.toThrow();
      }
    expect(EVERYDAY.length).toBeLessThan(20);
  }, 120_000);
});

describe('Inherited commands exist on the machine, as its system has them', () => {
  it('FreeBSD: POSIX utilities come along, Debian’s tools answer "not found"', () => {
    const c = chapter('rc-services');
    const s = shell(c);
    expect(s.state.os).toBe('freebsd');
    expect(inherited(c)).toContain('git');
    expect(s.known()).not.toContain('git');
    expect(s.execute('git status')).toBe('git: not found');
    expect(s.lastStatus).toBe(127);
    // systemctl too, as before (LINUX_ONLY).
    expect(s.execute('systemctl status')).toMatch(/^systemctl: not found/);
    // mv is a POSIX utility: FreeBSD has it.
    if (!c.commands.includes('mv')) expect(s.known()).toContain('mv');
  });

  it('Solaris: neither Debian’s nor FreeBSD’s tools', () => {
    const c = chapter('byte-order');
    const s = shell(c);
    expect(s.state.os).toBe('solaris');
    expect(inherited(c)).toEqual(expect.arrayContaining(['restic', 'pkg']));
    expect(s.execute('restic snapshots')).toBe('restic: not found');
    expect(s.execute('pkg info')).toBe('pkg: not found');
    if (!c.commands.includes('rm')) expect(s.known()).toContain('rm');
  });

  it('Debian after Solaris: svcs and zfs are not there', () => {
    const c = chapter('copybook');
    const s = shell(c);
    expect(inherited(c)).toEqual(expect.arrayContaining(['svcs', 'zfs']));
    expect(s.known()).not.toContain('svcs');
    expect(s.execute('svcs -a')).toBe('-bash: svcs: command not found');
    expect(s.lastStatus).toBe(127);
  });

  it('IBM i: PASE has no Debian tools, CL stays in CL', () => {
    const c = chapter('spooled');
    const s = shell(c);
    expect(s.state.os).toBe('ibmi');
    expect(inherited(c)).toContain('psql');
    expect(s.execute('psql -l')).toBe('-bash: psql: command not found');
    for (const x of inheritedHere(s, c)) expect(COMMANDS[x]?.cmdlet || COMMANDS[x]?.winexe).toBeFalsy();
  });

  it('Windows: no Linux command, the cmdlets of the story’s earlier chapters', () => {
    const c = chapter('service-logon');
    const s = shell(c);
    expect(s.state.os).toBe('windows');
    const here = inheritedHere(s, c);
    expect(inherited(c)).toContain('ls');
    expect(here).not.toContain('ls');
    expect(here.some((x) => COMMANDS[x]?.cmdlet || COMMANDS[x]?.winexe)).toBe(true);
    // A Debian machine would not inherit cmdlets.
    const pool = shell('wont-start');
    for (const x of inheritedHere(pool, chapter('wont-start'))) expect(COMMANDS[x]?.cmdlet || COMMANDS[x]?.winexe || COMMANDS[x]?.cl).toBeFalsy();
  });

  it('an internal host that lists its programs inherits nothing', () => {
    const s = shell('smb-mount');
    const cabinet = s.internal('cabinet')!;
    expect(cabinet.state.os).toBe('windows');
    const own = chapter('smb-mount').hosts!.cabinet.commands!;
    const fromStory = [...chapter('smb-mount').commands, ...inherited(chapter('smb-mount'))].filter((x) => !own.includes(x) && !shell({ ...chapter('lighthouse'), commands: [] }).known().includes(x));
    expect(fromStory.length).toBeGreaterThan(0);
    for (const x of fromStory) expect(cabinet.known()).not.toContain(x);
  });

  it('a tool the machine has no model for is not installed', () => {
    // The Pool's k3s server has no Docker: docker, learned in The Fablab, is not found.
    const c = chapter('wont-start');
    const s = shell(c);
    expect(inherited(c)).toContain('docker');
    expect(installed(s, 'docker')).toBe(false);
    expect(s.execute('docker ps')).toBe('-bash: docker: command not found');
    expect(s.execute('type docker')).toContain('not found');
    // Where its model is, it is there.
    s.state.docker = { images: [], containers: [], volumes: [], next: 1 };
    expect(installed(s, 'docker')).toBe(true);
    expect(s.known()).toContain('docker');
  });
});

describe('No inherited command breaks on a machine that lacks its model', () => {
  for (const story of STORIES)
    it(story.id, () => {
      for (const c of story.chapters) {
        let s = shell(c);
        const os = s.state.os;
        for (const x of inheritedHere(s, c)) {
          if (['reboot', 'shutdown', 'poweroff', 'halt'].includes(x)) continue;
          for (const line of [x, `${x} --help`, `${x} --version`]) {
            expect(() => s.execute(line), `${c.id}: ${line}`).not.toThrow();
            // A question, a password, the editor or another session: start again from a fresh machine.
            if (s.maskedInput() || s.question || s.state.os !== os) s = shell(c);
          }
        }
      }
    }, 60_000);
  it('every story is covered', () => expect(storyOf('wont-start').id).toBe('pool'));
});
