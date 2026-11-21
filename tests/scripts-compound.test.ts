// Scripts run by sh (dash) and bash through the same parser and runner as
// the interactive line (script.ts, compound.ts, control.ts, dialect.ts):
// functions, positional parameters, loops, set -e/-u/-x, pipefail, trap,
// getopts, ".", and each shell's own errors. Every expected output below was
// produced by the real dash 0.5.12 and bash 5.2 on the same scripts
// (stdout and stderr together, LANG=C).
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';
import { parseScript } from '../src/engine/compound';

const SCRIPTS: Record<string, { text: string; args: string[] }> = {
  "functions.sh": { text: "greet() {\n  local who=\"$1\"\n  shift\n  echo \"hello $who ($# more: $*)\"\n  return 3\n}\nwho=outside\ngreet Ada Grace Linus\necho \"code $? who=$who\"\nfor a in \"$@\"; do echo \"[$a]\"; done\ncount() { echo $#; }\ncount \"$@\"\ncount $*\nset -- x \"y z\"\necho \"$# $2\"", args: ["a b", "", "c"] },
  "loops.sh": { text: "i=0\nwhile [ $i -lt 3 ]; do\n  i=$((i + 1))\n  case $i in\n    1) echo one ;;\n    2|3) echo \"two or three: $i\" ;;\n  esac\ndone\nuntil [ $i -eq 0 ]; do i=$((i - 1)); done\necho \"i=$i\"\nfor f in *.txt; do echo \"file $f\"; done\nn=0\nwhile read -r line; do\n  n=$((n + 1))\n  echo \"$n: $line\"\ndone <<EOF\nalpha\nbeta $i\nEOF\nif [ -f notes.txt ] && grep -q beta notes.txt; then echo found; else echo missing; fi", args: [] },
  "errexit.sh": { text: "trap 'echo \"bye $?\"' EXIT\nset -e\nfalse && echo no\nif false; then :; fi\n! true\nf() { false; echo \"in f\"; }\nif f; then echo ok; fi\necho mid\nfalse || false\necho never", args: [] },
  "nounset.sh": { text: "set -u\necho \"x${A:-default}\"\necho \"$B\"\necho after", args: [] },
  "xtrace.sh": { text: "set -x\nX=\"a b\"\necho $X \"c d\" >/dev/null\nf() { echo in; }\nf 1\nfor i in 1; do :; done\n[ -n \"$X\" ]\nY=$(echo hi)\nset +x\necho \"$Y\"", args: [] },
  "bashisms.sh": { text: "echo start\n[[ -n x ]] && echo yes\n[ a == a ] && echo eq\necho \"tab:\\tend\"\necho $'p\\tq'\nsource ./lib.sh\necho \"lib=$LIB\"\nfunction hi {\n  echo in hi\n}\nhi\necho end", args: [] },
  "array.sh": { text: "echo before\nlist=(one two)\necho after", args: [] },
  "fifi.sh": { text: "echo a\nif true; then\n  echo b\nfi fi\necho c", args: [] },
  "quote.sh": { text: "echo start\necho \"open\nnever closed", args: [] },
  "eof.sh": { text: "echo start\nfor x in 1 2; do\n  echo $x", args: [] },
  "getopts.sh": { text: "while getopts ab:c opt; do\n  case $opt in\n    a) echo A ;;\n    b) echo \"B=$OPTARG\" ;;\n    \\?) echo bad ;;\n  esac\ndone\nshift $((OPTIND - 1))\necho \"rest: $*\"", args: ["-a", "-b", "x", "-d", "y", "z"] },
  "dot.sh": { text: ". ./lib.sh\necho \"LIB=$LIB\"\n. lib.sh\necho after", args: [] },
  "codes.sh": { text: "(exit 5)\necho \"sub=$?\"\nnosuch arg\necho \"missing=$?\"\n./nofile\necho \"path=$?\"\n[ 1 -eq 1\necho \"test=$?\"\nf() { return 4; echo no; }\nf\necho \"f=$?\"\nexit 7\necho no", args: [] },
  "pipefail.sh": { text: "false | true\necho \"plain=$?\"\nset -o pipefail\nfalse | true\necho \"pipefail=$?\"", args: [] },
  "shift.sh": { text: "f() { shift 3; echo \"left $#\"; }\nf a b\necho after", args: [] },
  "local.sh": { text: "f() { local v=in; g; echo \"f:$v\"; }\ng() { echo \"g:$v\"; v=changed; }\nv=out\nf\necho \"v=$v\"\nlocal w=1\necho \"local=$?\"\nreturn 2\necho after", args: [] },
};

