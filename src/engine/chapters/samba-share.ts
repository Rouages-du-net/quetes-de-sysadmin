// Story "The Photo Club", chapter 3 — "The Laptops": the members' laptops
// (Windows, on the club's Wi-Fi, 192.0.2.0/24) should reach the photos too.
// NFS is for the darkroom computer; for them, Samba: a [photos] share in
// smb.conf (path, writable, for the club's members only), the members'
// Samba passwords (smbpasswd -a: separate from their Unix passwords), masks
// so that a photo added by one member can be changed by the others, and
// the firewall opened to the club's network. smbclient tries it.
// Objective checked on the state: a share serves /srv/photos, writable, to
// Sam and Nora (with a Samba password), not to Tom (no longer in the club),
// not to guests; what they add is group-writable and belongs to the club;
// laptops reach port 445. Several right answers: valid users = @club or a
// list, read only = no or writable = yes, force group or the setgid of the
// directory, create mask 0664 or force create mode.
// Sources: https://www.samba.org/samba/docs/current/man-html/smb.conf.5.html,
// https://www.samba.org/samba/docs/current/man-html/smbpasswd.8.html,
// https://www.samba.org/samba/docs/current/man-html/smbclient.1.html

import type { Chapter, Directory } from '../world';
import type { Game, Shell } from '../shell';
import { allowed, guestOk, modeFor, readConfig, samba, writable, type Share } from '../samba';
import { verdict, type Firewall } from '../firewall';
import { EXPORTS_CLUB, FSTAB_NFS, HOME, PASSWORD, PHOTOS, darkroomHost, mountOnDarkroom, nasAccounts, nasState, nasWorld, photos, prepareNas, seen, withNfs } from './photo-club';

const BOOT = Date.UTC(2028, 8, 1, 7, 0, 0);
const NOW = Date.UTC(2028, 8, 19, 20, 5, 0);
const LAPTOP = '192.0.2.57';

const COMMANDS = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'groups', 'mkdir', 'touch', 'cp', 'chown', 'chmod', 'df', 'systemctl', 'journalctl', 'ufw', 'ss', 'testparm', 'smbpasswd', 'pdbedit', 'smbclient', 'ssh', 'exit'];

/** The share that serves /srv/photos, if any. */
const share = (j: Game): Share | null => readConfig(j as Shell).shares.find((s) => (s.params.path ?? '').replace(/\/$/, '') === PHOTOS) ?? null;
const hasPassword = (j: Game, user: string) => user in samba(j as Shell).passdb;
// What a file added through the share by this member would look like: group club and group-writable.
const sharedWell = (j: Game, s: Share) => {
  const root = j.find(PHOTOS) as Directory;
  const group = s.params.forcegroup?.replace(/^\+/, '') ?? (/[sS]/.test(root.mode?.[5] ?? '') ? root.group : null);
  return group === 'club' && modeFor(s, false)[4] === 'w' && modeFor(s, true)[4] === 'w';
};
const membersIn = (j: Game, s: Share) => ['sam', 'nora'].every((u) => allowed(j as Shell, s, u) && hasPassword(j, u));
const laptopsReach = (j: Game) => verdict(j.state.ufw as Firewall, 445, LAPTOP) === 'accepted';
// The last file added through the share (smbclient put) by a member.
const lastPut = (j: Game) => {
  const sessions = (j.state.smbSessions ?? []) as { user: string }[];
  return sessions.length > 0 && /\bput\b/.test(j.last.line) && j.last.output.includes('putting file');
};

export const sambaShare: Chapter = {
  id: 'samba-share',
  number: 3,
  commands: COMMANDS,
  home: HOME,
  welcome: 'message_from_margot.txt',
  names: true,
  final: 'end',
  steps: ['share', 'passwords', 'masks', 'end'],
  password: PASSWORD,
  accounts: nasAccounts,
  hosts: { darkroom: darkroomHost({ mountPoint: true, fstab: FSTAB_NFS, commands: ['ls', 'cd', 'cat', 'exit'] }) },
  state: () => ({ ...nasState({ boot: BOOT, now: NOW, firewall: withNfs(), smbd: true }), samba: { passdb: { margot: 'velvia-1999' } } }),
  initialise: (j) => {
    prepareNas(j);
    mountOnDarkroom(j);
  },
  createWorld: (t) => nasWorld({ welcome: { 'message_from_margot.txt': t('samba-share-message-margot') }, exports: EXPORTS_CLUB, photos: photos({ scans: { owner: 'sam', group: 'club' } }) }),
  events: [
    {
      id: 'share',
      condition: (j) => share(j) !== null,
      message: (j) => j.t('samba-share-event-share'),
    },
    {
      id: 'unknown',
      condition: (j) => /\btestparm\b/.test(j.last.line) && seen(j, 'Unknown parameter encountered'),
      message: (j) => j.t('samba-share-event-unknown'),
    },
    {
      id: 'logon-failure',
      condition: (j) => seen(j, 'NT_STATUS_LOGON_FAILURE'),
      message: (j) => j.t('samba-share-event-logon-failure'),
    },
    {
      id: 'read-only',
      condition: (j) => seen(j, 'NT_STATUS_ACCESS_DENIED opening remote file') && !!share(j) && !writable(share(j)!),
      message: (j) => j.t('samba-share-event-read-only'),
    },
    {
      id: 'guest',
      condition: (j) => !!share(j) && guestOk(share(j)!),
      message: (j) => j.t('samba-share-event-guest'),
    },
    {
      id: 'tom',
      condition: (j) => !!share(j) && membersIn(j, share(j)!) && allowed(j as Shell, share(j)!, 'tom'),
      message: (j) => j.t('samba-share-event-tom'),
    },
    {
      id: 'passwords',
      condition: (j) => !!share(j) && membersIn(j, share(j)!),
      message: (j) => j.t('samba-share-event-passwords'),
    },
    {
      id: 'masks',
      condition: (j) => lastPut(j) && !!share(j) && !sharedWell(j, share(j)!),
      message: (j) => j.t('samba-share-event-masks'),
    },
    {
      id: 'firewall',
      condition: (j) => !!share(j) && membersIn(j, share(j)!) && sharedWell(j, share(j)!) && !laptopsReach(j),
      message: (j) => j.t('samba-share-event-firewall'),
    },
    {
      id: 'end',
      condition: (j) => {
        const s = share(j);
        return (
          !!s &&
          (j as Shell).state.systemd.services.smbd.state === 'active' &&
          writable(s) &&
          !guestOk(s) &&
          membersIn(j, s) &&
          !allowed(j as Shell, s, 'tom') &&
          sharedWell(j, s) &&
          laptopsReach(j)
        );
      },
      message: (j) => j.t('samba-share-event-end'),
    },
  ],
};
