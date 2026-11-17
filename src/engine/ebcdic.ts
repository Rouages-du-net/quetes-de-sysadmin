// EBCDIC, binary files and packed decimals: what a mainframe's file looks
// like once it lands on Linux (story "The Night Batch").
//
// A binary file of the game (File.charset = 'binary') keeps its bytes in a
// JavaScript string, one character per byte (code 0 to 255): no newline at
// the end, nothing decoded. On the (UTF-8) terminal, its printable ASCII
// bytes show as they are, bytes above 0x7F as � and control bytes not at all.
//
// The tables:
//   - IBM code page 037 (EBCDIC for the USA and Canada, CCSID 37), as
//     glibc's charmaps write it (localedata/charmaps/IBM037 and EBCDIC-US,
//     https://sourceware.org/git/?p=glibc.git;a=tree;f=localedata/charmaps):
//     iconv knows it as IBM037 or CP037; its EBCDIC-US (RFC 1345's
//     table) is the same where it is defined, but leaves 95 byte values out
//     (accented letters, brackets, the cent sign…): "illegal input sequence";
//   - GNU dd's conv=ascii and conv=ebcdic, from coreutils' dd.c (the
//     traditional AT&T tables, which differ from CP037 for a few symbols:
//     https://www.gnu.org/software/coreutils/manual/html_node/dd-invocation.html).
// Packed decimal (COMP-3): two digits per byte, the sign in the last half
// byte (C positive, D negative, F unsigned), as IBM's Enterprise COBOL
// Programming Guide describes it ("Formats for numeric data"), and GnuCOBOL
// stores it the same way (https://gnucobol.sourceforge.io/doc/gnucobol.html).
// It isn't text: any translation table damages it.

const table = (hex: string) => Array.from({ length: 256 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));

/** EBCDIC byte → Unicode code point (IBM-037). */
export const CP037 = table(
  '000102039c09867f978d8e0b0c0d0e0f101112139d8508871819928f1c1d1e1f80818283840a171b88898a8b8c050607909116939495960498999a9b14159e1a20a0e2e4e0e1e3e5e7f1a22e3c282b7c26e9eaebe8edeeefecdf21242a293bac2d2fc2c4c0c1c3c5c7d1a62c255f3e3ff8c9cacbc8cdcecfcc603a2340273d22d8616263646566676869abbbf0fdfeb1b06a6b6c6d6e6f707172aabae6b8c6a4b57e737475767778797aa1bfd0dddeae5ea3a5b7a9a7b6bcbdbe5b5dafa8b4d77b414243444546474849adf4f6f2f3f57d4a4b4c4d4e4f505152b9fbfcf9faff5cf7535455565758595ab2d4d6d2d3d530313233343536373839b3dbdcd9da9f',
);
/** Unicode code point (up to 0xFF) → EBCDIC byte (IBM-037). */
export const TO_CP037: number[] = (() => {
  const r: number[] = Array(256).fill(0x3f);
  CP037.forEach((u, b) => (r[u] = b));
  return r;
})();

/** The bytes glibc's EBCDIC-US (RFC 1345) leaves undefined. */
const EBCDIC_US_HOLES = new Set([
  ...[0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59],
  ...[0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x80],
  ...[0x8a, 0x8b, 0x8c, 0x8d, 0x8e, 0x8f, 0x90, 0x9a, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f, 0xa0, 0xaa, 0xab, 0xac, 0xad],
  ...[0xae, 0xaf, 0xb0, 0xb1, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xbb, 0xbc, 0xbd, 0xbe, 0xbf],
  ...[0xca, 0xcb, 0xcc, 0xcd, 0xce, 0xcf, 0xda, 0xdb, 0xdc, 0xdd, 0xde, 0xdf, 0xe1, 0xea, 0xeb, 0xec, 0xed, 0xee],
  ...[0xef, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe],
]);

