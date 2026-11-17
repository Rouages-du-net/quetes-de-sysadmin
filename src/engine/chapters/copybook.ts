// Story "The Night Batch" — chapter "Fixed Width": the bureau's file has
// landed on abacus, and it doesn't look like text. Before the first night on
// Linux, read it as what it is:
//   - file says "data", cat shows � and @: it is EBCDIC (an @ is the EBCDIC
//     space, 0x40), with no newline;
//   - wc -c: 560 bytes, 14 records of 40 (RECFM=FB, LRECL=40, says the
//     copybook /opt/batch/copybooks/CONTRIB.cpy);
//   - od -c, xxd or hexdump -C: the letters (C4 = D), the digits (F0-F9),
//     and five bytes per record that are no character at all: the amount,
//     packed (COMP-3), 00 00 04 25 0C for 42.50;
//   - the false lead: iconv -f EBCDIC-US -t ASCII on the whole file stops
//     ("illegal input sequence at position 75": inside the first amount),
//     IBM037 to UTF-8 or dd conv=ascii go through but damage the amounts
//     (0x25 becomes a newline, 0x04 becomes 0x9C);
//   - Ramón's converter, /opt/batch/bin/ebc2asc, converts field by field.
// Objective checked on the state: /srv/batch/in/contrib.dat holds the 14
// records, converted (amounts right), and check.txt gives the number of
// contributions (12) and the control total of the trailer (515.20).
// Sources: https://man7.org/linux/man-pages/man1/iconv.1.html,
// https://www.gnu.org/software/coreutils/manual/html_node/dd-invocation.html,
// https://www.gnu.org/software/coreutils/manual/html_node/od-invocation.html

import { f, path, type Chapter } from '../world';
import type { Game } from '../shell';
import { COMMANDS_BYTES, DAT, HOME, MEMBERS, PASSWORD, asciiFile, batchAccounts, batchWorld, dropped, ebcdicFile, night } from './night-batch';
import { newSystemd } from '../systemd';

// Wednesday 21 November 2029, 9:30.
export const NOW = Date.UTC(2029, 10, 21, 9, 30, 0);
/** The bureau's test file: last night's real contributions. */
export const TEST_NIGHT = night('291121', MEMBERS);

const said = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));
const onFile = (j: Game, commands: string[]) => j.last.line.includes('contrib.ebc') && j.last.commands.some((c) => commands.includes(c[0]));
const converted = (j: Game) => (j.read(DAT) ?? '').replace(/\n+$/, '') === asciiFile(TEST_NIGHT);
const checked = (j: Game) => {
  const text = j.read(path(j.t, `${HOME}/check.txt`)) ?? '';
  return /(^|\D)12(\D|$)/.test(text) && /515[.,]20|51520/.test(text);
};

export const copybook: Chapter = {
  id: 'copybook',
  number: 1,
  commands: COMMANDS_BYTES,
  home: HOME,
  welcome: 'email_ayesha.txt',
  names: true,
  final: 'end',
  steps: ['records', 'bytes', 'converted', 'end'],
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
      home: { 'email_ayesha.txt': f(t('copybook-email-ayesha')), 'check.txt': f(t('copybook-check'), { lines: true }) },
      drop: { 'contrib.ebc': dropped(ebcdicFile(TEST_NIGHT), Date.UTC(2029, 10, 21, 1, 48, 0)) },
    }),
  events: [
    { id: 'garbage', condition: (j) => onFile(j, ['cat', 'less', 'head', 'tail']) && !j.last.redirection, message: (j) => j.t('copybook-event-garbage') },
    { id: 'data', condition: (j) => said(j, 'contrib.ebc: data'), message: (j) => j.t('copybook-event-data') },
    { id: 'records', condition: (j) => onFile(j, ['wc', 'stat', 'ls']) && said(j, '560'), message: (j) => j.t('copybook-event-records') },
    { id: 'bytes', condition: (j) => onFile(j, ['od', 'xxd', 'hexdump']) && (said(j, 'c8') || said(j, '310') || said(j, 'C8')), message: (j) => j.t('copybook-event-bytes') },
    { id: 'illegal', condition: (j) => said(j, 'illegal input sequence at position') && j.last.line.includes('contrib.ebc'), message: (j) => j.t('copybook-event-illegal') },
    {
      id: 'text-converted',
      condition: (j) => j.last.line.includes('contrib.ebc') && j.last.errors.length === 0 && (/\biconv\b/.test(j.last.line) || /conv=\S*ascii/.test(j.last.line)),
      message: (j) => j.t('copybook-event-text-converted'),
    },
    { id: 'wrong-dat', condition: (j) => j.exists(DAT) && !converted(j), message: (j) => j.t('copybook-event-wrong-dat') },
    { id: 'converted', condition: converted, message: (j) => j.t('copybook-event-converted') },
    { id: 'end', condition: (j) => converted(j) && checked(j), message: (j) => j.t('copybook-event-end') },
  ],
};