/** What dash and bash wrote (output and errors), and their exit code. */
const REAL: Record<string, { output: string; code: number }> = {
  "dash functions.sh": { output: "hello Ada (2 more: Grace Linus)\ncode 3 who=outside\n[a b]\n[]\n[c]\n3\n3\n2 y z", code: 0 },
  "bash functions.sh": { output: "hello Ada (2 more: Grace Linus)\ncode 3 who=outside\n[a b]\n[]\n[c]\n3\n3\n2 y z", code: 0 },
  "dash loops.sh": { output: "one\ntwo or three: 2\ntwo or three: 3\ni=0\nfile notes.txt\nfile todo.txt\n1: alpha\n2: beta 0\nfound", code: 0 },
  "bash loops.sh": { output: "one\ntwo or three: 2\ntwo or three: 3\ni=0\nfile notes.txt\nfile todo.txt\n1: alpha\n2: beta 0\nfound", code: 0 },
  "dash errexit.sh": { output: "in f\nok\nmid\nbye 1", code: 1 },
  "bash errexit.sh": { output: "in f\nok\nmid\nbye 1", code: 1 },
  "dash nounset.sh": { output: "xdefault\nnounset.sh: 3: B: parameter not set", code: 2 },
  "bash nounset.sh": { output: "xdefault\nnounset.sh: line 3: B: unbound variable", code: 1 },
  "dash xtrace.sh": { output: "+ X=a b\n+ echo a b c d\n+ f 1\n+ echo in\nin\n+ :\n+ [ -n a b ]\n+ echo hi\n+ Y=hi\n+ set +x\nhi", code: 0 },
  "bash xtrace.sh": { output: "+ X='a b'\n+ echo a b 'c d'\n+ f 1\n+ echo in\nin\n+ for i in 1\n+ :\n+ '[' -n 'a b' ']'\n++ echo hi\n+ Y=hi\n+ set +x\nhi", code: 0 },
  "dash bashisms.sh": { output: "start\nbashisms.sh: 2: [[: not found\nbashisms.sh: 3: [: a: unexpected operator\ntab:\tend\n$p\tq\nbashisms.sh: 6: source: not found\nlib=\nbashisms.sh: 8: function: not found\nin hi\nbashisms.sh: 10: Syntax error: \"}\" unexpected", code: 2 },
  "bash bashisms.sh": { output: "start\nyes\neq\ntab:\\tend\np\tq\nlib=loaded\nin hi\nend", code: 0 },
  "dash array.sh": { output: "before\narray.sh: 2: Syntax error: \"(\" unexpected", code: 2 },
  "dash fifi.sh": { output: "a\nfifi.sh: 4: Syntax error: \"fi\" unexpected", code: 2 },
  "bash fifi.sh": { output: "a\nfifi.sh: line 4: syntax error near unexpected token `fi'\nfifi.sh: line 4: `fi fi'", code: 2 },
  "dash quote.sh": { output: "start\nquote.sh: 4: Syntax error: Unterminated quoted string", code: 2 },
  "bash quote.sh": { output: "start\nquote.sh: line 2: unexpected EOF while looking for matching `\"'", code: 2 },
  "dash eof.sh": { output: "start\neof.sh: 4: Syntax error: end of file unexpected (expecting \"done\")", code: 2 },
  "bash eof.sh": { output: "start\neof.sh: line 4: syntax error: unexpected end of file", code: 2 },
  "dash getopts.sh": { output: "A\nB=x\nIllegal option -d\nbad\nrest: y z", code: 0 },
  "bash getopts.sh": { output: "A\nB=x\ngetopts.sh: illegal option -- d\nbad\nrest: y z", code: 0 },
  "dash dot.sh": { output: "LIB=loaded\ndot.sh: 3: .: lib.sh: not found", code: 2 },
  "bash dot.sh": { output: "LIB=loaded\nafter", code: 0 },
  "dash codes.sh": { output: "sub=5\ncodes.sh: 3: nosuch: not found\nmissing=127\ncodes.sh: 5: ./nofile: not found\npath=127\ncodes.sh: 7: [: missing ]\ntest=2\nf=4", code: 7 },
  "bash codes.sh": { output: "sub=5\ncodes.sh: line 3: nosuch: command not found\nmissing=127\ncodes.sh: line 5: ./nofile: No such file or directory\npath=127\ncodes.sh: line 7: [: missing `]'\ntest=2\nf=4", code: 7 },
  "dash pipefail.sh": { output: "plain=0\npipefail.sh: 3: set: Illegal option -o pipefail", code: 2 },
  "bash pipefail.sh": { output: "plain=0\npipefail=1", code: 0 },
  "dash shift.sh": { output: "shift.sh: 1: shift: can't shift that many", code: 2 },
  "bash shift.sh": { output: "left 2\nafter", code: 0 },
  "dash local.sh": { output: "g:in\nf:changed\nv=out\nlocal.sh: 6: local: not in a function", code: 2 },
  "bash local.sh": { output: "g:in\nf:changed\nv=out\nlocal.sh: line 6: local: can only be used in a function\nlocal=1\nlocal.sh: line 8: return: can only `return' from a function or sourced script\nafter", code: 0 },
};
const CRLF = '#!/bin/bash\r\n# copy\r\nSRC=/srv/projects\r\n\r\ncd $SRC && echo moved\r\necho "done"';

