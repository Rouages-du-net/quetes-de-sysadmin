// awk : les tournures courantes des administrateur·rices, sur un journal web.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';

const LOG = [
  '198.51.100.23 - - [27/Mar/2027:20:00:01 +0100] "GET /agenda/ateliers?page=1 HTTP/1.1" 502 157 "-" "Aspirateur/2.1"',
  '203.0.113.7 - - [27/Mar/2027:20:00:02 +0100] "GET /agenda/ HTTP/1.1" 200 612 "-" "Mozilla/5.0"',
  '198.51.100.23 - - [27/Mar/2027:20:00:02 +0100] "GET /agenda/ateliers?page=2 HTTP/1.1" 502 157 "-" "Aspirateur/2.1"',
  '203.0.113.9 - - [27/Mar/2027:20:00:03 +0100] "GET / HTTP/1.1" 200 1024 "-" "Mozilla/5.0"',
].join('\n');

const chapter: Chapter = {
  id: 'essai-awk',
  number: 1,
  commands: ['awk', 'sort', 'uniq', 'cat', 'head'],
  home: '/home/vous',
  welcome: 'access.log',
  final: '',
  events: [],
  createWorld: () => d({ home: d({ vous: d({ 'access.log': f(LOG, { lines: true }) }) }) }),
};

describe('awk', () => {
  const s = new Shell(chapter, 'fr');
  const awk = (line: string) => s.execute(line);
  it('champs et motifs', () => {
    expect(awk("awk '{print $1}' access.log")).toBe('198.51.100.23\n203.0.113.7\n198.51.100.23\n203.0.113.9');
    expect(awk("awk '$9 == 502 {print $7}' access.log")).toBe('/agenda/ateliers?page=1\n/agenda/ateliers?page=2');
    expect(awk('awk \'$7 ~ /^\\/agenda/ && $9 < 500 {print NR": "$1}\' access.log')).toBe('2: 203.0.113.7');
    expect(awk("awk '/Mozilla/' access.log | awk '{print $NF}'")).toBe('"Mozilla/5.0"\n"Mozilla/5.0"');
  });
  it('tableaux, END, printf, -F', () => {
    expect(awk("awk '{c[$9]++} END {for (k in c) print c[k], k}' access.log | sort")).toBe('2 200\n2 502');
    expect(awk("awk '{s += $10} END {print s}' access.log")).toBe('1950');
    expect(awk('awk \'{printf "%-15s %5d\\n", $1, $10}\' access.log | head -n 1')).toBe('198.51.100.23     157');
    expect(awk("awk -F'\"' '{print $6}' access.log | sort | uniq -c")).toBe('      2 Aspirateur/2.1\n      2 Mozilla/5.0');
    expect(awk('awk \'BEGIN {x = 3; y = x * 2 + 1; print y, length("abc"), toupper("ok"), substr("bonjour", 4)}\'')).toBe('7 3 OK jour');
  });
  it('erreurs de syntaxe à la façon de mawk', () => {
    s.execute("awk '{print $1' access.log");
    expect(s.last.errors[0]).toMatch(/^awk: line 1: syntax error at or near/);
  });
});
