// Story "The Night Batch" — chapter "Return Code": the mainframe's load
// module can't run on Linux; the batch is compiled again from Ramón's
// source with GnuCOBOL. Ayesha has added a check (compare the totals with
// the trailer, return code 8 if they differ), but cobc refuses her lines:
//   - cobc contrib.cob: "CONTRIBA: No such file or directory": the
//     copybooks are in /opt/batch/copybooks (-I);
//   - "invalid indicator 'T' at column 7": Ayesha's lines start in column 1,
//     but the reference format reserves columns 1-6 (sequence numbers) and
//     column 7 (the indicator: * for a comment); the program text goes from
//     column 8. -free is no way out: Ramón's sequence numbers become errors;
//   - without -x, cobc builds a module (contrib.so), not a program;
//   - run it: the report, and its return code (echo $?): 0 for the night's
//     file, 8 for the bureau's test file whose trailer doesn't match.
// Objective checked on the state: an executable CONTRIB with Ayesha's check
// exists, it produced the report of the 21st with return code 0, and it
// ended with 8 on the test file.
// Sources: https://gnucobol.sourceforge.io/doc/gnucobol.html (reference
// format, COPY and -I, -x, RETURN-CODE),
// https://www.gnu.org/software/bash/manual/html_node/Special-Parameters.html ($?)

import { f, type Chapter, type Directory, type File } from '../world';
import type { Game } from '../shell';
import { runs } from '../cobol';
import { newSystemd } from '../systemd';
import { COMMANDS_BYTES, HOME, MEMBERS, PASSWORD, asciiFile, batchAccounts, batchWorld, contribCob, night, withLostRecord } from './night-batch';
import { TEST_NIGHT } from './copybook';

// Wednesday 21 November 2029, 14:00.
const NOW = Date.UTC(2029, 10, 21, 14, 0, 0);
/** The bureau's test file: a record lost, the trailer still counting it. */
export const BAD_NIGHT = withLostRecord(night('291120', MEMBERS));

const said = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));

/** Every program cobc built (or that was there), wherever it is. */
function programs(n: Directory): File[] {
  return Object.values(n.children).flatMap((c) => (c.type === 'directory' ? programs(c) : c.program ? [c] : []));
}
const contribs = (j: Game) => programs(j.root).filter((p) => p.program?.id === 'CONTRIB' && p.program.kind === 'executable');
const compiled = (j: Game) => contribs(j).some((p) => p.program?.checksControl);
const good = (j: Game) => runs(j).some((r) => r.program === 'CONTRIB' && r.runDate === TEST_NIGHT.runDate && r.rc === 0 && r.details === 12 && !!r.report && j.exists(r.report));
const bad = (j: Game) => runs(j).some((r) => r.program === 'CONTRIB' && r.runDate === BAD_NIGHT.runDate && r.rc === 8);

export const COMMANDS_COMPILE = [...COMMANDS_BYTES, 'cobc'];

export const returnCode: Chapter = {
  id: 'return-code',
  number: 2,
  commands: COMMANDS_COMPILE,
  home: HOME,
  welcome: 'email_ayesha.txt',
  names: true,
  final: 'end',
  steps: ['compiled', 'report', 'rc', 'end'],
  password: PASSWORD,
  accounts: batchAccounts,
  state: () => ({
    systemd: newSystemd('abacus', Date.UTC(2029, 10, 12, 8, 0, 0), NOW, {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
  }),
  createWorld: (t) =>
    batchWorld(t, {
      home: { 'email_ayesha.txt': f(t('return-code-email-ayesha')) },
      in: {
        'contrib.dat': f(asciiFile(TEST_NIGHT), { lines: true, owner: 'batch', group: 'batch', mode: 'rw-rw-r--' }),
        'test-bad.dat': f(asciiFile(BAD_NIGHT), { lines: true, owner: 'batch', group: 'batch', mode: 'rw-rw-r--' }),
      },
      src: { 'contrib.cob': f(contribCob(false), { lines: true, owner: 'batch', group: 'batch', mode: 'rw-rw-r--' }) },
    }),
  events: [
    { id: 'copy-missing', condition: (j) => said(j, 'CONTRIBA: No such file or directory'), message: (j) => j.t('return-code-event-copy-missing') },
    { id: 'indicator', condition: (j) => said(j, "error: invalid indicator '"), message: (j) => j.t('return-code-event-indicator') },
    { id: 'free', condition: (j) => said(j, 'error: syntax error, unexpected') && /\s-(free|F)\b/.test(j.last.line), message: (j) => j.t('return-code-event-free') },
    { id: 'module', condition: (j) => said(j, 'Segmentation fault'), message: (j) => j.t('return-code-event-module') },
    { id: 'not-defined', condition: (j) => said(j, "'CHECK-TOTALS' is not defined"), message: (j) => j.t('return-code-event-not-defined') },
    { id: 'unchecked', condition: (j) => contribs(j).some((p) => !p.program?.checksControl), message: (j) => j.t('return-code-event-unchecked') },
    { id: 'compiled', condition: compiled, message: (j) => j.t('return-code-event-compiled') },
    { id: 'report', condition: good, message: (j) => j.t('return-code-event-report') },
    {
      id: 'passed-bad',
      condition: (j) => runs(j).some((r) => r.program === 'CONTRIB' && r.runDate === BAD_NIGHT.runDate && r.rc === 0),
      message: (j) => j.t('return-code-event-passed-bad'),
    },
    { id: 'rc', condition: bad, message: (j) => j.t('return-code-event-rc') },
    { id: 'end', condition: (j) => compiled(j) && good(j) && bad(j), message: (j) => j.t('return-code-event-end') },
  ],
};
