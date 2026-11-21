// Story "The Staff Room", chapter "The New Printer": the staff room's new
// MFP (a RICOH IM C3010) is plugged in on the staff VLAN, and the reception
// wants the old HP LaserJet 4250 back in service. The MFP speaks IPP
// Everywhere: a driverless queue (lpadmin -p … -E -v ipp://… -m everywhere),
// the school's default (lpadmin -d). But cupsd.conf shares everything with
// "Allow @LOCAL", and chalk has a leg on the pupils' VLAN (for the library's
// printer): the library's Chromebooks would print on the staff room's MFP.
// Share it with the staff only: a <Location /printers/NAME> for the staff
// network, or lpadmin -u allow:@staff. The LaserJet only speaks raw port
// 9100: -m everywhere refuses ("requires an IPP connection"); it needs a
// PPD: the vendor's (apt install printer-driver-hpcups, then lpinfo -m),
// or a generic one as a fallback.
// Objective checked on the state: a driverless queue for the MFP, enabled
// and accepting, the server's default; a staff PC and a staff Mac may
// print on it, a Chromebook may not, but may still print on the library's
// printer; no Location open to all; a queue for the LaserJet with a PPD,
// enabled and accepting; the running configuration is the file's.
// Several ways: a Location block (by network, @IF(eth1), or Deny from the
// pupils' network) or allow:@staff; any queue names; hpcups's PPD or a
// generic one.
// False leads: Allow all / cupsctl --remote-any, printers.conf edited by
// hand, lpoptions -d (only your own default), printer-is-shared=false
// (nobody else can print), -m raw, a cupsd.conf edit without a restart.
// Sources: https://www.cups.org/doc/man-lpadmin.html, https://www.cups.org/doc/man-lpinfo.html,
// https://www.cups.org/doc/sharing.html, https://www.cups.org/doc/man-cupsd.conf.html,
// https://wiki.debian.org/CUPSDriverlessPrinting, https://wiki.debian.org/SystemPrinting.

import type { Chapter } from '../world';
import type { Game } from '../shell';
import { allowsAll, confApplied, cups, editedByHand, models, running, verdict } from '../cups';
import { CHROMEBOOK, HOME, MFP_URI, OLD_URI, PASSWORD, STAFF_MAC, STAFF_PC, chalkAccounts, chalkState, chalkWorld, enabled, initialiseChalk, passTime, queueFor, seen, typed, type Traffic } from './staff-room';

const mfp = (j: Game) => queueFor(j, MFP_URI);
const old = (j: Game) => queueFor(j, OLD_URI);
const driverless = (j: Game) => mfp(j)?.driver === 'everywhere';
const can = (j: Game, from: string, user: string, printer: string | undefined) => !!printer && running(j) && verdict(j, { from, user, printer }) === null;
const staffIn = (j: Game) => can(j, STAFF_PC, 'amara', mfp(j)?.name) && can(j, STAFF_MAC, 'kofi', mfp(j)?.name);
const pupilsOut = (j: Game) => !!mfp(j) && running(j) && !can(j, CHROMEBOOK, 'pupil', mfp(j)!.name);
const libraryOk = (j: Game) => can(j, CHROMEBOOK, 'pupil', 'library');
const oldOk = (j: Game) => {
  const q = old(j);
  return !!q && enabled(q) && q.driver !== 'everywhere' && q.driver !== 'raw';
};

const TRAFFIC: Traffic[] = [
  { from: STAFF_PC, user: 'amara', printer: (j) => mfp(j)?.name ?? null, title: 'seating-plan-2B.pdf', pages: 2 },
  { from: CHROMEBOOK, user: 'pupil', printer: (j) => mfp(j)?.name ?? null, title: 'game-skins.pdf', pages: 30 },
  { from: CHROMEBOOK, user: 'pupil', printer: () => 'library', title: 'book-review-year5.pdf', pages: 2 },
  { from: STAFF_MAC, user: 'kofi', printer: (j) => mfp(j)?.name ?? null, title: 'science-quiz.pdf', pages: 4 },
];

