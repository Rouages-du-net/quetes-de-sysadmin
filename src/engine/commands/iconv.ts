// iconv: converts a text from one character set to another (GNU libc's;
// Solaris's takes the same -f/-t). The charsets the game knows: LATIN1
// (ISO 8859-1), UTF-8 (see ../charset.ts), ASCII, and EBCDIC: IBM037 (CP037)
// and glibc's EBCDIC-US, which leaves 95 bytes undefined (see ../ebcdic.ts).
// https://man7.org/linux/man-pages/man1/iconv.1.html
// Differences: only those charsets; no //TRANSLIT; -c drops what can't be
// converted (exit code 0, like glibc 2.39).

import type { Command } from './index';
import type { Shell } from '../shell';
import { bytes, decode, readCharset } from '../charset';
import { bytesOf, byteString, decodeEbcdic, encodeEbcdic, isBinary, readEbcdic, type Ebcdic } from '../ebcdic';
import { systemd } from '../systemd';

type Charset = 'latin1' | 'utf8' | 'ascii' | Ebcdic;
const charsetOf = (name: string): Charset | null => {
  const n = name.toLowerCase().replace(/\/\/.*$/, '').replace(/[^a-z0-9]/g, '');
  if (['ascii', 'usascii', 'ansix341968', 'us', 'iso646us', 'csascii'].includes(n)) return 'ascii';
  return readEbcdic(name) ?? readCharset(name.replace(/\/\/.*$/, ''));
};

/** Writes iconv's or dd's result to a file (-o, of=): bytes kept as they are, a text without its final newline. */
export function saveFile(game: Shell, cmd: string, path: string, text: string, binary: boolean): string | null {
  const kept = binary ? text : text.replace(/\n$/, '');
  const n = game.find(path);
  if (n?.type === 'directory') return `${cmd}: ${path}: Is a directory`;
  if (n) {
    if (!game.traverses(path) || !game.can(n, 'w')) return `${cmd}: ${path}: Permission denied`;
    n.content = kept;
    n.lines = !binary;
    delete n.size;
    if (binary) n.charset = 'binary';
    else delete n.charset;
    n.mtime = systemd(game)?.clock;
    return null;
  }
  const refused = game.place(cmd, path, { type: 'file', content: kept, owner: game.who, lines: !binary, ...(binary ? { charset: 'binary' as const } : {}), mtime: systemd(game)?.clock });
  return refused ? `${cmd}: ${path}: ${game.find(path + '/..') ? 'Permission denied' : 'No such file or directory'}` : null;
}

