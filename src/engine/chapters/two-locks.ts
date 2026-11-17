// Story "The Music School" — chapter "Two Locks": the teachers can open
// their share (\\stave\Teachers) but can't save anything in it, and in
// LessonPlans not even after that. Two layers decide, and both are wrong:
//   - ssh stave lands in cmd.exe (no DefaultShell): `powershell` switches;
//   - Get-SmbShare, Get-SmbShareAccess Teachers: "Everyone Allow Read",
//     New-SmbShare's default when Gabriel moved the share in the summer;
//   - icacls D:\Shares\Teachers or Get-Acl … | Format-List: NTFS gives
//     Teachers Modify, so NTFS isn't the problem in Scores;
//   - Get-LocalGroupMember Teachers: samir, lucia, yuki;
//   - access through a share = the more restrictive of the share and NTFS
//     permissions: Grant-SmbShareAccess -Name Teachers -AccountName
//     Teachers -AccessRight Change; Scores works, LessonPlans doesn't:
//   - icacls D:\Shares\Teachers\LessonPlans: no (I), inheritance off, Teachers
//     (RX) only (Gabriel froze it during the copy): icacls … /grant
//     "Teachers:(OI)(CI)(M)" or /inheritance:e (Set-Acl works too).
// Objective checked on the state, through the share as each teacher would
// reach it (shareAccess): the three teachers write in Scores and in LessonPlans
// (the folder and its files); the office staff can't write there; NTFS
// doesn't let Everyone, Users or Authenticated Users write; no teacher is
// an administrator; the teachers can't change permissions (no Full Control
// through both layers).
// False leads: Everyone Full Control on the share and on NTFS (the office,
// and anyone, could write), a teacher added to Administrators, a grant on
// LessonPlans without (OI)(CI) (the folder, not its files).
// Sources: https://learn.microsoft.com/troubleshoot/windows-server/networking/permissions-on-shared-folders-and-ntfs,
// https://learn.microsoft.com/powershell/module/smbshare/grant-smbshareaccess,
// https://learn.microsoft.com/windows-server/administration/windows-commands/icacls,
// https://learn.microsoft.com/powershell/module/microsoft.powershell.security/get-acl?view=powershell-5.1

import type { Chapter } from '../world';
import type { Game } from '../shell';
import { effectiveRights, R, shareAccess, shareEffective, token } from '../windows-acl';
import { HOME, OFFICE, TEACHERS, inPowerShell, ran, said, server, share, stave } from './music-school';

// Monday 3 December 2029, 8:40.
export const NOW = Date.UTC(2029, 11, 3, 8, 40, 0);

const SCORES = '/D/Shares/Teachers/Scores';
const LESSONS = '/D/Shares/Teachers/LessonPlans';
const SCORES_FILE = `${SCORES}/winter-concert-parts.zip`;
const LESSONS_FILE = `${LESSONS}/orchestra-plan-december.docx`;
const PLACES = ['/D/Shares/Teachers', SCORES, SCORES_FILE, LESSONS, LESSONS_FILE];

const machine = stave({
  clock: NOW,
  frozenLessonPlans: true,
  home: (t) => ({ 'email_samir.txt': { type: 'file', content: t('two-locks-email-samir').replace(/\n/g, '\r\n'), lines: true, mtime: NOW - 40 * 60_000 } }),
});

/** Can this user write here through the Teachers share (share AND NTFS)? */
const writes = (j: Game, user: string, path: string) => shareAccess(server(j), share(j, 'Teachers'), path, user, 'write');
const teachersWrite = (j: Game, ...paths: string[]) => TEACHERS.every((u) => paths.every((p) => writes(j, u, p)));
const scoresOk = (j: Game) => teachersWrite(j, SCORES, SCORES_FILE);
const lessonsFolder = (j: Game) => teachersWrite(j, LESSONS);
const lessonsFiles = (j: Game) => teachersWrite(j, LESSONS_FILE);

