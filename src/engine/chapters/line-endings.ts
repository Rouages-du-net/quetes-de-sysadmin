// Story "Next Door Windows" — chapter "Invisible Characters": Henrik wrote
// the nightly backup script on his Windows laptop and pushed it to ~/ops;
// on compass it doesn't even start:
//   - ./nightly-copy.sh: "-bash: ./nightly-copy.sh: /bin/bash^M: bad interpreter: No
//     such file or directory" (the kernel looks for "/bin/bash\r");
//   - bash nightly-copy.sh: "$'\r': command not found", and cd refuses
//     $'/srv/projects\r': every line ends with an invisible carriage return;
//   - file says "with CRLF line terminators", cat -A shows ^M$, od -c \r \n;
//   - convert: dos2unix, or sed -i 's/\r$//', or tr -d '\r' through a pipe
//     (several answers pass: the objective is the file's content);
//   - run it: /srv/nightly/current appears;
//   - prevent it: a .gitattributes in ~/ops that gives *.sh the text
//     attribute with eol=lf, committed with the converted script.
// False leads: chmod +x (it already is executable), unix2dos.
// Sources: https://waterlan.home.xs4all.nl/dos2unix/dos2unix.htm,
// https://git-scm.com/docs/gitattributes,
// https://www.gnu.org/software/bash/manual/bash.html (ANSI-C quoting, $'…').

import { f, path, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { textAttribute } from '../commands/git';
import { BACKUP_LINES, HOME, OPS, PASSWORD, compassAccounts, compassState, compassWorld } from './mixed-fleet';

// Tuesday 6 November 2029, 9:40.
export const NOW = Date.UTC(2029, 10, 6, 9, 40, 0);

const said = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));
const script = (j: Game) => j.read(path(j.t, `${OPS}/nightly-copy.sh`)) ?? '';
/** The script in Unix format, its commands kept. */
const fixed = (j: Game) => {
  const s = script(j);
  return !s.includes('\r') && s.startsWith('#!/bin/bash') && BACKUP_LINES.filter(Boolean).every((l) => s.includes(l));
};
const ran = (j: Game) => j.find('/srv/nightly/current')?.type === 'directory';
const repo = (j: Game) => (j.state.git as Record<string, { commits: { files: Record<string, string> }[] }> | undefined)?.[path(j.t, OPS)];
/** The repository's last commit holds a .gitattributes that makes *.sh text, and the script in LF. */
const committed = (j: Game) => {
  const head = repo(j)?.commits.at(-1)?.files;
  return !!head?.['.gitattributes'] && !!head['nightly-copy.sh'] && !head['nightly-copy.sh'].includes('\r') && textAttribute(j as Shell, path(j.t, OPS), 'nightly-copy.sh');
};

export const COMMANDS_LINE_ENDINGS = [
  'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'echo', 'file', 'od', 'xxd', 'hexdump', 'dos2unix',
  'unix2dos', 'tr', 'sed', 'diff', 'git', 'chmod', 'bash', 'sh', 'cp', 'mv', 'rm', 'mkdir', 'wc', 'apt',
];

export const lineEndings: Chapter = {
  id: 'line-endings',
  number: 1,
  commands: COMMANDS_LINE_ENDINGS,
  home: HOME,
  welcome: 'email_ifeoma.txt',
  names: true,
  final: 'end',
  steps: ['bad-interpreter', 'crlf', 'converted', 'ran', 'committed', 'end'],
  password: PASSWORD,
  accounts: compassAccounts,
  state: (t) => compassState(t, { now: NOW, apt: true, git: true }),
  createWorld: (t) => compassWorld(t, { home: { 'email_ifeoma.txt': f(t('line-endings-email-ifeoma')) } }),
  events: [
    { id: 'bad-interpreter', condition: (j) => said(j, '^M: bad interpreter'), message: (j) => j.t('line-endings-event-bad-interpreter') },
    { id: 'carriage-return', condition: (j) => said(j, "$'\\r': command not found"), message: (j) => j.t('line-endings-event-carriage-return') },
    {
      id: 'chmod',
      condition: (j) => j.last.commands.some((c) => c.includes('chmod') && c.some((a) => a.endsWith('nightly-copy.sh'))) && script(j).includes('\r'),
      message: (j) => j.t('line-endings-event-chmod'),
    },
    {
      id: 'crlf',
      condition: (j) =>
        j.last.line.includes('nightly-copy.sh') &&
        (said(j, 'with CRLF line terminators') || said(j, '^M$') || (j.last.commands.some((c) => ['od', 'xxd', 'hexdump'].includes(c[0])) && (said(j, '\\r') || said(j, '0d0a') || said(j, '0d 0a')))),
      message: (j) => j.t('line-endings-event-crlf'),
    },
    { id: 'converted', condition: fixed, message: (j) => j.t('line-endings-event-converted') },
    { id: 'ran', condition: (j) => fixed(j) && ran(j), message: (j) => j.t('line-endings-event-ran') },
    { id: 'committed', condition: committed, message: (j) => j.t('line-endings-event-committed') },
    { id: 'end', condition: (j) => fixed(j) && ran(j) && committed(j), message: (j) => j.t('line-endings-event-end') },
  ],
};
