// Command lists on the interactive line, like bash (man bash, "Lists"):
// "a && b", "a || b", "a ; b"; their exit codes ($?), quotes, pipes and
// redirections inside each command, the story's events after each one,
// sudo's password in the middle of a list, the history and the notebook;
// lines run by cron; the highlighting; Windows PowerShell 5.1's refusal of
// && and ||, and cmd.exe's &, && and ||.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';
import { splitList } from '../src/engine/tools';
import { colourise } from '../src/engine/highlighting';
import { note, type Notebook } from '../src/engine/notebook';
import { ledger } from './windows-fixture';

const chapter = (): Chapter => ({
  id: 'lists-test',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'echo', 'cat', 'grep', 'head', 'wc', 'test', 'mkdir', 'touch', 'rm', 'sudo', 'nano', 'history', 'exit'],
  home: '/home/you',
  welcome: 'notes.txt',
  final: 'end',
  password: 'sunflower',
  events: [
    // Each command of a list is checked on its own: this one needs the directory and an ls of it.
    { id: 'listed', condition: (j) => j.exists('/home/you/box') && j.last.commands.length === 1 && j.last.commands[0][0] === 'ls' && j.last.output.includes('apple'), message: 'EVENT listed' },
    { id: 'end', condition: (j) => j.exists('/home/you/box/apple'), message: 'EVENT end' },
  ],
  // Counts the commands that ran (a chapter's clock moving after each one).
  afterCommand: (j) => {
    j.state.after = ((j.state.after as number | undefined) ?? 0) + 1;
  },
  createWorld: () => d({ tmp: d({}), srv: d({}), home: d({ you: d({ 'notes.txt': f('alpha\nbeta\ngamma', { lines: true }) }) }) }),
});

const shell = (language: 'en' | 'fr' = 'en') => new Shell(chapter(), language);

describe('Splitting a line into a list', () => {
  it('at ;, && and || outside quotes, escapes and $(…)', () => {
    const items = (line: string) => {
      const r = splitList(line);
      return 'error' in r ? r : r.items.map((i) => [i.before, i.command.trim()]);
    };
    expect(items('a && b || c ; d')).toEqual([
      [null, 'a'],
      ['&&', 'b'],
      ['||', 'c'],
      [';', 'd'],
    ]);
    expect(items('echo "x && y"; echo \'a;b\'')).toEqual([
      [null, 'echo "x && y"'],
      [';', "echo 'a;b'"],
    ]);
    expect(items('echo a\\;b')).toEqual([[null, 'echo a\\;b']]);
    expect(items('echo $(true && false); ls')).toEqual([
      [null, 'echo $(true && false)'],
      [';', 'ls'],
    ]);
    // A pipe is not ||, a trailing ; is allowed.
    expect(items('cat f | grep x || echo none;')).toEqual([
      [null, 'cat f | grep x'],
      ['||', 'echo none'],
    ]);
    expect(items('; ls')).toEqual({ error: true, token: ';' });
    expect(items('ls && && pwd')).toEqual({ error: true, token: '&&' });
    expect(items('ls ;; pwd')).toEqual({ error: true, token: ';;' });
    expect(items('ls ||')).toEqual({ error: true, token: null });
  });
});

