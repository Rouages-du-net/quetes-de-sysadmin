// Shell control flow on the interactive line, like bash 5.2: for, for ((…)),
// if/elif/else, while/until (and while read from a file or a pipe), case,
// break/continue, { …; } and ( … ), arithmetic $((…)) and ((…)), parameter
// expansion, here-documents, the secondary prompt (PS2) with Ctrl-C and
// Ctrl-D, unset variables expanding to nothing, the story's events after each
// command of a loop, sudo's password in the middle of a loop, the guard
// against endless loops, history, the notebook, highlighting, seq and read.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';
import { parse } from '../src/engine/compound';
import { arithmetic } from '../src/engine/arith';
import { colourise } from '../src/engine/highlighting';
import { note, type Notebook } from '../src/engine/notebook';

const chapter = (): Chapter => ({
  id: 'control-test',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'echo', 'cat', 'grep', 'head', 'wc', 'test', 'mkdir', 'touch', 'rm', 'sudo', 'nano', 'history', 'exit', 'sort'],
  home: '/home/you',
  welcome: 'notes.txt',
  final: 'end',
  password: 'sunflower',
  events: [
    { id: 'box', condition: (j) => j.exists('/home/you/box/b'), message: 'EVENT box' },
    { id: 'end', condition: (j) => j.exists('/home/you/box/c'), message: 'EVENT end' },
  ],
  afterCommand: (j) => {
    j.state.after = ((j.state.after as number | undefined) ?? 0) + 1;
  },
  createWorld: () =>
    d({
      tmp: d({}),
      srv: d({}, undefined, { owner: 'root' }),
      home: d({ you: d({ 'notes.txt': f('alpha\nbeta\ngamma', { lines: true }), 'a.log': f('one'), 'b.log': f('two\nthree', { lines: true }) }) }),
    }),
});

const shell = (language: 'en' | 'fr' = 'en') => new Shell(chapter(), language);
/** Types several lines, as at the keyboard; returns what the last one showed. */
const type = (s: Shell, ...lines: string[]) => lines.map((l) => s.execute(l)).at(-1);

describe('Parsing', () => {
  it('reads compounds, and knows when an input is not over', () => {
    expect('list' in parse('for i in 1 2; do echo $i; done')).toBe(true);
    expect(parse('for i in 1 2; do echo $i')).toEqual({ incomplete: true });
    expect(parse('if true; then')).toEqual({ incomplete: true });
    expect(parse('echo "open')).toEqual({ incomplete: true });
    expect(parse('cat <<EOF\nhello')).toEqual({ incomplete: true });
    expect(parse('ls |')).toEqual({ incomplete: true });
    expect(parse('done')).toEqual({ error: 'done' });
    expect(parse('if true; then fi')).toEqual({ error: 'fi' });
    expect(parse('ls ;; pwd')).toEqual({ error: ';;' });
  });

  it('arithmetic like bash: precedence, assignments, bases, errors', () => {
    const vars: Record<string, string> = { x: '5' };
    const v = { get: (n: string) => vars[n] ?? null, set: (n: string, x: string) => void (vars[n] = x) };
    expect(arithmetic('1 + 2 * 3 ** 2', v)).toBe(19);
    expect(arithmetic('x++ + ++x', v)).toBe(12);
    expect(vars.x).toBe('7');
    expect(arithmetic('0x1F + 010 + 2#101', v)).toBe(44);
    expect(arithmetic('x > 3 ? 10 : 20', v)).toBe(10);
    expect(arithmetic('-7 / 2', v)).toBe(-3);
    expect(() => arithmetic('1/0', v)).toThrow('1/0: division by 0 (error token is "0")');
    expect(() => arithmetic('2 3', v)).toThrow('syntax error in expression (error token is "3")');
  });
});

