// iconv: converts a text from one character set to another (GNU libc's;
// Solaris's takes the same -f/-t). The charsets the game knows: LATIN1
// (ISO 8859-1) and UTF-8 (see ../charset.ts).
// https://man7.org/linux/man-pages/man1/iconv.1.html
// Differences: only those two charsets; no //TRANSLIT nor -c.

import type { Command } from './index';
import { bytes, decode, readCharset } from '../charset';

/** What file(1) says of a node: its type, and for a text its charset (by its bytes, like libmagic). */
function describe(n: import('../world').Node): string {
  if (n.type === 'directory') return 'directory';
  if (n.link) return `symbolic link to ${n.link}`;
  if (n.archive) return n.archive.compressed ? 'gzip compressed data' : 'POSIX tar archive';
  if (n.crypto) return 'PGP armored data';
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
      const files: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-l' || a === '--list') return 'ISO-8859-1, ISO_8859-1, LATIN1, L1, ISO8859-1\nUTF-8, UTF8';
        if (a === '-f') from = args[++i] ?? null;
        else if (a.startsWith('--from-code=')) from = a.slice(12);
        else if (a === '-t') to = args[++i] ?? null;
        else if (a.startsWith('--to-code=')) to = a.slice(10);
        else if (a.startsWith('-') && a !== '-') return game.error(`iconv: invalid option -- '${a.replace(/^-+/, '').charAt(0)}'\nTry 'iconv --help' or 'iconv --usage' for more information.`, 1);
        else files.push(a);
      }
      const src = readCharset(from ?? 'UTF-8');
      const dst = readCharset(to ?? 'UTF-8');
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
        raw = bytes(text, n?.type === 'file' && n.charset === 'latin1' ? 'latin1' : 'utf8');
      } else {
        if (input === null) return '';
        raw = bytes(input, game.outputCharset === 'latin1' ? 'latin1' : 'utf8');
      }
      const decoded = decode(raw, src);
      if ('invalid' in decoded) {
        const position = raw.findIndex((b, i) => b === decoded.invalid[0] && raw.slice(i, i + decoded.invalid.length).join() === decoded.invalid.join());
        return game.error(`iconv: illegal input sequence at position ${Math.max(0, position)}`, 1);
      }
      if (dst === 'latin1') {
        const bad = [...decoded.text].findIndex((c) => c.charCodeAt(0) > 0xff);
        if (bad >= 0) return game.error(`iconv: cannot convert`, 1);
      }
      game.outputCharset = dst === 'latin1' ? 'latin1' : null;
      return decoded.text;
    },
  },
};