const chapter = (): Chapter => ({
  id: 'scripts-test',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'echo', 'cat', 'grep', 'sh', 'bash', 'test', 'true', 'false', 'chmod', 'export', 'unset', 'printf'],
  home: '/home/you',
  welcome: 'notes.txt',
  final: 'end',
  events: [{ id: 'end', condition: (j) => j.exists('/home/you/never'), message: 'EVENT end' }],
  createWorld: () =>
    d({
      home: d({
        you: d({
          ...Object.fromEntries(Object.entries(SCRIPTS).map(([n, s]) => [n, f(s.text, { lines: true, mode: 'rwxr-xr-x' })])),
          'lib.sh': f('LIB=loaded', { lines: true }),
          'notes.txt': f('alpha\nbeta', { lines: true }),
          'todo.txt': f('x', { lines: true }),
          'crlf.sh': f(CRLF, { lines: true, mode: 'rwxr-xr-x' }),
          'bash-hook': f('#!/bin/bash\n[[ $1 == v* ]] && echo "version $1"', { lines: true, mode: 'rwxr-xr-x' }),
          'sh-hook': f('#!/bin/sh\n[[ $1 == v* ]] && echo "version $1"', { lines: true, mode: 'rwxr-xr-x' }),
          'plain-hook': f('[[ $1 == v* ]] && echo "version $1"', { lines: true, mode: 'rwxr-xr-x' }),
        }),
      }),
    }),
});

const shell = () => new Shell(chapter(), 'en');
const quoted = (a: string) => `'${a.replace(/'/g, "'\\''")}'`;

describe('Scripts, compared with the real dash and bash', () => {
  for (const [key, real] of Object.entries(REAL)) {
    it(key, () => {
      const s = shell();
      const [interpreter, name] = key.split(' ');
      const { args } = SCRIPTS[name];
      const out = s.execute([interpreter === 'dash' ? 'sh' : 'bash', name, ...args.map(quoted)].join(' '));
      expect(out).toBe(real.output);
      expect(s.lastStatus).toBe(real.code);
    });
  }
});

