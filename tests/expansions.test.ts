// The shell's expansions (man bash, "EXPANSION") and its everyday builtins:
// variables a login sets ($HOME, $USER…), the tilde, command substitution
// $(…) and `…`, brace expansion, [...] patterns and patterns in every part of
// a path, history's !$, !^ and !*, true, false, [ … ], type, command,
// printf, echo -e, id -u/-g/-G/-n. Expected outputs from bash 5.2 and
// coreutils 9.4.

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { braces, glob } from '../src/engine/tools';
import { d, f, type Chapter } from '../src/engine/world';

const chapter = (commands = ['ls', 'cd', 'echo', 'cat', 'grep', 'mkdir', 'whoami', 'hostname', 'id', 'wc', 'head']): Chapter => ({
  id: 'expansions-test',
  number: 1,
  commands,
  home: '/home/you',
  welcome: 'notes.txt',
  final: '',
  events: [],
  createWorld: () =>
    d({
      etc: d({ hostname: f('sundial') }, undefined, { owner: 'root' }),
      tmp: d({}),
      home: d({
        you: d({
          'notes.txt': f('alpha\nbeta', { lines: true }),
          w: d({ x: d({}), y: d({}), 'a.log': f(''), 'b.log': f(''), 'c.txt': f('') }),
        }),
      }),
    }),
});

const shell = (commands?: string[]) => {
  const s = new Shell(chapter(commands), 'en');
  s.colours = false;
  return s;
};

describe('Brace expansion and patterns', () => {
  it('expands braces like bash', () => {
    const all = (w: string) => braces(w).join(' ');
    expect(['{a,b,c}', 'x{1..3}', '{01..03}', '{c..a}', '{1..10..3}', 'a{b,c{d,e}}f', '{}', '{x}', '${HOME}'].map(all).join(' ')).toBe(
      'a b c x1 x2 x3 01 02 03 c b a 1 4 7 10 abf acdf acef {} {x} ${HOME}',
    );
  });

  it('reads [...] in patterns', () => {
    expect(glob('[ab]*.log').test('a.log')).toBe(true);
    expect(glob('[!a]*.log').test('a.log')).toBe(false);
    expect(glob('[^a]*.log').test('b.log')).toBe(true);
    expect(glob('[a-c].txt').test('c.txt')).toBe(true);
    expect(glob('[x').test('[x')).toBe(true);
  });

  it('expands patterns in every part of a path, and a final / keeps only places', () => {
    const s = shell();
    expect(s.execute('echo w/[ab]*')).toBe('w/a.log w/b.log');
    // [!a] would be history expansion on an interactive line, as in bash: [^a].
    expect(s.execute('echo w/[^a]*.log')).toBe('w/b.log');
    expect(s.execute('echo w/?.txt')).toBe('w/c.txt');
    expect(s.execute('echo w/*/')).toBe('w/x/ w/y/');
    expect(s.execute('echo */*.txt')).toBe('w/c.txt');
    expect(s.execute('echo w/*.none')).toBe('w/*.none');
    expect(s.execute('echo {a,b}.txt "{a,b}"')).toBe('a.txt b.txt {a,b}');
    s.execute('mkdir -p /tmp/{x,y}/z');
    expect(s.execute('echo /tmp/*/z')).toBe('/tmp/x/z /tmp/y/z');
  });
});

describe('Variables, tilde and command substitution', () => {
  it('a login sets HOME, USER, LOGNAME, SHELL, PATH, PWD, OLDPWD', () => {
    const s = shell();
    expect(s.execute('echo $HOME $USER $LOGNAME $SHELL')).toBe('/home/you you you /bin/bash');
    expect(s.execute('echo $PATH')).toBe('/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games');
    s.execute('cd /tmp');
    expect(s.execute('echo "$PWD" \'$PWD\' ${OLDPWD}')).toBe('/tmp $PWD /home/you');
    expect(s.execute('echo $HOSTNAME $UID')).toBe('sundial 1000');
    // A variable of the session hides the default one.
    s.execute('HOME=/srv');
    expect(s.execute('echo $HOME')).toBe('/srv');
  });

  it('expands ~, ~/…, ~account, but not quoted or unknown', () => {
    const s = shell();
    expect(s.execute("echo ~ ~/x ~root ~nobody '~'")).toBe('/home/you /home/you/x /root ~nobody ~');
    s.execute('cd /tmp');
    expect(s.execute('ls ~/notes.txt')).toBe('/home/you/notes.txt');
  });

  it('$(…) and `…` put a command\'s output in the line', () => {
    const s = shell();
    expect(s.execute('echo $(whoami) `hostname`')).toBe('you sundial');
    expect(s.execute('echo "I am $(id -un), uid $(id -u)"')).toBe('I am you, uid 1000');
    expect(s.execute('ls -d $(echo w)')).toBe('w');
    // Unquoted, the lines become words; quoted, they stay lines.
    expect(s.execute('echo $(cat notes.txt)')).toBe('alpha beta');
    expect(s.execute('echo "$(cat notes.txt)"')).toBe('alpha\nbeta');
    expect(s.execute('echo $(grep -c a notes.txt) lines')).toBe('2 lines');
    // Its errors go to the screen, not into the value; 2>/dev/null hides them.
    expect(s.execute('echo "[$(cat nothere)]"')).toBe('cat: nothere: No such file or directory\n[]');
    expect(s.execute('echo "[$(cat nothere 2>/dev/null)]"')).toBe('[]');
    // An operator in the output stays a word.
    expect(s.execute("echo $(echo 'a | b')")).toBe('a | b');
    expect(s.execute("echo '$(whoami)'")).toBe('$(whoami)');
  });
});

