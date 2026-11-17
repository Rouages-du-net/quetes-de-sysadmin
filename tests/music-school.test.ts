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
  });