describe('Scripts: the interpreter, the session, the line endings', () => {
  it('the #! line chooses the shell; without one, bash runs the file itself', () => {
    const s = shell();
    expect(s.execute('./bash-hook v2')).toBe('version v2');
    expect(s.execute('./sh-hook v2')).toBe('./sh-hook: 2: [[: not found');
    expect(s.lastStatus).toBe(127);
    expect(s.execute('./plain-hook v2')).toBe('version v2');
    expect(s.execute('sh bash-hook v2')).toBe('bash-hook: 2: [[: not found');
  });

  it('a script is a child: its variables, functions and cd stay inside; it sees what was exported', () => {
    const s = shell();
    s.execute('NAME=session; export SHARED=yes');
    expect(s.execute(`sh -c 'echo "[$NAME] [$SHARED]"; cd /; X=1; f() { :; }'`)).toBe('[] [yes]');
    expect(s.execute('pwd')).toBe('/home/you');
    expect(s.execute('echo "[$X]"; type f')).toContain('[]');
  });

  it('sh -c: the line, then $0 and the arguments; its errors say sh: 1:', () => {
    const s = shell();
    expect(s.execute(`sh -c 'echo "$0 $1 $#"' zero one`)).toBe('zero one 1');
    expect(s.execute(`sh -c 'nosuch'`)).toBe('sh: 1: nosuch: not found');
    expect(s.lastStatus).toBe(127);
    expect(s.execute(`bash -c 'nosuch'`)).toBe('bash: line 1: nosuch: command not found');
    expect(s.execute(`sh -c 'echo a; fi'`)).toBe('sh: 1: Syntax error: "fi" unexpected');
    expect(s.lastStatus).toBe(2);
  });

  it('sh -n reads without running; sh -x traces', () => {
    const s = shell();
    expect(s.execute('sh -n fifi.sh')).toBe('fifi.sh: 4: Syntax error: "fi" unexpected');
    expect(s.execute('sh -n loops.sh')).toBe('');
    expect(s.execute(`sh -x -c 'echo hi'`)).toBe('+ echo hi\nhi');
  });

  it('CR LF: bash shows $\'\\r\', dash the raw carriage return', () => {
    const s = shell();
    expect(s.execute('./crlf.sh')).toContain('-bash: ./crlf.sh: /bin/bash^M: bad interpreter: No such file or directory');
    expect(s.execute('bash crlf.sh')).toBe("crlf.sh: line 4: $'\\r': command not found\ncrlf.sh: line 5: cd: $'/srv/projects\\r': No such file or directory\ndone");
    expect(s.execute('sh crlf.sh')).toBe("crlf.sh: 4: \r: not found\ncrlf.sh: 5: cd: can't cd to /srv/projects\r\ndone");
  });

  it('functions and [[ … ]] on the interactive line too', () => {
    const s = shell();
    expect(s.execute('greet() { echo "hello ${1:-you} ($#)"; }')).toBe('');
    expect(s.execute('greet Ada Grace')).toBe('hello Ada (2)');
    expect(s.execute('greet | cat')).toBe('hello you (0)');
    expect(s.execute('type greet')).toBe('greet is a function');
    expect(s.execute('f=notes.txt; [[ $f == *.txt && -f $f ]] && echo text')).toBe('text');
    expect(s.execute('[[ "a b" == "a b" ]]; echo $?')).toBe('0');
    expect(s.execute('return')).toBe("-bash: return: can only `return' from a function or sourced script");
    expect(s.execute('. ./lib.sh; echo $LIB')).toBe('loaded');
    expect(s.execute('unset -f greet; greet')).toContain('greet');
  });

  it('a script stops at a syntax error, after running the lines before it', () => {
    const p = parseScript('echo a\nif true; then\necho b\nfi fi\necho c', false);
    expect(p.chunks.length).toBe(1);
    expect(p.error).toEqual({ line: 4, token: 'fi' });
  });
});