/** The identities anyone has (Everyone, Users, Authenticated Users): may they write in the teachers' folders by NTFS? */
const ANYONE = new Set(['Everyone', 'NT AUTHORITY\\Authenticated Users', 'BUILTIN\\Users', 'NT AUTHORITY\\NETWORK', 'NT AUTHORITY\\INTERACTIVE']);
const ntfsOpen = (j: Game) => PLACES.some((p) => effectiveRights(server(j), p, ANYONE) & R.WriteData);
/** Too broad: the office could write in the teachers' share, or NTFS lets anyone write. */
const tooBroad = (j: Game) => OFFICE.some((u) => PLACES.some((p) => writes(j, u, p))) || ntfsOpen(j);
const adminTeacher = (j: Game) => TEACHERS.some((u) => token(j, u).has('BUILTIN\\Administrators'));
/** Full Control through both layers: the teachers could change the permissions themselves. */
const ownPermissions = (j: Game) => TEACHERS.some((u) => PLACES.some((p) => shareEffective(server(j), share(j, 'Teachers'), p, u) & R.ChangePermissions));

export const COMMANDS_TWO_LOCKS = [
  'powershell', 'Get-SmbShare', 'Get-SmbShareAccess', 'Grant-SmbShareAccess', 'Revoke-SmbShareAccess', 'Get-Acl', 'Format-List', 'icacls',
  'Get-LocalGroupMember', 'Get-LocalUser', 'Get-ChildItem', 'Get-Help', 'cmd',
];

export const twoLocks: Chapter = {
  id: 'two-locks',
  number: 1,
  commands: COMMANDS_TWO_LOCKS,
  home: HOME,
  welcome: 'email_samir.txt',
  names: true,
  final: 'end',
  steps: ['powershell', 'shares', 'share-access', 'ntfs', 'share-fixed', 'lessons', 'end'],
  accounts: machine.accounts,
  state: machine.state,
  createWorld: machine.createWorld,
  events: [
    { id: 'cmd', condition: (j) => !inPowerShell(j) && said(j, 'is not recognized as an internal or external command'), message: (j) => j.t('two-locks-event-cmd') },
    { id: 'powershell', condition: inPowerShell, message: (j) => j.t('two-locks-event-powershell') },
    { id: 'shares', condition: (j) => ran(j, 'Get-SmbShare', 'net') && said(j, 'Teachers'), message: (j) => j.t('two-locks-event-shares') },
    { id: 'share-access', condition: (j) => ran(j, 'Get-SmbShareAccess') && said(j, /Teachers +\* +Everyone +Allow +Read/), message: (j) => j.t('two-locks-event-share-access') },
    {
      id: 'ntfs',
      condition: (j) => ran(j, 'icacls', 'Get-Acl', 'Get-ChildItem') && (said(j, /\\Teachers:\(OI\)\(CI\)\(M\)/) || said(j, /\\Teachers Allow +Modify/)),
      message: (j) => j.t('two-locks-event-ntfs'),
    },
    { id: 'members', condition: (j) => ran(j, 'Get-LocalGroupMember', 'net') && said(j, 'samir') && said(j, 'yuki'), message: (j) => j.t('two-locks-event-members') },
    { id: 'share-fixed', condition: scoresOk, message: (j) => j.t(lessonsFiles(j) ? 'two-locks-event-share-fixed-all' : 'two-locks-event-share-fixed') },
    {
      id: 'lessons',
      condition: (j) => ran(j, 'icacls', 'Get-Acl') && /lessonplans/i.test(j.last.line) && (said(j, /\\Teachers:\(OI\)\(CI\)\(RX\)/) || said(j, /\\Teachers Allow +ReadAndExecute/)),
      message: (j) => j.t('two-locks-event-lessons'),
    },
    { id: 'folder-only', condition: (j) => lessonsFolder(j) && !lessonsFiles(j), message: (j) => j.t('two-locks-event-folder-only') },
    { id: 'too-broad', condition: tooBroad, message: (j) => j.t('two-locks-event-too-broad') },
    { id: 'admin', condition: adminTeacher, message: (j) => j.t('two-locks-event-admin') },
    { id: 'full-control', condition: ownPermissions, message: (j) => j.t('two-locks-event-full-control') },
    {
      id: 'end',
      condition: (j) => scoresOk(j) && lessonsFolder(j) && lessonsFiles(j) && !tooBroad(j) && !adminTeacher(j) && !ownPermissions(j),
      message: (j) => j.t('two-locks-event-end'),
    },
  ],
};
