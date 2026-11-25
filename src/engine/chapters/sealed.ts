// Story "The Hostel", chapter "Sealed": a power cut at 03:12; padlock came
// back at 03:58, OpenBao with it, but sealed: its root key isn't on disk,
// it must be rebuilt from three of the five key shares. Bunks, the booking
// site, couldn't read its secrets, tried five times and gave up
// (start-limit-hit). Guests arrive at nine.
// The way: bao status (Sealed true, Unseal Progress 0/3), bao operator
// unseal three times with three different shares (yours on the USB key,
// Hiroko's, Nnamdi's), bao status again, journalctl -u bunks, sudo
// systemctl restart bunks, curl its health.
// Objective checked on the state: OpenBao unsealed, Bunks running with a
// valid token, a health check that answered after the unseal.
// False leads: the same share twice (the progress doesn't move), Desta's
// share read from a blurred photo (the third share fails the whole attempt
// and resets the progress), bao operator init (already initialized),
// restarting Bunks while sealed, restarting OpenBao (it comes back sealed,
// and the shares given so far are forgotten).
// Sources: https://openbao.org/docs/concepts/seal/,
// https://openbao.org/docs/commands/operator/unseal/,
// https://openbao.org/docs/commands/status/.

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import { systemd } from '../systemd';
import { bao } from '../openbao';
import { BLURRED, HOME, NOW, PASSWORD, SHARES, accounts, bunksUp, checkedSince, healthy, initialiseStory, padlockState, padlockWorld, passTime, runs, sealed, seen } from './hostel';

const unsealedAt = (j: Game) => runs(j).find((r) => r.note === 'unsealed')?.at ?? Infinity;
const failedWith = (j: Game, text: string) => systemd(j)!.log.some((e) => e.unit === 'bunks.service' && e.time > NOW[1] && e.message.includes(text));

export const sealedChapter: Chapter = {
  id: 'sealed',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'sudo', 'systemctl', 'journalctl', 'curl', 'bao', 'exit'],
  home: HOME,
  welcome: 'message_from_desta.txt',
  names: true,
  final: 'end',
  steps: ['status', 'first-share', 'unsealed', 'restarted', 'checked', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) => padlockState(t, 1),
  initialise: (j) => initialiseStory(j, 1),
  createWorld: (t) =>
    padlockWorld(t, 1, {
      home: {
        'message_from_desta.txt': f(t('sealed-message-desta', { share: BLURRED })),
        'message_from_hiroko.txt': f(t('sealed-message-hiroko', { share: SHARES[3] })),
        'message_from_nnamdi.txt': f(t('sealed-message-nnamdi', { share: SHARES[4] })),
      },
      usb: { 'unseal-share-3.txt': f(`# ${t('sealed-usb-comment')}\n${SHARES[2]}`, { lines: true, owner: 'you', group: 'you', mode: 'rw-------' }) },
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'status', condition: (j) => runs(j).some((r) => r.path === 'sys/seal-status') && (sealed(j) || unsealedAt(j) < Infinity), message: (j) => j.t('sealed-event-status') },
    { id: 'init', condition: (j) => seen(j, 'Vault is already initialized'), message: (j) => j.t('sealed-event-init') },
    { id: 'first-share', condition: (j) => (bao(j)?.parts.length ?? 0) > 0 || !sealed(j), message: (j) => j.t('sealed-event-first-share') },
    { id: 'duplicate', condition: (j) => runs(j).some((r) => r.note === 'duplicate'), message: (j) => j.t('sealed-event-duplicate') },
    { id: 'bad-format', condition: (j) => seen(j, "'key' must be a valid hex or base64 string") || seen(j, 'invalid key: key is'), message: (j) => j.t('sealed-event-bad-format') },
    { id: 'bad-share', condition: (j) => seen(j, 'cipher: message authentication failed'), message: (j) => j.t('sealed-event-bad-share') },
    { id: 'restart-early', condition: (j) => failedWith(j, 'Vault is sealed'), message: (j) => j.t('sealed-event-restart-early') },
    { id: 'openbao-restarted', condition: (j) => systemd(j)!.services.openbao.since > NOW[1], message: (j) => j.t('sealed-event-openbao-restarted') },
    { id: 'unsealed', condition: (j) => !sealed(j), message: (j) => j.t('sealed-event-unsealed') },
    { id: 'restarted', condition: (j) => !sealed(j) && healthy(j), message: (j) => j.t('sealed-event-restarted') },
    { id: 'checked', condition: (j) => healthy(j) && checkedSince(j, unsealedAt(j)), message: (j) => j.t('sealed-event-checked') },
    { id: 'end', condition: (j) => !sealed(j) && bunksUp(j) && healthy(j) && checkedSince(j, unsealedAt(j)), message: (j) => j.t('sealed-event-end') },
  ],
};