/** GNU dd conv=ascii: EBCDIC byte → ASCII byte. */
export const DD_ASCII = table(
  '000102039c09867f978d8e0b0c0d0e0f101112139d8508871819928f1c1d1e1f80818283840a171b88898a8b8c050607909116939495960498999a9b14159e1a20a0a1a2a3a4a5a6a7a8d52e3c282b7c26a9aaabacadaeafb0b121242a293b7e2d2fb2b3b4b5b6b7b8b9cb2c255f3e3fbabbbcbdbebfc0c1c2603a2340273d22c3616263646566676869c4c5c6c7c8c9ca6a6b6c6d6e6f7071725ecccdcecfd0d1e5737475767778797ad2d3d45bd6d7d8d9dadbdcdddedfe0e1e2e3e45de6e77b414243444546474849e8e9eaebeced7d4a4b4c4d4e4f505152eeeff0f1f2f35c9f535455565758595af4f5f6f7f8f930313233343536373839fafbfcfdfeff',
);
/** GNU dd conv=ebcdic: ASCII byte → EBCDIC byte. */
export const DD_EBCDIC = table(
  '00010203372d2e2f1605250b0c0d0e0f101112133c3d322618193f271c1d1e1f405a7f7b5b6c507d4d5d5c4e6b604b61f0f1f2f3f4f5f6f7f8f97a5e4c7e6e6f7cc1c2c3c4c5c6c7c8c9d1d2d3d4d5d6d7d8d9e2e3e4e5e6e7e8e9ade0bd9a6d79818283848586878889919293949596979899a2a3a4a5a6a7a8a9c04fd05f07202122232415061728292a2b2c090a1b30311a333435360838393a3b04143ee14142434445464748495152535455565758596263646566676869707172737475767778808a8b8c8d8e8f906a9b9c9d9e9fa0aaabac4aaeafb0b1b2b3b4b5b6b7b8b9babbbca1bebfcacbcccdcecfdadbdcdddedfeaebecedeeeffafbfcfdfeff',
);

/** The bytes of a binary file's content (one character per byte). */
export const bytesOf = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0) & 0xff);
/** Bytes → the content of a binary file. */
export const byteString = (b: number[]): string => b.map((x) => String.fromCharCode(x)).join('');

/** Does this content need to be kept as bytes (control bytes or bytes above 0x7F)? */
export const isBinary = (s: string) => /[\x00-\x08\x0b-\x1f\x7f-\xff]/.test(s);

/** What a UTF-8 terminal shows of raw bytes: printable ASCII as is, � above 0x7F, control bytes not at all. */
export const binaryOnTerminal = (s: string) =>
  s.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').replace(/[\x80-\xff]/g, '�');

export type Ebcdic = 'ebcdic-us' | 'ibm037';
/** An EBCDIC charset's name as iconv takes it (EBCDIC-US, IBM037, CP037, IBM-037…). */
export function readEbcdic(name: string): Ebcdic | null {
  const n = name.toLowerCase().replace(/\/\/.*$/, '').replace(/[^a-z0-9]/g, '');
  if (n === 'ebcdicus') return 'ebcdic-us';
  if (['ibm037', 'cp037', 'csibm037', 'ebcdiccpus', 'ebcdiccpca', 'ibm37', 'cp37'].includes(n)) return 'ibm037';
  return null;
}

/** EBCDIC bytes → text; `invalid`: the position of the first byte EBCDIC-US doesn't define. */
export function decodeEbcdic(b: number[], charset: Ebcdic): { text: string; invalid?: number } {
  let text = '';
  for (let i = 0; i < b.length; i++) {
    if (charset === 'ebcdic-us' && EBCDIC_US_HOLES.has(b[i])) return { text, invalid: i };
    text += String.fromCharCode(CP037[b[i]]);
  }
  return { text };
}

/** A text (characters up to 0xFF) → EBCDIC bytes (IBM-037). */
export const encodeEbcdic = (text: string): number[] => Array.from(text, (c) => TO_CP037[c.charCodeAt(0) & 0xff]);

/** A number in packed decimal (COMP-3): `digits` digits (odd), in `digits + 1` half bytes, sign last. */
export function packDecimal(value: number, digits: number): number[] {
  const text = String(Math.abs(value)).padStart(digits, '0').slice(-digits) + (value < 0 ? 'd' : 'c');
  const even = text.length % 2 ? `0${text}` : text;
  return Array.from({ length: even.length / 2 }, (_, i) => parseInt(even.slice(i * 2, i * 2 + 2), 16));
}

/** Packed decimal bytes → the number (in its smallest unit), or null if a half byte isn't a digit or a sign. */
export function unpackDecimal(b: number[]): number | null {
  const nibbles = b.flatMap((x) => [x >> 4, x & 0xf]);
  const sign = nibbles.pop()!;
  if (![0xa, 0xb, 0xc, 0xd, 0xe, 0xf].includes(sign) || nibbles.some((n) => n > 9)) return null;
  const value = Number(nibbles.join('') || '0');
  return sign === 0xb || sign === 0xd ? -value : value;
}
