// od, xxd, hexdump, dd and iconv on raw bytes (an EBCDIC file), compared with
// what the real tools print (coreutils 9, glibc 2.39).
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { byteString, packDecimal, unpackDecimal, encodeEbcdic, decodeEbcdic } from '../src/engine/ebcdic';

const chapter = STORIES.flatMap((s) => s.chapters).find((c) => c.id === 'copybook')!;
const SAMPLE = byteString([...new TextEncoder().encode('Hello, world'), 0, 1, 0xc3, 0x0c, 0x25, ...Array(48).fill(0x41)]);

describe('Bytes', () => {
  const shell = () => {
    const s = new Shell(chapter, 'en');
    s.root.children.tmp = { type: 'directory', children: { 's.bin': { type: 'file', content: SAMPLE, charset: 'binary' } }, mode: 'rwxrwxrwt' };
    return s;
  };
  it('od like coreutils', () => {
    const s = shell();
    expect(s.execute('od -A d -t x1 -c /tmp/s.bin')).toBe(`0000000  48  65  6c  6c  6f  2c  20  77  6f  72  6c  64  00  01  c3  0c
          H   e   l   l   o   ,       w   o   r   l   d  \\0 001 303  \\f
0000016  25  41  41  41  41  41  41  41  41  41  41  41  41  41  41  41
          %   A   A   A   A   A   A   A   A   A   A   A   A   A   A   A
0000032  41  41  41  41  41  41  41  41  41  41  41  41  41  41  41  41
          A   A   A   A   A   A   A   A   A   A   A   A   A   A   A   A
*
0000064  41
          A
0000065`);
    expect(s.execute('od -An -tx1 -N8 -j2 /tmp/s.bin')).toBe(' 6c 6c 6f 2c 20 77 6f 72');
  });
  it('xxd and hexdump -C', () => {
    const s = shell();
    expect(s.execute('xxd -l 12 /tmp/s.bin')).toBe('00000000: 4865 6c6c 6f2c 2077 6f72 6c64            Hello, world');
    expect(s.execute('hexdump -C -n 12 /tmp/s.bin')).toBe('00000000  48 65 6c 6c 6f 2c 20 77  6f 72 6c 64              |Hello, world|\n0000000c');
  });
  it('wc counts raw bytes; dd conv=ebcdic and the packed decimals', () => {
    const s = shell();
    expect(s.execute('wc -c /tmp/s.bin')).toBe('65 /tmp/s.bin');
    expect(s.execute('echo abc | dd conv=ebcdic status=none | od -An -tx1')).toContain('81 82 83');
    expect(packDecimal(4250, 9)).toEqual([0x00, 0x00, 0x04, 0x25, 0x0c]);
    expect(unpackDecimal([0x00, 0x00, 0x04, 0x25, 0x0d])).toBe(-4250);
    expect(unpackDecimal([0x00, 0x9c, 0x0a, 0x0c, 0x0c])).toBeNull();
    expect(decodeEbcdic(encodeEbcdic('HELLO 42'), 'ibm037').text).toBe('HELLO 42');
  });
});
