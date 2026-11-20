// cobc, GnuCOBOL's compiler (Debian's gnucobol3 package, 3.1.2): see
// ../cobol.ts for what it checks and builds. Options after "cobc --help"
// and the manual (https://gnucobol.sourceforge.io/doc/gnucobol.html):
// -x (an executable), -m (a module, the default: NAME.so), -c (an object
// file), -o, -I (where COPY looks), -free / -F and -fixed.
// Differences: warnings, -std= and the other -f options are accepted and
// ignored; no -j (run after compiling) nor cobcrun.

import type { Command } from './index';
import type { Node } from '../world';
import { compile, type Program } from '../cobol';
import { content } from '../tools';
import { systemd } from '../systemd';

const VERSION = `cobc (GnuCOBOL) 3.1.2.0
Copyright (C) 2020 Free Software Foundation, Inc.
License GPLv3+: GNU GPL version 3 or later <https://gnu.org/licenses/gpl.html>
This is free software; see the source for copying conditions.  There is NO
warranty; to the extent permitted by law.
Written by Keisuke Nishida, Roger While, Ron Norman, Simon Sobisch, Edward Hart
Built     Dec 22 2020 19:13:51
Packaged  Dec 23 2020 12:04:58 UTC
C version "10.2.1 20201224"`;

export const COBOL: Record<string, Command> = {
  cobc: {
    ownOptions: true,
    launch: ({ args, game }) => {
      let kind: Program['kind'] | 'object' = 'module';
      let free = false;
      let output: string | null = null;
      const dirs: string[] = [];
      const sources: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--version' || a === '-V' || a === '-version') return VERSION;
        if (a === '-x' || a === '--x') kind = 'executable';
        else if (a === '-m' || a === '--m') kind = 'module';
        else if (a === '-c') kind = 'object';
        else if (a === '-free' || a === '--free' || a === '-F') free = true;
        else if (a === '-fixed' || a === '--fixed') free = false;
        else if (a === '-o') output = args[++i] ?? null;
        else if (a.startsWith('-o') && a.length > 2) output = a.slice(2);
        else if (a.startsWith('--output=')) output = a.slice(9);
        else if (a === '-I') dirs.push(game.resolve(args[++i] ?? '.'));
        else if (a.startsWith('-I')) dirs.push(game.resolve(a.slice(2)));
        else if (/^-(W|w$|std=|f[a-z-]+|O[0-3s]?$|g$|v$|debug$|d$)/.test(a)) continue;
        else if (a.startsWith('-')) return game.error(`cobc: unrecognized option '${a.split('=')[0]}'`, 1);
        else sources.push(a);
      }
      if (output === null && args.includes('-o')) return game.error(`cobc: option requires an argument -- 'o'`, 1);
      // GnuCOBOL 3.1.2 (checked): "cobc: error: no input files", but "cobc: FILE: No such file or directory".
      if (!sources.length) return game.error('cobc: error: no input files', 1);
      const file = sources[0];
      const n = game.find(file);
      if (!n || n.type !== 'file') return game.error(`cobc: ${file}: No such file or directory`, 1);
      if (!game.traverses(file) || !game.can(n, 'r')) return game.error(`cobc: ${file}: Permission denied`, 1);
      const r = compile(game, file, content(n, game), { free, dirs, kind: kind === 'object' ? 'module' : kind });
      if ('errors' in r) {
        game.status = 1;
        return r.errors.join('\n');
      }
      const base = file.split('/').at(-1)!.replace(/\.(cob|cbl|COB|CBL)$/, '');
      const target = output ?? (kind === 'executable' ? base : kind === 'object' ? `${base}.o` : `${base}.so`);
      const node: Node =
        kind === 'object'
          ? { type: 'file', content: '', size: 18_432, owner: game.who, mode: 'rw-r--r--' }
          : { type: 'file', content: '', size: kind === 'executable' ? 27_160 : 23_064, owner: game.who, mode: 'rwxr-xr-x', program: r.program, mtime: systemd(game)?.clock };
      const old = game.find(target);
      const refused = old?.type === 'file' ? (!game.traverses(target) || !game.can(old, 'w') ? 'x' : null) : game.place('cobc', target, node);
      if (refused) return game.error(`/usr/bin/ld: cannot open output file ${target}: Permission denied\ncollect2: error: ld returned 1 exit status`, 1);
      if (old?.type === 'file') {
        delete old.program;
        delete old.charset;
        Object.assign(old, { ...node, owner: old.owner, group: old.group });
      }
      return '';
    },
  },
};
