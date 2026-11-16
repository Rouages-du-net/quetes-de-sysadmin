// Character sets (src/engine/charset.ts): LATIN1 bytes on a UTF-8 terminal,
// iconv, and the double conversion that makes mojibake.
import { describe, expect, it } from 'vitest';
import { bytes, decode, onUtf8Terminal, readCharset } from '../src/engine/charset';

const crimee = 'Crimée';

describe('charset', () => {
  it('LATIN1 bytes show as � on a UTF-8 terminal', () => {
    expect(onUtf8Terminal(crimee)).toBe('Crim�e');
  });
  it('LATIN1 bytes read as UTF-8 are invalid; UTF-8 bytes read as LATIN1 are mojibake', () => {
    expect(decode(bytes(crimee, 'latin1'), 'utf8')).toEqual({ invalid: [0xe9, 0x65] });
    expect(decode(bytes(crimee, 'utf8'), 'latin1')).toEqual({ text: 'CrimÃ©e' });
    expect(decode(bytes(crimee, 'latin1'), 'latin1')).toEqual({ text: crimee });
  });
  it('knows the names tools use', () => {
    expect(readCharset('ISO-8859-1')).toBe('latin1');
    expect(readCharset('iso8859-1')).toBe('latin1');
    expect(readCharset('UTF-8')).toBe('utf8');
    expect(readCharset('EBCDIC')).toBe(null);
  });
});