/** What file(1) says of a node: its type, and for a text its charset (by its bytes, like libmagic). */
function describe(n: import('../world').Node): string {
  if (n.type === 'directory') return 'directory';
  if (n.link) return `symbolic link to ${n.link}`;
  if (n.archive) return n.archive.compressed ? 'gzip compressed data' : 'POSIX tar archive';
  if (n.crypto) return 'PGP armored data';
  if (n.program) return n.program.kind === 'executable'
    ? 'ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 3.2.0, not stripped'
    : 'ELF 64-bit LSB shared object, x86-64, version 1 (SYSV), dynamically linked, not stripped';
  if (n.charset === 'binary') return 'data';
  const text = typeof n.content === 'string' ? n.content : '';
  if (/^\(binary/.test(text) || (!text && n.size)) return 'data';
  if (!text) return 'empty';
  const kind = /^#!\s*\S*sh\b/.test(text) ? 'POSIX shell script, ' : '';
  if (!/[^\x00-\x7f]/.test(text)) return `${kind}ASCII text`;
  return n.charset === 'latin1' ? `${kind}ISO-8859 text` : `${kind}Unicode text, UTF-8 text`;
}

export const ICONV: Record<string, Command> = {
  // file: what a file holds, by looking at its bytes.
  // https://man7.org/linux/man-pages/man1/file.1.html
  file: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const names = args.filter((a) => !a.startsWith('-'));
      if (!names.length) return game.error('Usage: file [-bcdEhikLlNnprsSvzZ0] [--apple] [--extension] [--mime-encoding]\n            [--mime-type] [-e <testname>] [-F <separator>]  [-f <namefile>]\n            [-m <magicfiles>] [-P <parameter=value>] [--exclude-quiet]\n            <file> ...\n       file -C [-m <magicfiles>]\n       file [--help]', 1);
      return names
        .map((name) => {
          const n = game.find(name);
          return `${name}: ${n ? describe(n) : `cannot open \`${name}' (No such file or directory)`}`;
        })
        .join('\n');
    },
  },
  iconv: {
    ownOptions: true,
    launch: ({ args, input, game }) => {
      let from: string | null = null;
      let to: string | null = null;
      let omit = false;
      let output: string | null = null;
      const files: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-l' || a === '--list')
          return 'ANSI_X3.4-1968, ASCII, US-ASCII\nEBCDIC-US\nIBM037, CP037, CSIBM037, EBCDIC-CP-US, EBCDIC-CP-CA\nISO-8859-1, ISO_8859-1, LATIN1, L1, ISO8859-1\nUTF-8, UTF8';
        if (a === '-f') from = args[++i] ?? null;
        else if (a.startsWith('--from-code=')) from = a.slice(12);
        else if (a === '-t') to = args[++i] ?? null;
        else if (a.startsWith('--to-code=')) to = a.slice(10);
        else if (a === '-c') omit = true;
        else if (a === '-o') output = args[++i] ?? null;
        else if (a.startsWith('--output=')) output = a.slice(9);
        else if (a.startsWith('-') && a !== '-') return game.error(`iconv: invalid option -- '${a.replace(/^-+/, '').charAt(0)}'\nTry 'iconv --help' or 'iconv --usage' for more information.`, 1);
        else files.push(a);
      }
      const src = charsetOf(from ?? 'UTF-8');
      const dst = charsetOf(to ?? 'UTF-8');
      if (!src || !dst) {
        const bad = !src ? from : to;
        return game.error(`iconv: conversion ${!src ? 'from' : 'to'} \`${bad}' is not supported\nTry 'iconv --help' or 'iconv --usage' for more information.`, 1);
      }
      // The input's bytes: a file's (with its charset), or what comes through the pipe.
      let raw: number[];
      if (files.length) {
        const n = game.find(files[0]);
        const text = game.readFor('iconv', files[0]);
        if (text === null) return '';
        raw = n?.type === 'file' && n.charset === 'binary' ? bytesOf(text) : bytes(text, n?.type === 'file' && n.charset === 'latin1' ? 'latin1' : 'utf8');
      } else {
        if (input === null) return '';
        raw = game.outputCharset === 'binary' ? bytesOf(input) : bytes(input, game.outputCharset === 'latin1' ? 'latin1' : 'utf8');
      }
      // Decoding then encoding, character by character, in order: the first
      // byte that can't be read, or character that can't be written, stops
      // iconv at its position in the input (unless -c drops it).
      const units: { c: string | null; at: number }[] = [];
      if (src === 'ebcdic-us' || src === 'ibm037') raw.forEach((b, at) => units.push({ c: decodeEbcdic([b], src).invalid === undefined ? decodeEbcdic([b], src).text : null, at }));
      else if (src === 'ascii') raw.forEach((b, at) => units.push({ c: b > 0x7f ? null : String.fromCharCode(b), at }));
      else {
        const decoded = decode(raw, src);
        let valid = raw;
        let bad = -1;
        if ('invalid' in decoded) {
          bad = Math.max(0, raw.findIndex((b, i) => b === decoded.invalid[0] && raw.slice(i, i + decoded.invalid.length).join() === decoded.invalid.join()));
          valid = raw.slice(0, bad);
        }
        const text = 'invalid' in decoded ? (decode(valid, src) as { text: string }).text : decoded.text;
        let at = 0;
        for (const c of text) {
          units.push({ c, at });
          at += src === 'latin1' ? 1 : new TextEncoder().encode(c).length;
        }
        if (bad >= 0) units.push({ c: null, at: bad });
      }
      const fits = (c: string) => {
        const code = c.codePointAt(0)!;
        return dst === 'ascii' ? code <= 0x7f : dst === 'utf8' ? true : code <= 0xff && (dst !== 'ebcdic-us' || decodeEbcdic(encodeEbcdic(c), 'ebcdic-us').invalid === undefined);
      };
      const kept: string[] = [];
      for (const u of units) {
        if (u.c !== null && fits(u.c)) {
          kept.push(u.c);
          continue;
        }
        if (omit) continue;
        // What was converted before the failure is written all the same.
        const done = kept.join('');
        game.outputCharset = dst === 'ascii' && isBinary(done) ? 'binary' : null;
        if (u.c !== null && dst === 'latin1') return game.error('iconv: cannot convert', 1);
        game.error(`iconv: illegal input sequence at position ${u.at}`, 1);
        return dst === 'ebcdic-us' || dst === 'ibm037' ? '' : done;
      }
      const text = kept.join('');
      let result: string;
      let binary = false;
      if (dst === 'ebcdic-us' || dst === 'ibm037') {
        result = byteString(encodeEbcdic(text));
        binary = true;
        game.outputCharset = 'binary';
      } else {
        result = text;
        binary = dst === 'ascii' && isBinary(text);
        game.outputCharset = dst === 'latin1' ? 'latin1' : binary ? 'binary' : null;
      }
      if (output !== null) {
        const refused = saveFile(game, 'iconv', output, result, binary);
        if (refused) return game.error(`iconv: cannot open output file: ${refused.replace(/^.*: /, '')}`, 1);
        if (dst === 'latin1') (game.find(output) as { charset?: string }).charset = 'latin1';
        game.outputCharset = null;
        return '';
      }
      return result;
    },
  },
};