describe('Command lists in the interactive shell', () => {
  it('&& runs the next command only on success, || only on failure, ; always', () => {
    const s = shell();
    expect(s.execute('ls && echo yes')).toBe('notes.txt\nyes');
    expect(s.execute('ls nothere && echo no')).toBe("ls: cannot access 'nothere': No such file or directory");
    expect(s.lastStatus).not.toBe(0);
    expect(s.execute('ls nothere && echo no || echo fallback')).toBe("ls: cannot access 'nothere': No such file or directory\nfallback");
    expect(s.lastStatus).toBe(0);
    expect(s.execute('echo a; echo b ;')).toBe('a\nb');
    expect(s.execute('grep -q delta notes.txt ; echo $?')).toBe('1');
    // && and || have equal precedence, from the left: a skipped command leaves $? as it was.
    expect(s.execute('ls nothere || echo one && echo two')).toContain('one\ntwo');
    expect(s.execute('echo first || echo skipped && echo third')).toBe('first\nthird');
  });

  it('grep -q … || echo, test … && echo, $? after the list', () => {
    const s = shell();
    expect(s.execute('grep -q gamma notes.txt && echo found')).toBe('found');
    expect(s.execute('grep -q delta notes.txt || echo missing')).toBe('missing');
    expect(s.execute('echo $?')).toBe('0');
    expect(s.execute('test -d /srv && echo directory')).toBe('directory');
    expect(s.execute('grep -q delta notes.txt')).toBe('');
    expect(s.execute('echo $?')).toBe('1');
  });

  it('quotes keep their ; and &&; pipes and redirections work inside each command', () => {
    const s = shell();
    expect(s.execute('echo "a && b" ; echo \'x;y\'')).toBe('a && b\nx;y');
    expect(s.execute('cat notes.txt | head -n 1 && echo ok > /tmp/out; cat /tmp/out')).toBe('alpha\nok');
    expect(s.execute('grep a notes.txt | wc -l > /tmp/n && cat /tmp/n')).toBe('3');
  });

  it('cd in a list changes the directory for what follows', () => {
    const s = shell();
    expect(s.execute('cd /tmp; pwd')).toBe('/tmp');
    expect(s.execute('cd /nowhere && pwd')).not.toContain('/tmp\n');
    expect(s.cwd).toBe('/tmp');
  });

  it("bash's syntax errors (exit code 2), in the game's language", () => {
    const s = shell();
    expect(s.execute('; ls')).toBe("syntax error near unexpected token `;'");
    expect(s.lastStatus).toBe(2);
    expect(s.execute('ls && || pwd')).toBe("syntax error near unexpected token `||'");
    // A line that ends on && is not over: bash's secondary prompt, then Ctrl-D.
    expect(s.execute('ls &&')).toBe('');
    expect(s.prompt()).toBe('>');
    expect(s.endOfInput()).toBe('syntax error: unexpected end of file');
    expect(s.prompt()).toBe('you@sysadmin:~$');
    expect(shell('fr').execute('ls ;; pwd')).toBe('erreur de syntaxe près du symbole inattendu « ;; »');
  });

  it("each command is checked by the story's events and afterCommand, as if typed alone", () => {
    const s = shell();
    const output = s.execute('mkdir box && touch box/apple && ls box') ?? '';
    // The final event fires after touch, the other one after ls (its own output).
    expect(output).toContain('EVENT end');
    expect(output).toContain('EVENT listed');
    expect(output.indexOf('EVENT end')).toBeLessThan(output.indexOf('apple'));
    expect(s.finished).toBe(true);
    expect(s.state.after).toBe(3);
    // A skipped command is not run: nothing happens after it.
    s.execute('ls nothere && ls');
    expect(s.state.after).toBe(4);
    // Every command counts for the summary.
    expect(s.typedCommands).toBe(4);
  });

  it('the history keeps the whole line once; the notebook gets every command', () => {
    const s = shell();
    s.execute('mkdir box && touch box/x; ls box');
    expect(s.history).toEqual(['mkdir box && touch box/x; ls box']);
    expect(s.execute('!!')).toContain('mkdir: cannot create directory');
    const notebook: Notebook = {};
    s.execute('pwd && wc -l notes.txt');
    expect(note(notebook, s).sort()).toEqual(['pwd', 'wc']);
    expect(notebook.wc.line).toBe('pwd && wc -l notes.txt');
    // `last` stays the last command's (a list is not a pipe: no "First pipe" achievement).
    expect(s.last.commands).toEqual([['wc', '-l', 'notes.txt']]);
  });

  it("sudo's password in the middle of a list: the rest runs once it is given", () => {
    const s = shell();
    const first = s.execute('mkdir /srv/www; sudo mkdir /srv/site && echo made') ?? '';
    expect(s.waiting).not.toBeNull();
    expect(first).toContain('We trust you have received the usual lecture');
    expect(s.execute('sunflower')).toBe('made');
    expect(s.exists('/srv/site')).toBe(true);
    // Three wrong passwords: sudo fails, the list goes on (|| runs).
    const t = shell();
    t.execute('sudo touch /srv/x || echo refused');
    t.execute('no');
    t.execute('nope');
    expect(t.execute('wrong')).toContain('refused');
  });

  it('exit ends the list: nothing after it runs here', () => {
    const s = shell();
    expect(s.execute('echo bye; exit; echo after')).toBe('bye');
    expect(s.output).toBe(true);
  });

  it('cron and scripts run lists too (sh -c)', () => {
    const s = shell();
    expect(s.runTask('cd /tmp && pwd; ls nothere || echo none')).toBe("/tmp\nls: cannot access 'nothere': No such file or directory\nnone");
    expect(s.cwd).toBe('/home/you');
    const r = s.underCommand('ls nothere; echo end', '/');
    expect(r.code).toBe(0);
    expect(r.output).toContain('end');
  });

  it('highlighting: each command of the list is a command', () => {
    const s = shell();
    const tokens = colourise(s, 'ls -l && pwd; nope || echo "a;b"').filter((x) => x.text.trim());
    expect(tokens.map((x) => [x.text.trim(), x.kind])).toEqual([
      ['ls', 'command'],
      ['-l', 'option'],
      ['&&', 'operator'],
      ['pwd', 'command'],
      [';', 'operator'],
      ['nope', 'unknown'],
      ['||', 'operator'],
      ['echo', 'command'],
      ['"a;b"', 'string'],
    ]);
    expect(colourise(s, 'echo a\\;b').map((x) => x.text).join('')).toBe('echo a\\;b');
  });
});

describe('Lists on Windows', () => {
  it("Windows PowerShell 5.1 refuses && and || (PowerShell 7's pipeline chain operators)", () => {
    const s = ledger();
    const out = s.execute('Get-Date && Get-Date') ?? '';
    expect(out).toBe(
      [
        'At line:1 char:10',
        '+ Get-Date && Get-Date',
        '+          ~~',
        "The token '&&' is not a valid statement separator in this version.",
        '    + CategoryInfo          : ParserError: (:) [], ParentContainsErrorRecordException',
        '    + FullyQualifiedErrorId : InvalidEndOfLine',
        ' ',
      ].join('\n'),
    );
    expect(s.execute('hostname || hostname')).toContain("The token '||' is not a valid statement separator in this version.");
    expect(s.execute("'a && b'; 'c'")).toBe('a && b\nc');
  });

  it("cmd.exe: & always, && on success, || on failure; cmd's own syntax errors", () => {
    const s = ledger();
    s.execute('cmd');
    expect(s.execute('echo one & echo two')).toBe('one\ntwo');
    expect(s.execute('cd C:\\Nowhere && echo no')).toBe('The system cannot find the path specified.');
    expect(s.execute('cd C:\\Nowhere || echo fallback')).toBe('The system cannot find the path specified.\nfallback');
    expect(s.execute('echo "a & b" && ver')).toContain('"a & b"\n\nMicrosoft Windows [Version');
    expect(s.execute('echo a ^& b')).toBe('a & b');
    expect(s.execute('& dir')).toBe('& was unexpected at this time.');
    expect(s.execute('dir &&')).toBe('The syntax of the command is incorrect.');
    // exit in a list leaves cmd: what follows is not run there.
    expect(s.execute('echo bye & exit & echo after')).toBe('bye');
  });
});
