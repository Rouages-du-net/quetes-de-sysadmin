### Story "The Music School", chapter "Two Locks": the teachers can't save in
### their share on the school's Windows Server; share permissions and NTFS
### permissions, both too tight. Also the story's shared texts (Gabriel's
### handover). Commands, cmdlets, paths and outputs are not translated.

chapter-two-locks = Two Locks
    .summary = The teachers can open their share on the music school's Windows Server but can't save anything in it: read the share's permissions and the folders' NTFS permissions, and open both locks for the teachers, and only for them.

## Files

music-school-handover =
    stave - handover notes (Gabriel, 30 November 2029)

    The server: stave.internal (192.0.2.42), Windows Server 2022.
    Remote access: OpenSSH, built into Windows, with your key. It lands
    in cmd.exe: type powershell to get PowerShell (exit comes back).

    Local groups:
      Teachers   samir, lucia, yuki
      Office     beatriz, tomasz

    Shares (D:\Shares on the server):
      Teachers   lessons, scores, recordings (the teachers)
      Office     registrations and fees (the office)
      Public     posters and timetables (everyone reads)

    In the summer I moved the shares to the new disk (D:) and created
    them again with New-SmbShare. While copying, I froze LessonPlans so that
    nobody would change a file halfway through.

    Service:
      Agenda     lesson and room bookings (http://stave.internal:8080),
                 runs as its own local account, svc_agenda.

    Scheduled task:
      Nightly Backup   every night at 1:30, C:\Scripts\backup.ps1 as
                       svc_backup: copies D:\Shares to D:\Backup\Shares.

    Logs: D:\Logs (Agenda, Backup). Windows Update restarts the server on
    Sunday nights at 3:00 when an update needs it.

    Passwords: in the school's password manager (Mariam opens it).

    Thank you for taking over, and good luck!
    Gabriel

two-locks-email-samir =
    From:  Samir (teachers' coordinator)
    To:    you
    Cc:    Mariam

    Hello, and welcome to the school!

    Since the start of term, we teachers can open our share
    (\\stave\Teachers) but we can't save anything in it: Word says we
    don't have permission to save in this location, and copying a file
    there gives "Access is denied". Same for Lucia, Yuki and me, in Scores
    as in LessonPlans. The office has no trouble with its own share.

    Gabriel wrote you a handover (Documents\handover.txt). Before he left
    he said "it must be the permissions", but he had no time to look.

    We have to put the concert parts in Scores before Friday's rehearsal,
    and the December plans in LessonPlans. And please: only us
    teachers. The office shouldn't be able to change our files (nor we
    theirs).

    Samir

## Events

two-locks-event-cmd =
    You are in cmd.exe, Windows' old command interpreter: its OpenSSH
    starts it when no DefaultShell is set. It knows dir, cd, type and the
    programs (icacls, net, sc, whoami), not PowerShell's cmdlets. Type
    powershell to start Windows PowerShell inside it (exit comes back).
two-locks-event-powershell =
    PS C:\Users\you>: Windows PowerShell. Its commands, the cmdlets, are
    named verb-noun; Get-Help NAME is the manual, and Get-Command -Noun
    Smb* lists those that deal with shares. Where are the teachers' files
    shared from?
two-locks-event-shares =
    Get-SmbShare lists the shares: Teachers is D:\Shares\Teachers on the
    server (those ending with $ are Windows' administrative shares). To
    reach a file through a share, you go through two locks: the share's
    permissions (Get-SmbShareAccess), then the folder's NTFS permissions
    (Get-Acl, icacls).
two-locks-event-share-access =
    There: on the share, Everyone may Read, and nothing more. That's what
    New-SmbShare grants when it gets no -ChangeAccess or -FullAccess: when
    Gabriel created the share again in the summer, it got the default.
    Through the share, nobody writes, whatever NTFS says. Look at NTFS too
    before changing anything.
two-locks-event-ntfs =
    NTFS gives the Teachers group Modify on D:\Shares\Teachers, inherited
    by what's inside ((OI)(CI): files and folders), and the folder doesn't
    inherit from D:\Shares (no (I) line): only SYSTEM, the administrators,
    the teachers and svc_backup (for the backup). On this side, the
    teachers may write. Who is in Teachers?
two-locks-event-members =
    Teachers: samir, lucia, yuki, all three. A group is the right thing to
    give rights to: when a teacher arrives or leaves, you change the
    group, not every folder.
two-locks-event-share-fixed =
    Samir: "Scores works! I've just put the concert parts there. But
    LessonPlans still says Access is denied, for all three of us." The share
    lets the teachers change files now: in LessonPlans, it's NTFS that says
    no. Look at that folder's permissions.
two-locks-event-share-fixed-all =
    Samir: "Scores and LessonPlans both work now!"
two-locks-event-lessons =
    LessonPlans has its own permissions: no (I), so its inheritance is off,
    and the teachers only have (RX), read and execute. Gabriel's freeze
    during the summer copy, never lifted. Give Teachers Modify on this
    folder again, for its files and subfolders too, or turn its
    inheritance back on so it gets D:\Shares\Teachers' entries (man
    icacls: /grant, /inheritance).
two-locks-event-folder-only =
    The teachers can create files in LessonPlans now, but not change the
    ones already there: the entry you added applies to the folder only.
    Without (OI)(CI) (object inherit, container inherit), its files and
    subfolders don't get it. With icacls, the flags go before the right.
two-locks-event-too-broad =
    Careful: people who aren't teachers can now change files in the
    teachers' share (the office, or anyone, depending on what you opened).
    Through a share, access is the more restrictive of the share and NTFS:
    when both are open to everyone, everyone writes. Give the rights to
    the Teachers group, and keep at least one lock closed to everyone
    else.
two-locks-event-admin =
    A teacher in Administrators gets through every lock, everywhere on the
    server: their files, the office's, the system's. That's not a fix,
    that's taking the locks off. Take them out of Administrators
    (Remove-LocalGroupMember) and give the rights to the Teachers group.
two-locks-event-full-control =
    Through the share and NTFS, the teachers now have Full Control: they
    could change the permissions themselves, or take ownership of the
    files. Change on the share and Modify on NTFS are enough to work.
two-locks-event-end =
    Samir: "Lucia saved the December plans in LessonPlans, I put the parts in
    Scores, and Beatriz checked: she can't touch our folder. Perfect,
    thank you! See you at the concert?"

    Well done! You have finished the chapter "Two Locks".

    WHAT HAPPENED
    The teachers reach their files through \\stave\Teachers, and two
    sets of permissions decide there: the share's and NTFS's. Windows
    keeps the more restrictive of the two. The share, created again with
    New-SmbShare's default, gave Everyone Read only; and LessonPlans, frozen
    during the summer copy, had lost its inheritance and kept only read
    rights for the teachers. Two locks, both closed: you opened each one,
    for the Teachers group only.

    GOOD PRACTICE
    - Through a share, effective access is the share permissions AND the
      NTFS permissions: the more restrictive wins. Read both:
      Get-SmbShareAccess, then Get-Acl or icacls.
    - Give rights to groups (Teachers), not to people, and never write
      access to Everyone.
    - A common choice: broad share permissions (Authenticated Users,
      Change) and precise NTFS, or precise on both sides; never broad on
      both.
    - (OI)(CI) so that files and subfolders inherit; a folder whose
      inheritance is off (no (I)) keeps only its own entries.
    - Administrators is not a permission fix, and Full Control lets people
      change the permissions themselves: Change and Modify are enough.
    - A "temporary" freeze is written down with its end date, and lifted.

    ANOTHER WAY
    New-SmbShare -Name Teachers -Path D:\Shares\Teachers -ChangeAccess
    STAVE\Teachers would have created the share right the first time.
    Set-Acl with a FileSystemAccessRule does what icacls does. In the
    Explorer, Properties > Security > Advanced > Effective Access shows
    one user's access. And to land straight in PowerShell over ssh,
    Windows' OpenSSH reads DefaultShell under HKLM:\SOFTWARE\OpenSSH
    (New-ItemProperty).

    DOCUMENTATION
    - Share and NTFS permissions: https://learn.microsoft.com/troubleshoot/windows-server/networking/permissions-on-shared-folders-and-ntfs
    - Grant-SmbShareAccess: https://learn.microsoft.com/powershell/module/smbshare/grant-smbshareaccess
    - icacls: https://learn.microsoft.com/windows-server/administration/windows-commands/icacls
    - Get-Acl: https://learn.microsoft.com/powershell/module/microsoft.powershell.security/get-acl?view=powershell-5.1
    - OpenSSH's DefaultShell: https://learn.microsoft.com/windows-server/administration/openssh/openssh-server-configuration