describe('Control flow on the interactive line', () => {
  it('for over words, wildcards, braces and $(…), the variable kept afterwards', () => {
    const s = shell();
    expect(s.execute('for f in *.log; do echo "== $f"; cat $f; done')).toBe('== a.log\none\n== b.log\ntwo\nthree');
    expect(s.execute('echo $f')).toBe('b.log');
    expect(s.execute('for i in {1..3}; do echo $i; done')).toBe('1\n2\n3');
    expect(s.execute('for w in $(cat notes.txt); do echo "<$w>"; done')).toBe('<alpha>\n<beta>\n<gamma>');
    expect(s.execute('for i in $(seq 2 2 6); do echo $i; done')).toBe('2\n4\n6');
    expect(s.execute('for ((i=0; i<3; i++)); do echo c$i; done | sort -r')).toBe('c2\nc1\nc0');
  });

  it('if, elif, else on an exit code; until; case with alternatives and *', () => {
    const s = shell();
    expect(s.execute('if test -f notes.txt; then echo yes; else echo no; fi')).toBe('yes');
    expect(s.execute('if [ -d nowhere ]; then echo a; elif grep -q beta notes.txt; then echo b; else echo c; fi')).toBe('b');
    expect(s.execute('if false; then echo a; fi; echo $?')).toBe('0');
    expect(s.execute('x=3; until [ $x -le 0 ]; do echo $x; x=$((x-1)); done')).toBe('3\n2\n1');
    expect(s.execute('for w in start stop reload other; do case $w in start|stop) echo "$w: verb";; reload) echo reload;; *) echo "?";; esac; done')).toBe(
      'start: verb\nstop: verb\nreload\n?',
    );
  });

  it('while read through a file and a pipe; the pipe runs in a subshell', () => {
    const s = shell();
    expect(s.execute('n=0; while read -r line; do n=$((n+1)); echo "$n $line"; done < notes.txt; echo total $n')).toBe('1 alpha\n2 beta\n3 gamma\ntotal 3');
    expect(s.execute('m=0; cat notes.txt | while read l; do m=1; echo "[$l]"; done; echo m=$m')).toBe('[alpha]\n[beta]\n[gamma]\nm=0');
    expect(s.execute('read a b <<< "one two three"; echo "$a|$b"')).toBe('one|two three');
    // On its own, read asks the keyboard.
    expect(s.execute('read -p "Name? " name')).toBe('');
    expect(s.prompt()).toBe('Name? ');
    s.execute('Ada');
    expect(s.execute('echo $name')).toBe('Ada');
  });

  it('break, continue (with a count), ( … ) and { …; }', () => {
    const s = shell();
    expect(s.execute('i=0; while true; do i=$((i+1)); [ $i -gt 3 ] && break; echo $i; done')).toBe('1\n2\n3');
    expect(s.execute('for i in 1 2 3; do for j in a b; do [ $j = b ] && continue 2; echo $i$j; done; done')).toBe('1a\n2a\n3a');
    expect(s.execute('break')).toBe("-bash: break: only meaningful in a `for', `while', or `until' loop");
    expect(s.execute('(cd /tmp; pwd); pwd')).toBe('/tmp\n/home/you');
    expect(s.execute('{ cd /tmp; pwd; }; pwd')).toBe('/tmp\n/tmp');
  });

  it('arithmetic and parameter expansion; an unset variable is empty; an expansion error drops the line', () => {
    const s = shell();
    expect(s.execute('echo "[$NOTHING]" $NOTHING.')).toBe('[] .');
    expect(s.execute('x=7; echo $((x*2+1)) $((x%3)); ((x > 5)) && echo big')).toBe('15 1\nbig');
    s.execute('file=/var/log/nginx/access.log.1');
    expect(s.execute('echo ${#file} ${file##*/} ${file%.*} ${file#/var} ${file%%.*} ${file/log/LOG} ${file//log/LOG}')).toBe(
      '27 access.log.1 /var/log/nginx/access.log /log/nginx/access.log.1 /var/log/nginx/access /var/LOG/nginx/access.log.1 /var/LOG/nginx/access.LOG.1',
    );
    expect(s.execute('echo ${UNSET:-default} ${UNSET:+alt} ${NEW:=set} $NEW ${file:5:3} ${file^^}')).toBe('default set set log /VAR/LOG/NGINX/ACCESS.LOG.1');
    expect(s.execute('echo $((1/0)); echo after')).toBe('-bash: 1/0: division by 0 (error token is "0")');
    expect(s.lastStatus).toBe(1);
    expect(s.execute('echo ${MISSING:?not set}')).toBe('-bash: MISSING: not set');
    expect(s.execute('echo $0 $# $1.')).toBe('-bash 0 .');
  });

  it('here-documents: expanded, quoted, <<- strips tabs; over several lines with PS2', () => {
    const s = shell();
    expect(type(s, 'cat <<EOF', 'Hello $USER', 'sum: $((1+1))', 'EOF')).toBe('Hello you\nsum: 2');
    expect(type(s, "cat <<'EOF'", 'raw $USER', 'EOF')).toBe('raw $USER');
    expect(type(s, 'cat <<-END > /tmp/out', '\tindented', '\tEND')).toBe('');
    expect(s.read('/tmp/out')).toBe('indented');
    expect(s.history.at(-1)).toBe('cat <<-END > /tmp/out\n\tindented\n\tEND');
  });

  it('the secondary prompt: an open compound, quote or && reads on; Ctrl-C drops it, Ctrl-D ends it', () => {
    const s = shell();
    expect(s.execute('for i in 1 2')).toBe('');
    expect(s.prompt()).toBe('>');
    expect(s.execute('do')).toBe('');
    expect(s.execute('echo $i')).toBe('');
    expect(s.execute('done')).toBe('1\n2');
    expect(s.prompt()).toBe('you@sysadmin:~$');
    // bash keeps the input as one line in its history (cmdhist).
    expect(s.history.at(-1)).toBe('for i in 1 2; do echo $i; done');
    s.execute('echo "open');
    expect(s.dropInput()).toBe(true);
    expect(s.prompt()).toBe('you@sysadmin:~$');
    s.execute('if true; then');
    expect(s.execute('\u0004')).toBe('syntax error: unexpected end of file');
    expect(s.lastStatus).toBe(2);
    expect(type(s, 'cat <<EOF', 'body')).toBe('');
    expect(s.execute('\u0004')).toBe("warning: here-document at line 2 delimited by end-of-file (wanted `EOF')\nbody");
  });

  it('each command of a loop is checked by the events and afterCommand, but counted once for the summary', () => {
    const s = shell();
    const output = s.execute('mkdir box; for n in a b c; do touch box/$n; done') ?? '';
    expect(output).toContain('EVENT box');
    expect(output).toContain('EVENT end');
    expect(output.indexOf('EVENT box')).toBeLessThan(output.indexOf('EVENT end'));
    expect(s.state.after).toBe(4);
    expect(s.finished).toBe(true);
    expect(s.typedCommands).toBe(2);
    const notebook: Notebook = {};
    expect(note(notebook, s)).toEqual(['mkdir', 'touch']);
    expect(notebook.touch.line).toBe('mkdir box; for n in a b c; do touch box/$n; done');
  });

  it("sudo's password pauses a loop, which goes on once it is given", () => {
    const s = shell();
    s.execute('for n in 1 2; do sudo touch /srv/f$n; echo done $n; done');
    expect(s.prompt()).toContain('password');
    expect(s.execute('sunflower')).toBe('done 1\ndone 2');
    expect(s.exists('/srv/f1') && s.exists('/srv/f2')).toBe(true);
  });

  it('a loop that never ends is stopped by the game, with a message in the language', () => {
    const s = shell('fr');
    const output = s.execute('while true; do :; done') ?? '';
    expect(output).toContain('Le jeu a arrêté cette boucle après 10');
    expect(s.prompt()).toBe('you@sysadmin:~$');
  });

  it('syntax errors in the language, exit code 2', () => {
    expect(shell('fr').execute('done')).toBe('erreur de syntaxe près du symbole inattendu « done »');
    const s = shell();
    expect(s.execute('if true; then fi')).toBe("syntax error near unexpected token `fi'");
    expect(s.lastStatus).toBe(2);
  });

  it('seq like GNU coreutils', () => {
    const s = shell();
    expect(s.execute('seq 3')).toBe('1\n2\n3');
    expect(s.execute('seq -w 8 10')).toBe('08\n09\n10');
    expect(s.execute('seq -s, 1 2 7')).toBe('1,3,5,7');
    expect(s.execute('seq 0.5 0.5 1.5')).toBe('0.5\n1.0\n1.5');
    expect(s.execute('seq')).toBe("seq: missing operand\nTry 'seq --help' for more information.");
    expect(s.execute('seq x')).toContain("seq: invalid floating point argument: 'x'");
  });

  it('highlights the reserved words', () => {
    const s = shell();
    const kinds = colourise(s, 'for f in *.log; do cat $f; done')
      .filter((t) => t.kind !== 'text' || t.text.trim())
      .map((t) => `${t.kind}:${t.text.trim()}`);
    expect(kinds).toEqual(['keyword:for', 'text:f', 'keyword:in', 'glob:*.log', 'operator:;', 'keyword:do', 'command:cat', 'text:$f', 'operator:;', 'keyword:done']);
    expect(colourise(s, 'if grep -q x f; then').find((t) => t.text === 'then')?.kind).toBe('keyword');
  });
});