describe('Backslash', () => {
  it('protects the next character, as in bash', () => {
    const s = shell();
    expect(s.execute('echo a\\ b \\* "a\\"b" \\$HOME "\\$HOME" "a\\nb" a\\\\b')).toBe('a b * a"b $HOME $HOME a\\nb a\\b');
  });
});

describe('History: !$, !^, !*', () => {
  it('reuses the previous line\'s words, as typed', () => {
    const s = shell();
    s.execute('ls notes.txt w');
    expect(s.execute('echo !$')).toBe('echo w\nw');
    s.execute('ls notes.txt w');
    expect(s.execute('echo !^')).toBe('echo notes.txt\nnotes.txt');
    s.execute('echo a "b c"');
    expect(s.execute('echo !*')).toBe('echo a "b c"\na b c');
    expect(s.execute('cat !$')).toBe('cat "b c"\ncat: b c: No such file or directory');
  });

  it('an empty history has no word', () => {
    expect(shell().execute('echo !$')).toBe('-bash: !$: event not found');
    const s = shell();
    s.execute('pwd');
    expect(s.execute('echo !^')).toBe('-bash: !^: bad word specifier');
  });
});

describe('Builtins: true, false, [, type, command, printf, echo -e', () => {
  it('true, false and [ … ] in a list, in every chapter', () => {
    const s = shell(['ls']);
    expect(s.execute('true && ls -d w')).toBe('w');
    expect(s.execute('false || ls -d w')).toBe('w');
    expect(s.execute('[ -d w ] && ls -d w')).toBe('w');
    expect(s.execute('[ -f w ] || ls -d w')).toBe('w');
    expect(s.execute('[ -d w && ls')).toBe("-bash: [: missing `]'");
    expect(s.execute('ls -d w; echo $?')).toContain('w');
  });

  it('type and command -v, like bash with Debian\'s aliases', () => {
    const s = shell();
    expect(s.execute('type ls cd if wc')).toBe("ls is aliased to `ls --color=auto'\ncd is a shell builtin\nif is a shell keyword\nwc is /usr/bin/wc");
    expect(s.execute('type nosuch')).toBe('-bash: type: nosuch: not found');
    expect(s.execute('echo $?')).toBe('1');
    expect(s.execute('type -t ls cd wc')).toBe('alias\nbuiltin\nfile');
    expect(s.execute('type -p wc cd')).toBe('/usr/bin/wc');
    expect(s.execute('command -v ls cd wc nosuch')).toBe("alias ls='ls --color=auto'\ncd\n/usr/bin/wc");
    expect(s.execute('command -v nosuch; echo $?')).toBe('1');
    // A command the chapter doesn't have is not there.
    expect(s.execute('type ufw')).toBe('-bash: type: ufw: not found');
    expect(s.execute('command head -n 1 notes.txt')).toBe('alpha');
  });

  it('printf, like bash', () => {
    const s = shell();
    expect(s.execute("printf '%s\\n' a b")).toBe('a\nb');
    expect(s.execute("printf '%5d|%-5s|%05.1f|%x|%o|%c|%%\\n' 42 ab 3.14159 255 8 hello")).toBe('   42|ab   |003.1|ff|10|h|%');
    expect(s.execute("printf '%s-%s\\n' 1 2 3")).toBe('1-2\n3-');
    expect(s.execute("printf 'a\\tb\\n'")).toBe('a\tb');
    expect(s.execute("printf '%b\\n' 'x\\ty'")).toBe('x\ty');
    expect(s.execute("printf '%d\\n' abc")).toBe('-bash: printf: abc: invalid number\n0');
    expect(s.execute('echo $?')).toBe('1');
    expect(s.execute('printf')).toBe('-bash: printf: usage: printf [-v var] format [arguments]');
  });

  it('echo -e, -n, -E', () => {
    const s = shell();
    expect(s.execute("echo -e 'a\\tb\\nc'")).toBe('a\tb\nc');
    expect(s.execute("echo -E 'a\\tb'")).toBe('a\\tb');
    expect(s.execute("echo 'a\\tb'")).toBe('a\\tb');
    expect(s.execute("echo -e 'x\\cy'")).toBe('x');
    expect(s.execute('echo -x')).toBe('-x');
  });

  it('id -u, -g, -G, -n', () => {
    const s = shell();
    expect(s.execute('id -u')).toBe('1000');
    expect(s.execute('id -un')).toBe('you');
    expect(s.execute('id -gn root')).toBe('root');
    expect(s.execute('id -n')).toBe('id: cannot print only names or real IDs in default format');
    expect(s.execute('id -ug')).toBe('id: cannot print "only" of more than one choice');
  });
});