export const newPrinter: Chapter = {
  id: 'new-printer',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'ip', 'apt', 'systemctl', 'journalctl', 'lpstat', 'lp', 'lpadmin', 'lpinfo', 'lpoptions', 'driverless', 'cupsctl', 'cupsd', 'cupsenable', 'cupsaccept', 'exit'],
  home: HOME,
  welcome: 'message_from_ines.txt',
  names: true,
  final: 'end',
  steps: ['discover', 'added', 'default', 'pupil-printed', 'restricted', 'everywhere-refused', 'hpcups', 'old-added', 'end'],
  password: PASSWORD,
  accounts: chalkAccounts,
  state: () => chalkState(2),
  initialise: initialiseChalk,
  createWorld: (t) =>
    chalkWorld(2, {
      'message_from_ines.txt': t('new-printer-message-ines'),
      'delivery_note.txt': t('new-printer-delivery-note'),
    }),
  afterCommand: (j) => passTime(j, TRAFFIC),
  events: [
    { id: 'discover', condition: (j) => seen(j, /RICOH%20IM%20C3010\._ipp\._tcp\.local/i), message: (j) => j.t('new-printer-event-discover') },
    { id: 'not-enabled', condition: (j) => !!mfp(j) && !enabled(mfp(j)), message: (j) => j.t('new-printer-event-not-enabled') },
    { id: 'added', condition: (j) => driverless(j) && enabled(mfp(j)), message: (j) => j.t('new-printer-event-added', { queue: mfp(j)!.name }) },
    { id: 'lpoptions-only', condition: (j) => !!mfp(j) && /^Default\s/m.test(j.read(`${j.home}/.cups/lpoptions`) ?? '') && cups(j).default !== mfp(j)!.name, message: (j) => j.t('new-printer-event-lpoptions-only') },
    { id: 'default', condition: (j) => !!mfp(j) && cups(j).default === mfp(j)!.name, message: (j) => j.t('new-printer-event-default') },
    { id: 'pupil-printed', condition: (j) => !!mfp(j) && cups(j).jobs.some((x) => x.user === 'pupil' && x.printer === mfp(j)!.name), message: (j) => j.t('new-printer-event-pupil-printed') },
    { id: 'remote-any', condition: (j) => allowsAll(cups(j).conf), message: (j) => j.t('new-printer-event-remote-any') },
    { id: 'not-applied', condition: (j) => running(j) && !confApplied(j) && /cupsd\.conf/.test(typed(j)), message: (j) => j.t('new-printer-event-not-applied') },
    { id: 'staff-blocked', condition: (j) => driverless(j) && enabled(mfp(j)) && !staffIn(j), message: (j) => j.t('new-printer-event-staff-blocked') },
    { id: 'library-broken', condition: (j) => running(j) && !libraryOk(j), message: (j) => j.t('new-printer-event-library-broken') },
    { id: 'printers-conf', condition: (j) => running(j) && editedByHand(j), message: (j) => j.t('new-printer-event-printers-conf') },
    { id: 'restricted', condition: (j) => driverless(j) && staffIn(j) && pupilsOut(j) && libraryOk(j) && !allowsAll(cups(j).conf), message: (j) => j.t('new-printer-event-restricted') },
    { id: 'everywhere-refused', condition: (j) => seen(j, 'IPP Everywhere driver requires an IPP connection.'), message: (j) => j.t('new-printer-event-everywhere-refused') },
    { id: 'raw', condition: (j) => old(j)?.driver === 'raw' && seen(j, 'Raw queues are deprecated'), message: (j) => j.t('new-printer-event-raw') },
    { id: 'hpcups', condition: (j) => models(j).some((m) => m.name.includes('hp-laserjet_4250')), message: (j) => j.t('new-printer-event-hpcups') },
    { id: 'old-added', condition: oldOk, message: (j) => j.t('new-printer-event-old-added', { model: old(j)!.makeModel }) },
    {
      id: 'end',
      condition: (j) =>
        confApplied(j) && driverless(j) && enabled(mfp(j)) && cups(j).default === mfp(j)!.name && staffIn(j) && pupilsOut(j) && libraryOk(j) && !allowsAll(cups(j).conf) && oldOk(j),
      message: (j) => j.t('new-printer-event-end', { queue: mfp(j)!.name, old: old(j)!.name }),
    },
  ],
};
