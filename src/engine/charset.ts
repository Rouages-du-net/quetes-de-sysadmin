// Character sets: a few files of the game are written in ISO 8859-1 (LATIN1,
// one byte per character) rather than UTF-8, like the dump of an old
// LATIN1 database. A file's text stays a JavaScript string; its `charset`
// says which bytes it holds on disk. What matters:
//   - on a UTF-8 terminal, a LATIN1 accented letter (one byte, 0x80-0xFF)
//     isn't valid UTF-8: it shows as �;
//   - converting it again (iconv -f LATIN1 on a file already in UTF-8)
//     gives mojibake: e-acute becomes A-tilde + copyright sign;
//   - psql decodes a script's bytes with its SET client_encoding: LATIN1
//     bytes read as UTF-8 are an error, UTF-8 bytes read as LATIN1 are
//     mojibake.
// Sources: https://www.postgresql.org/docs/16/multibyte.html,
// https://man7.org/linux/man-pages/man1/iconv.1.html

/** What a UTF-8 terminal shows of LATIN1 text: each byte above 0x7F is invalid, �. */
export const onUtf8Terminal = (text: string) => text.replace(/[\u0080-\u00ff]/g, '�');

/** The bytes of a text in a charset. */
export function bytes(text: string, charset: 'latin1' | 'utf8'): number[] {
  if (charset === 'latin1') return [...text].map((c) => (c.charCodeAt(0) <= 0xff ? c.charCodeAt(0) : 0x3f));
  return [...new TextEncoder().encode(text)];
}

/** Decodes bytes in a charset: the text, or the first invalid sequence (UTF-8). */
export function decode(b: number[], charset: 'latin1' | 'utf8'): { text: string } | { invalid: number[] } {
  if (charset === 'latin1') return { text: String.fromCharCode(...b) };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(b)) };
  } catch {
    // The first byte that starts an invalid sequence, and the two after it (as PostgreSQL shows them).
    for (let i = 0; i < b.length; i++) {
      const head = b[i];
      if (head < 0x80) continue;
      const need = head >= 0xf0 ? 3 : head >= 0xe0 ? 2 : head >= 0xc0 ? 1 : -1;
      const ok = need > 0 && b.slice(i + 1, i + 1 + need).every((x) => (x & 0xc0) === 0x80) && b.length >= i + 1 + need;
      if (!ok) return { invalid: b.slice(i, i + 3) };
      i += need;
    }
    return { invalid: [] };
  }
}

/** A charset's name as tools write it: LATIN1, ISO-8859-1, iso8859-1 (Solaris), UTF-8, UTF8… */
export function readCharset(name: string): 'latin1' | 'utf8' | null {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['latin1', 'iso88591', 'l1', 'iso885911987'].includes(n)) return 'latin1';
  if (['utf8', 'unicode'].includes(n)) return 'utf8';
  return null;
}

export const hexBytes = (b: number[]) => b.map((x) => `0x${x.toString(16).padStart(2, '0')}`).join(' ');
