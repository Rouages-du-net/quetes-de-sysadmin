// base64 (GNU coreutils: encode, -d, -w): a Kubernetes Secret's values, a
// forge's tokens. https://www.gnu.org/software/coreutils/manual/html_node/base64-invocation.html

import type { Command } from './index';
import { base64Decode, base64Encode } from '../base64';

export const BASE64: Record<string, Command> = {
  base64: {
    ownOptions: true,
    launch: ({ args, game, input }) => {
      let decode = false;
      let wrap = 76;
      const files: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-d' || a === '--decode') decode = true;
        else if (a === '-w' || a === '--wrap') wrap = Number(args[++i] ?? 76);
        else if (a.startsWith('--wrap=')) wrap = Number(a.slice(7));
        else if (/^-w\d+$/.test(a)) wrap = Number(a.slice(2));
        else if (a === '-i' || a === '--ignore-garbage') continue;
        else if (a.startsWith('-') && a !== '-') return game.error(`base64: invalid option -- '${a.replace(/^-+/, '')[0]}'\nTry 'base64 --help' for more information.`, 1);
        else files.push(a);
      }
      if (files.length > 1) return game.error(`base64: extra operand '${files[1]}'\nTry 'base64 --help' for more information.`, 1);
      let text: string | null = input ?? '';
      if (files.length && files[0] !== '-') {
        text = game.readFor('base64', files[0]);
        if (text === null) return '';
        text += '\n';
      }
      if (decode) {
        const clean = text.replace(/\s/g, '');
        const v = base64Decode(clean);
        if (v === null) return game.error('base64: invalid input', 1);
        return v.replace(/\n$/, '');
      }
      // A pipe's input ends with its newline (echo adds one, not echo -n): it is encoded too, like the real one.
      const noNewline = /\becho\s+-n\b[^|]*\|\s*base64\b/.test(game.commandLine);
      const enc = base64Encode(input !== null && !files.length && !noNewline ? text + (text.endsWith('\n') ? '' : '\n') : text);
      if (!wrap) return enc;
      return enc.match(new RegExp(`.{1,${wrap}}`, 'g'))?.join('\n') ?? '';
    },
  },
};
