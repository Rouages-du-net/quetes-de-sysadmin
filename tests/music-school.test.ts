// The Music School: a Windows Server 2022 as the story's own machine, reached
// from the workstation over ssh (it lands in cmd.exe). Share and NTFS
// permissions, then a service locked out after its password changed.
// Replayed with the console, in every language, with the false leads.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES } from '../src/texts';
import type { Shell } from '../src/engine/shell';
import { windows } from '../src/engine/windows';
import { shareAccess } from '../src/engine/windows-acl';
import { findService } from '../src/engine/windows-services';
import { NEW_PASSWORD } from '../src/engine/chapters/service-logon';
import { ENOUGH, RECENT } from '../src/engine/chapters/log-flood';
import { strictScript } from '../src/engine/chapters/silent-backup';
import { volumeFree } from '../src/engine/windows';
import { findTask } from '../src/engine/windows-tasks';

const BEFORE = [...prerequisites('music-school')];

for (const language of LANGUAGES)
  describe(`The Music School — ${language}`, () => {
    const fr = language === 'fr';
    const STAVE = fr ? 'portee' : 'stave';
    const COMPUTER = STAVE.toUpperCase();
    const ME = fr ? 'vous' : 'you';
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...BEFORE, ...finished] });
      // Windows commands and paths aren't translated (inLanguage would turn net into filet): only the machine's name.
      const one = (l: string) => c.execute(l.replace(/\bstave\b/g, STAVE)) ?? '';
      const play = (lines: string[]) => lines.map(one).join('\n');
      const flag = (id: string) => c.shell.flags.has(id);
      const banner = play(['ssh stave', 'yes']);
      return { c, play, flag, banner, server: () => c.shell as Shell };
    };
    const teachers = (s: Shell) => windows(s).shares.find((x) => x.name === 'Teachers')!;
    const writes = (s: Shell, user: string, path: string) => shareAccess(s, teachers(s), path, user, 'write');

    // ——— Chapter 1: "Two Locks" ———
    it('chapter 1 — solution: cmd.exe, PowerShell, the share, NTFS, then LessonPlans', () => {
      const { c, play, flag, banner, server } = part();
      expect(banner).toContain('Microsoft Windows [Version 10.0.20348.2700]');
      contains(banner, 'Deux serrures');
      expect(c.shell.prompt()).toBe(`${ME}@${COMPUTER} C:\\Users\\${ME}>`);
      expect(play(['Get-SmbShare'])).toContain("'Get-SmbShare' is not recognized as an internal or external command");
      expect(flag('cmd')).toBe(true);
      expect(play([fr ? 'type Documents\\passation.txt' : 'type Documents\\handover.txt'])).toContain('New-SmbShare');
      play(['powershell']);
      expect(c.shell.prompt()).toBe(`PS C:\\Users\\${ME}>`);
      expect(flag('powershell')).toBe(true);
      expect(play(['Get-SmbShare'])).toMatch(/Teachers \* +D:\\Shares\\Teachers/);
      expect(flag('shares')).toBe(true);
      expect(play(['Get-SmbShareAccess Teachers'])).toMatch(/Teachers \* +Everyone +Allow +Read/);
      expect(flag('share-access')).toBe(true);
      const acl = play(['icacls D:\\Shares\\Teachers']);
      expect(acl).toContain(`${COMPUTER}\\Teachers:(OI)(CI)(M)`);
      expect(flag('ntfs')).toBe(true);
      expect(play(['Get-LocalGroupMember Teachers'])).toContain(`${COMPUTER}\\yuki`);
      expect(flag('members')).toBe(true);
      // Nobody writes through the share yet; NTFS alone would let them.
      expect(writes(server(), 'samir', '/D/Shares/Teachers/Scores')).toBe(false);
      expect(play(['Grant-SmbShareAccess -Name Teachers -AccountName Teachers -AccessRight Change'])).toContain('Are you sure you want to perform this action?');
      const granted = play(['Y']);
      expect(granted).toMatch(/Teachers \* +\w+\\Teachers +Allow +Change/);
      contains(granted, 'Scores marche');
      expect(flag('share-fixed')).toBe(true);
      expect(writes(server(), 'lucia', '/D/Shares/Teachers/LessonPlans')).toBe(false);
      expect(play(['icacls D:\\Shares\\Teachers\\LessonPlans'])).toContain(`${COMPUTER}\\Teachers:(OI)(CI)(RX)`);
      expect(flag('lessons')).toBe(true);
      expect(c.finished).not.toContain('two-locks');
      const end = play(['icacls D:\\Shares\\Teachers\\LessonPlans /grant "Teachers:(OI)(CI)(M)"']);
      contains(end, 'Bravo');
      expect(c.finished).toContain('two-locks');
      expect(writes(server(), 'yuki', '/D/Shares/Teachers/LessonPlans/orchestra-plan-december.docx')).toBe(true);
      expect(writes(server(), 'beatriz', '/D/Shares/Teachers/LessonPlans')).toBe(false);
    });

    it('chapter 1 — another way, in cmd.exe: net share, icacls /inheritance:e; a grant without (OI)(CI) first', () => {
      const { c, play, flag } = part();
      expect(play(['net share'])).toContain('Teachers     D:\\Shares\\Teachers');
      expect(flag('shares')).toBe(true);
      // In cmd.exe, the parentheses need no quotes; without (OI)(CI), only the folder.
      play(['icacls D:\\Shares\\Teachers\\LessonPlans /grant Teachers:M']);
      play(['powershell', 'Grant-SmbShareAccess -Name Teachers -AccountName Teachers -AccessRight Change -Force']);
      expect(flag('share-fixed')).toBe(true);
      expect(flag('folder-only')).toBe(true);
      expect(c.finished).not.toContain('two-locks');
      play(['exit', 'icacls D:\\Shares\\Teachers\\LessonPlans /remove Teachers']);
      play(['icacls D:\\Shares\\Teachers\\LessonPlans /inheritance:e']);
      expect(c.finished).toContain('two-locks');
    });

    it('chapter 1 — false leads: Everyone on both locks, a teacher in Administrators, Full Control', () => {
      const { c, play, flag, server } = part();
      play(['powershell', 'Grant-SmbShareAccess -Name Teachers -AccountName Everyone -AccessRight Full -Force']);
      // Share open to everyone, NTFS still precise: the office still can't write.
      expect(writes(server(), 'beatriz', '/D/Shares/Teachers/Scores')).toBe(false);
      expect(flag('too-broad')).toBe(false);
      play(['icacls D:\\Shares\\Teachers /grant "Everyone:(OI)(CI)(F)"']);
      expect(flag('too-broad')).toBe(true);
      expect(writes(server(), 'beatriz', '/D/Shares/Teachers/Scores/bach-minuet-g.pdf')).toBe(true);
      expect(c.finished).not.toContain('two-locks');
      play(['icacls D:\\Shares\\Teachers /remove Everyone']);
      play(['Add-LocalGroupMember -Group Administrators -Member samir']);
      expect(flag('admin')).toBe(true);
      expect(c.finished).not.toContain('two-locks');
      play(['Remove-LocalGroupMember -Group Administrators -Member samir', 'Y']);
      // Full Control on both sides: the teachers could change permissions.
      play(['icacls D:\\Shares\\Teachers\\LessonPlans /grant "Teachers:(OI)(CI)(F)"']);
      expect(flag('full-control')).toBe(true);
      expect(c.finished).not.toContain('two-locks');
      play(['icacls D:\\Shares\\Teachers\\LessonPlans /grant:r "Teachers:(OI)(CI)(M)"']);
      expect(c.finished).toContain('two-locks');
    });

    // ——— Chapter 2: "Locked Out" ———
    it('chapter 2 — solution: Get-Service, Start-Service, 7038, the account, sc.exe config', () => {
      const { c, play, flag, banner, server } = part(['two-locks']);
      contains(banner, 'Le service à la porte');
      play(['powershell']);
      expect(play(['Get-Service Agenda'])).toMatch(/Stopped +Agenda +Agenda - lessons and rooms/);
      expect(flag('stopped')).toBe(true);
      expect(play(['Start-Service Agenda'])).toContain("Start-Service : Service 'Agenda - lessons and rooms (Agenda)' cannot be started due to the following error");
      expect(flag('start-failed')).toBe(true);
      const events = play(['Get-WinEvent -FilterHashtable @{LogName="System"; Id=7000,7038} | Format-List']);
      expect(events).toContain('The Agenda service was unable to log on as .\\svc_agenda with the currently configured password');
      // Sunday's boot is there too.
      expect(events).toContain('12/9/2029 3:04:15 AM');
      expect(flag('events')).toBe(true);
      expect(play(['Get-EventLog System -Newest 30'])).toContain('initiated the restart');
      expect(play(['Get-CimInstance Win32_Service -Filter "Name=\'Agenda\'" | Select-Object Name, StartName, State'])).toMatch(/Agenda \.\\svc_agenda Stopped/);
      expect(flag('account')).toBe(true);
      expect(play(['Get-LocalUser svc_agenda | Select-Object Name, PasswordLastSet'])).toContain('12/7/2029 4:42:00 PM');
      expect(flag('rotated')).toBe(true);
      const vault = play([fr ? 'Get-Content Documents\\coffre-svc_agenda.txt' : 'Get-Content Documents\\vault-svc_agenda.txt']);
      expect(vault).toContain(NEW_PASSWORD);
      expect(play([`sc config Agenda obj= .\\svc_agenda password= ${NEW_PASSWORD}`])).toContain("A positional parameter cannot be found that accepts argument 'obj='.");
      expect(flag('sc-alias')).toBe(true);
      expect(play([`sc.exe config Agenda obj= .\\svc_agenda password= ${NEW_PASSWORD}`])).toContain('[SC] ChangeServiceConfig SUCCESS');
      expect(flag('configured')).toBe(true);
      expect(c.finished).not.toContain('service-logon');
      const end = play(['Start-Service Agenda']);
      contains(end, 'Bravo');
      expect(c.finished).toContain('service-logon');
      expect(findService(server(), 'Agenda')?.status).toBe('Running');
      play([fr ? 'Remove-Item Documents\\coffre-svc_agenda.txt' : 'Remove-Item Documents\\vault-svc_agenda.txt']);
      expect(flag('vault-deleted')).toBe(true);
    });

    it('chapter 2 — another way, in cmd.exe: sc query, sc qc, sc config, net start', () => {
      const { c, play, flag } = part(['two-locks']);
      expect(play(['sc query Agenda'])).toContain('STATE              : 1  STOPPED');
      expect(flag('stopped')).toBe(true);
      expect(play(['sc start Agenda'])).toContain('[SC] StartService FAILED 1069:');
      expect(flag('start-failed')).toBe(true);
      expect(play(['sc qc Agenda'])).toContain('SERVICE_START_NAME : .\\svc_agenda');
      expect(flag('account')).toBe(true);
      // A typo in the password: the service has one that isn't the account's.
      play(['sc config Agenda obj= .\\svc_agenda password= Rondo-7kq-Vt28']);
      expect(flag('wrong-password')).toBe(true);
      expect(play(['net start Agenda'])).toContain('System error 1069 has occurred.');
      play([`sc config Agenda obj= .\\svc_agenda password= ${NEW_PASSWORD}`]);
      expect(play(['net start Agenda'])).toContain('The Agenda - lessons and rooms service was started successfully.');
      expect(c.finished).toContain('service-logon');
    });

    it('chapter 2 — false leads: LocalSystem, a new password for the account only, Disabled', () => {
      const { c, play, flag, server } = part(['two-locks']);
      play(['powershell', 'sc.exe config Agenda obj= LocalSystem', 'Start-Service Agenda']);
      expect(flag('local-system')).toBe(true);
      expect(findService(server(), 'Agenda')?.status).toBe('Running');
      expect(c.finished).not.toContain('service-logon');
      play(['Stop-Service Agenda']);
      play(['Set-LocalUser svc_agenda -Password (ConvertTo-SecureString "Minuet-4ab-Qz17" -AsPlainText -Force)']);
      expect(flag('reset')).toBe(true);
      play(['sc.exe config Agenda obj= .\\svc_agenda password= Rondo-7kq-Vt29']);
      expect(play(['Start-Service Agenda'])).toContain('cannot be started');
      expect(c.finished).not.toContain('service-logon');
      play(['Set-Service Agenda -StartupType Disabled']);
      expect(flag('start-type')).toBe(true);
      // The account's current password, and Automatic again: it passes (the vault is the player's to update).
      play(['sc.exe config Agenda password= Minuet-4ab-Qz17 start= auto', 'Start-Service Agenda']);
      expect(c.finished).toContain('service-logon');
    });

    // ——— Chapter 3: "The Log Flood" ———
    const AGENDA_INI = 'C:\\ProgramData\\Agenda\\agenda.ini';
    const OLD_LOGS = 'Get-ChildItem D:\\Logs\\Agenda -Filter agenda-*.log | Where-Object LastWriteTime -lt (Get-Date).AddDays(-30)';
    const recentKept = (s: Shell) => RECENT.every((n) => s.find(`/D/Logs/Agenda/${n}`));

    it('chapter 3 — solution: Get-Volume, the biggest files, debug, -WhatIf, the old logs, the level', () => {
      const { c, play, flag, banner, server } = part(['two-locks', 'service-logon']);
      contains(banner, 'La crue des journaux');
      play(['powershell']);
      contains(play([fr ? 'Get-Content courriel_beatriz.txt' : 'Get-Content email_beatriz.txt']), '30 derniers jours');
      expect(play(['Get-Volume'])).toMatch(/D +Data +NTFS +Fixed +Healthy +OK +180 MB +500 GB/);
      expect(flag('full')).toBe(true);
      expect(play(['Get-ChildItem D:\\ -Recurse -File | Sort-Object Length -Descending | Select-Object -First 10 FullName, Length'])).toMatch(/D:\\Logs\\Agenda\\agenda-2029-\d\d-\d\d\.log +\d{10}/);
      expect(flag('culprit')).toBe(true);
      expect(play([`Get-Content ${AGENDA_INI}`])).toContain('level=debug');
      expect(flag('level')).toBe(true);
      const whatIf = play([`${OLD_LOGS} | Remove-Item -WhatIf`]);
      expect(whatIf).toContain('What if: Performing the operation "Remove File" on target "D:\\Logs\\Agenda\\agenda-2029-06-12.log".');
      expect(whatIf).not.toContain('agenda-2029-11-18.log');
      expect(flag('whatif')).toBe(true);
      expect(play(['Remove-Item D:\\Logs\\Agenda\\agenda.log'])).toContain("because it is being used by another process");
      expect(flag('in-use')).toBe(true);
      play([`${OLD_LOGS} | Remove-Item`]);
      expect(flag('freed')).toBe(true);
      expect(volumeFree(server(), 'D')).toBeGreaterThan(ENOUGH);
      expect(recentKept(server())).toBe(true);
      expect(server().find('/D/Logs/Agenda/agenda-2029-11-17.log')).toBeNull();
      play([`(Get-Content ${AGENDA_INI}) -replace 'level=debug', 'level=info' | Set-Content ${AGENDA_INI}`]);
      expect(flag('not-applied')).toBe(true);
      expect(c.finished).not.toContain('log-flood');
      const end = play(['Restart-Service Agenda']);
      contains(end, 'Bravo');
      expect(c.finished).toContain('log-flood');
    });

    it('chapter 3 — another way: compression, a cleanup task, the level in a new file, Stop then Start', () => {
      const { c, play, flag } = part(['two-locks', 'service-logon']);
      play(['powershell']);
      // Compression gains room but the level stays: not done.
      expect(play(['compact /c /i /s:D:\\Logs\\Agenda /q'])).toContain('agenda.log [ERR]');
      expect(flag('compressed')).toBe(true);
      expect(flag('freed')).toBe(true);
      expect(c.finished).not.toContain('log-flood');
      play(['$action = New-ScheduledTaskAction -Execute powershell.exe -Argument "-NoProfile -Command Get-ChildItem D:\\Logs\\Agenda -Filter agenda-*.log"', '$trigger = New-ScheduledTaskTrigger -Daily -At 2am']);
      play(['Register-ScheduledTask -TaskName "Agenda Log Cleanup" -Action $action -Trigger $trigger -User SYSTEM']);
      expect(flag('cleanup-task')).toBe(true);
      play(['Stop-Service Agenda']);
      expect(flag('stopped')).toBe(true);
      play([`Set-Content ${AGENDA_INI} -Value '[server]', 'port=8080', 'database=C:\\ProgramData\\Agenda\\agenda.db', '[log]', 'file=D:\\Logs\\Agenda\\agenda.log', 'level=warning'`]);
      expect(c.finished).not.toContain('log-flood');
      play(['Start-Service Agenda']);
      expect(c.finished).toContain('log-flood');
    });

    it('chapter 3 — false leads: everything in the folder, the backup', () => {
      const { c, play, flag, server } = part(['two-locks', 'service-logon']);
      play(['powershell']);
      play(['Remove-Item D:\\Backup\\Shares\\* -Recurse -Force']);
      expect(flag('backup-deleted')).toBe(true);
      const all = play(['Remove-Item D:\\Logs\\Agenda\\*']);
      expect(all).toContain('being used by another process');
      expect(flag('recent-deleted')).toBe(true);
      expect(server().find('/D/Logs/Agenda/agenda.log')).not.toBeNull();
      play([`(Get-Content ${AGENDA_INI}) -replace 'level=debug', 'level=info' | Set-Content ${AGENDA_INI}`, 'Restart-Service Agenda']);
      expect(flag('quieter')).toBe(true);
      expect(c.finished).not.toContain('log-flood');
    });

    // ——— Chapter 4: "The Silent Backup" ———
    const STRICT = `Set-Content C:\\Scripts\\backup.ps1 -Value '$ErrorActionPreference = "Stop"', '$day = Get-Date -Format yyyy-MM-dd', 'try { Copy-Item D:\\Shares\\* D:\\Backup\\Shares -Recurse -Force; Add-Content D:\\Logs\\Backup\\backup.log "$day copy done" } catch { Add-Content D:\\Logs\\Backup\\backup.log "$day FAILED: $_"; exit 1 }'`;
    const BEFORE4 = ['two-locks', 'service-logon', 'log-flood'];
    const lastResult = (s: Shell) => findTask(s, 'Nightly Backup')!.lastResult;

    it('chapter 4 — solution: the result, the expired password, the silent copy, the script, Bank', () => {
      const { c, play, flag, banner, server } = part(BEFORE4);
      contains(banner, 'La sauvegarde muette');
      play(['powershell']);
      expect(play(['Get-ScheduledTask'])).toMatch(/\\ +Nightly Backup +Ready/);
      expect(flag('ready')).toBe(true);
      expect(play(['Get-ScheduledTaskInfo "Nightly Backup"'])).toContain('LastTaskResult     : 2147943730');
      expect(flag('result')).toBe(true);
      expect(play(["'{0:X}' -f 2147943730"])).toBe('80070532');
      expect(play(['Get-Content D:\\Logs\\Backup\\backup.log -Tail 1'])).toMatch(/^2029-12-20 copy done\n/);
      expect(flag('own-log')).toBe(true);
      expect(play(['Get-WinEvent -LogName Microsoft-Windows-TaskScheduler/Operational'])).toContain('No events were found');
      expect(flag('history-off')).toBe(true);
      play(['wevtutil sl Microsoft-Windows-TaskScheduler/Operational /e:true']);
      expect(play(['Get-LocalUser svc_backup | Select-Object Name, PasswordLastSet, PasswordExpires'])).toContain('12/20/2029 3:00:00 PM');
      expect(flag('expired')).toBe(true);
      expect(play([fr ? 'Get-Content Documents\\coffre-svc_backup.txt' : 'Get-Content Documents\\vault-svc_backup.txt'])).toContain('Coda-5ty-Hn42');
      play(['Set-LocalUser svc_backup -PasswordNeverExpires $true']);
      expect(flag('logon-fixed')).toBe(true);
      play(['Start-ScheduledTask "Nightly Backup"']);
      expect(lastResult(server())).toBe(0);
      expect(flag('ran')).toBe(true);
      expect(play(['Test-Path D:\\Backup\\Shares\\Office\\Bank'])).toMatch(/^False\n/);
      expect(flag('missing')).toBe(true);
      play([STRICT, 'Start-ScheduledTask "Nightly Backup"']);
      expect(lastResult(server())).toBe(1);
      expect(flag('loud')).toBe(true);
      expect(play(['Get-Content D:\\Logs\\Backup\\backup.log -Tail 1'])).toContain("FAILED: Access to the path 'D:\\Shares\\Office\\Bank' is denied.");
      expect(play(['icacls D:\\Shares\\Office\\Bank'])).toContain(`${COMPUTER}\\Office:(OI)(CI)(M)\n\nSuccessfully processed 1 files`);
      expect(flag('bank-acl')).toBe(true);
      play(['icacls D:\\Shares\\Office\\Bank /grant "svc_backup:(OI)(CI)(RX)"']);
      expect(flag('readable')).toBe(true);
      expect(c.finished).not.toContain('silent-backup');
      const end = play(['Start-ScheduledTask "Nightly Backup"']);
      contains(end, 'Bravo');
      expect(c.finished).toContain('silent-backup');
      expect(server().find('/D/Backup/Shares/Office/Bank/standing-orders.xlsx')).not.toBeNull();
      expect(play(['Get-WinEvent -LogName Microsoft-Windows-TaskScheduler/Operational -MaxEvents 1'])).toContain('102 Information');
    });

    it('chapter 4 — another way: a new password for the account and the task, -ErrorVariable, inheritance', () => {
      const { c, play, flag, server } = part(BEFORE4);
      play(['powershell']);
      play(['Set-LocalUser svc_backup -Password (ConvertTo-SecureString "Fugue-8mw-Rz53" -AsPlainText -Force)']);
      expect(flag('task-password')).toBe(true);
      play(['schtasks /change /tn "Nightly Backup" /ru svc_backup /rp Fugue-8mw-Rz53']);
      expect(flag('will-expire')).toBe(true);
      play(['Set-LocalUser svc_backup -PasswordNeverExpires $true']);
      expect(flag('logon-fixed')).toBe(true);
      play([`Set-Content C:\\Scripts\\backup.ps1 -Value 'Copy-Item D:\\Shares\\* D:\\Backup\\Shares -Recurse -Force -ErrorVariable failed', 'if ($failed) { exit 2 }'`]);
      play(['schtasks /run /tn "Nightly Backup"']);
      expect(lastResult(server())).toBe(2);
      expect(flag('loud')).toBe(true);
      play(['icacls D:\\Shares\\Office\\Bank /inheritance:e']);
      expect(flag('readable')).toBe(true);
      expect(flag('too-open')).toBe(false);
      play(['Start-ScheduledTask "Nightly Backup"']);
      expect(c.finished).toContain('silent-backup');
    });

    it('chapter 4 — false leads: /expires, SYSTEM, by hand, Administrators, disabled, a script that stays quiet', () => {
      const { c, play, flag, server } = part(BEFORE4);
      play(['net user svc_backup /expires:never']);
      expect(flag('account-expires')).toBe(true);
      play(['powershell', 'Set-ScheduledTask -TaskName "Nightly Backup" -User SYSTEM', 'Start-ScheduledTask "Nightly Backup"']);
      expect(flag('system')).toBe(true);
      expect(server().find('/D/Backup/Shares/Office/Bank')).not.toBeNull();
      expect(c.finished).not.toContain('silent-backup');
      play(['& C:\\Scripts\\backup.ps1']);
      expect(flag('by-hand')).toBe(true);
      play(['Add-LocalGroupMember -Group Administrators -Member svc_backup']);
      expect(flag('admin')).toBe(true);
      play(['Remove-LocalGroupMember -Group Administrators -Member svc_backup', 'Y']);
      play(['Disable-ScheduledTask "Nightly Backup"']);
      expect(flag('disabled')).toBe(true);
      play(['Enable-ScheduledTask "Nightly Backup"', 'Set-ScheduledTask -TaskName "Nightly Backup" -User svc_backup -Password Coda-5ty-Hn42']);
      play(['Set-LocalUser svc_backup -PasswordNeverExpires $true', 'icacls D:\\Shares\\Office\\Bank /grant "svc_backup:(OI)(CI)(RX)"', 'Start-ScheduledTask "Nightly Backup"']);
      // Everything copied, but the script would still hide tomorrow's failure.
      expect(lastResult(server())).toBe(0);
      expect(flag('quiet-script')).toBe(true);
      expect(c.finished).not.toContain('silent-backup');
      play([STRICT]);
      expect(c.finished).toContain('silent-backup');
    });

    it('chapter 4 — which scripts report their failures', () => {
      expect(strictScript('Copy-Item a b -Recurse\r\nAdd-Content log done')).toBe(false);
      expect(strictScript('$ErrorActionPreference = "Stop"\r\nCopy-Item a b')).toBe(true);
      expect(strictScript('try { Copy-Item a b -ErrorAction Stop } catch { Add-Content log "failed" }')).toBe(false);
      expect(strictScript('try { Copy-Item a b -ea Stop } catch { exit 1 }')).toBe(true);
      expect(strictScript('Copy-Item a b; if (-not $?) { exit 1 }')).toBe(true);
    });
  });
