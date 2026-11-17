// The Windows engine (step 1): a test Windows Server 2022 built with
// windowsMachine(), driven through its PowerShell and cmd.exe: the
// language, the pipeline, NTFS permissions (Deny, inheritance, share and
// NTFS together), icacls, the registry, services that lose their logon
// password, scheduled tasks, accounts, event logs, help pages.

import { describe, expect, it } from 'vitest';
import type { Shell } from '../src/engine/shell';
import { windows } from '../src/engine/windows';
import { ledger } from './windows-fixture';
import { shareAccess, effectiveRights, rightsName, token } from '../src/engine/windows-acl';
import { advanceWindows, tasks, LOGON_FAILURE } from '../src/engine/windows-tasks';
import { windowsLogin } from '../src/engine/windows-accounts';
import { CMDLETS } from '../src/engine/commands/powershell';
import { NATIVES } from '../src/engine/commands/windows-natives';
import { COMMANDS } from '../src/engine/commands';
import { LANGUAGES, translator } from '../src/texts';
import { pageMan } from '../src/engine/commands/manual';

const run = (s: Shell, ...lines: string[]) => lines.map((l) => s.execute(l) ?? '').filter(Boolean).join('\n');

describe('PowerShell, the language', () => {
  it('variables, strings, arithmetic, arrays, hashtables', () => {
    const s = ledger();
    expect(run(s, '$x = 5', '$x * 2 + 1')).toBe('11');
    expect(run(s, '$name = "world"', '"Hello $name"', "'Hello $name'")).toBe('Hello world\nHello $name');
    expect(run(s, '"Total: $($x * 3)"')).toBe('Total: 15');
    expect(run(s, '1,2,3 | ForEach-Object { $_ * 10 }')).toBe('10\n20\n30');
    expect(run(s, '@(1,2,3).Count')).toBe('3');
    expect(run(s, '$h = @{ LogName = "System"; Id = 7000 }', '$h.LogName', '$h["Id"]')).toBe('System\n7000');
    expect(run(s, '$env:COMPUTERNAME')).toBe('LEDGER');
    expect(run(s, '"a,b,c".Split(",").Count', '"Ledger".ToUpper()')).toBe('3\nLEDGER');
    expect(run(s, '1GB / 1MB')).toBe('1024');
    expect(run(s, '"{0:N2} GB" -f 1.5')).toBe('1.50 GB');
    expect(run(s, '$true -and -not $false', '5 -gt 3 -or 1 -eq 2')).toBe('True\nTrue');
    expect(run(s, '"Running" -eq "running"', '"report.zip" -like "*.ZIP"', '1,2,3 -contains 2', '2 -in 1,2')).toBe('True\nTrue\nTrue\nTrue');
    expect(run(s, '"abc" -match "b(c)"', '$Matches[1]')).toBe('True\nc');
    expect(run(s, 'if ($x -gt 3) { "big" } else { "small" }')).toBe('big');
    expect(run(s, 'foreach ($n in 1..3) { $n }')).toBe('1\n2\n3');
    expect(run(s, '[math]::Round(2.567, 1)', '[int]"42" + 1')).toBe('2.6\n43');
  });

  it('parser errors and unknown commands keep 5.1\'s layout', () => {
    const s = ledger();
    const out = run(s, 'Get-Thing');
    expect(out).toContain("Get-Thing : The term 'Get-Thing' is not recognized as the name of a cmdlet");
    expect(out).toContain('    + FullyQualifiedErrorId : CommandNotFoundException');
    expect(run(s, '"oops')).toContain('The string is missing the terminator: ".');
    expect(run(s, 'Get-Service |')).toContain('An empty pipe element is not allowed.');
    expect(run(s, '$null.Trim()')).toContain('You cannot call a method on a null-valued expression.');
    expect(run(s, 'Get-Service -Nme x')).toContain("A parameter cannot be found that matches parameter name 'Nme'.");
    expect(s.status).toBe(1);
  });

  it('the pipeline: Where-Object (both forms), Sort-Object, Select-Object, Measure-Object, Group-Object', () => {
    const s = ledger();
    expect(run(s, 'Get-Service | Where-Object Status -eq Stopped | Select-Object -ExpandProperty Name')).toBe('BITS\nssh-agent\nwuauserv');
    expect(run(s, 'Get-Service | Where-Object { $_.StartType -eq "Disabled" } | ForEach-Object { $_.Name }')).toBe('ssh-agent');
    expect(run(s, 'Get-ChildItem D:\\Shares\\Finance | Sort-Object Length -Descending | Select-Object -First 1 -ExpandProperty Name')).toBe('budget.xlsx');
    expect(run(s, '(Get-ChildItem D:\\Shares\\Finance | Measure-Object -Property Length -Sum).Sum')).toBe('60000');
    expect(run(s, 'Get-Service | Group-Object Status | Select-Object Name, Count | Sort-Object Name')).toMatch(/Name +Count\n-+ +-+\nRunning +\d+\nStopped +3/);
    expect(run(s, 'Get-Service sshd | Select-Object Name, @{Name="Up"; Expression={ $_.Status -eq "Running" }}')).toMatch(/sshd +True/);
    expect(run(s, 'Get-Service sshd | Format-List Name, Status')).toBe('\nName   : sshd\nStatus : Running');
    expect(run(s, '$s = Get-Service sshd; $s.DisplayName')).toBe('OpenSSH SSH Server');
    expect(run(s, 'Get-Service sshd | Get-Member -MemberType Property | Select-Object -First 1 -ExpandProperty Name')).toBe('Status');
  });

  it('Write-Host, -WhatIf, $LASTEXITCODE, $Error', () => {
    const s = ledger();
    expect(run(s, 'Write-Host "a" "b"')).toBe('a b');
    expect(run(s, 'Remove-Item D:\\Shares\\Finance\\budget.xlsx -WhatIf')).toBe('What if: Performing the operation "Remove File" on target "D:\\Shares\\Finance\\budget.xlsx".');
    expect(s.find('/D/Shares/Finance/budget.xlsx')).not.toBeNull();
    expect(run(s, 'Stop-Service BackupAgent -WhatIf')).toBe('What if: Performing the operation "Stop-Service" on target "Backup Agent (BackupAgent)".');
    run(s, 'ping 198.51.100.7');
    expect(run(s, '$LASTEXITCODE')).toBe('1');
    run(s, 'Get-Item D:\\nothing');
    expect(run(s, '$Error[0]')).toBe("Cannot find path 'D:\\nothing' because it does not exist.");
  });

  it('Read-Host -AsSecureString asks, then the statement runs with the answer', () => {
    const s = ledger();
    expect(run(s, '$pw = Read-Host -AsSecureString -Prompt "Password"')).toBe('');
    expect(s.prompt()).toBe('Password: ');
    expect(s.maskedInput()).toBe(true);
    run(s, 'Ledger-2030-new!');
    expect(run(s, '$pw')).toBe('System.Security.SecureString');
    expect(run(s, 'Set-LocalUser alice -Password "plain"')).toContain("Cannot convert the \"plain\" value of type \"System.String\" to type \"System.Security.SecureString\".");
    run(s, 'Set-LocalUser alice -Password $pw');
    expect(windows(s).passwords.alice).toBe('Ledger-2030-new!');
  });

  it('Tab completes cmdlets, parameters and paths', () => {
    const s = ledger();
    expect(s.complete('Get-LocalG')).toBe('Get-LocalGroup');
    expect(s.suggestions('Get-LocalG')).toEqual(['Get-LocalGroup', 'Get-LocalGroupMember']);
    expect(s.complete('Get-ChildItem -Rec')).toBe('Get-ChildItem -Recurse ');
    expect(s.complete('cd D:\\Sh')).toBe('cd D:\\Shares\\');
  });
});

describe('Files and the registry', () => {
  it('New-Item, Set-Content, Add-Content, Get-Content -Tail, Copy, Move, Rename, Remove, Test-Path', () => {
    const s = ledger();
    const made = run(s, 'New-Item -ItemType Directory D:\\Reports');
    expect(made).toContain('    Directory: D:\\');
    expect(made).toMatch(/d----- .* Reports/);
    run(s, 'Set-Content D:\\Reports\\a.txt "one"', 'Add-Content D:\\Reports\\a.txt "two","three"');
    expect(run(s, 'Get-Content D:\\Reports\\a.txt -Tail 2')).toBe('two\nthree');
    run(s, 'Copy-Item D:\\Reports\\a.txt D:\\Reports\\b.txt', 'Rename-Item D:\\Reports\\b.txt c.txt', 'Move-Item D:\\Reports\\c.txt D:\\Backup');
    expect(run(s, 'Test-Path D:\\Backup\\c.txt', 'Test-Path d:/reports/B.TXT')).toBe('True\nFalse');
    expect(run(s, '"x" > D:\\Reports\\out.txt', 'Get-Content d:\\REPORTS\\out.txt')).toBe('x');
    expect(run(s, 'Remove-Item D:\\Reports')).toContain('The item at D:\\Reports has children');
    run(s, 'N');
    expect(run(s, 'Test-Path D:\\Reports')).toBe('True');
    run(s, 'Remove-Item D:\\Reports -Recurse');
    expect(run(s, 'Test-Path D:\\Reports')).toBe('False');
  });

  it('a new folder belongs to the Administrators group when an administrator creates it, and inherits', () => {
    const s = ledger();
    run(s, 'New-Item -ItemType Directory D:\\Shares\\Finance\\2030');
    const acl = run(s, 'Get-Acl D:\\Shares\\Finance\\2030 | Format-List');
    expect(acl).toContain('Owner  : BUILTIN\\Administrators');
    expect(acl).toContain('LEDGER\\Accountants Allow  Modify, Synchronize');
  });

  it('the registry: Get-ItemProperty, New-ItemProperty, Set-ItemProperty, Get-ChildItem, reg query', () => {
    const s = ledger();
    expect(run(s, 'Get-ItemProperty HKLM:\\SOFTWARE\\OpenSSH')).toContain('DefaultShell : C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
    expect(run(s, '(Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion").ProductName')).toBe('Windows Server 2022 Standard');
    run(s, 'New-Item HKLM:\\SOFTWARE\\Ledger', 'New-ItemProperty -Path HKLM:\\SOFTWARE\\Ledger -Name Retention -Value 30 -PropertyType DWord');
    expect(run(s, 'Get-ItemPropertyValue HKLM:\\SOFTWARE\\Ledger Retention')).toBe('30');
    expect(run(s, 'New-ItemProperty -Path HKLM:\\SOFTWARE\\Ledger -Name Retention -Value 1')).toContain('The property already exists.');
    run(s, 'Set-ItemProperty HKLM:\\SOFTWARE\\Ledger -Name Retention -Value 60');
    expect(run(s, 'reg query HKLM\\SOFTWARE\\Ledger')).toBe('\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Ledger\n    Retention    REG_DWORD    0x3c');
    const list = run(s, 'Get-ChildItem HKLM:\\SOFTWARE');
    expect(list).toContain('    Hive: HKEY_LOCAL_MACHINE\\SOFTWARE');
    expect(list).toMatch(/Ledger +Retention : 60/);
    run(s, 'cd HKLM:\\SOFTWARE');
    expect(s.prompt()).toBe('PS HKLM:\\SOFTWARE>');
    run(s, 'cd C:\\');
    expect(s.prompt()).toBe('PS C:\\>');
    // A service's Start value is the service's start type.
    run(s, 'Set-ItemProperty HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Spooler -Name Start -Value 4');
    expect(run(s, '(Get-Service Spooler).StartType')).toBe('Disabled');
  });
});

describe('NTFS permissions', () => {
  it('effective access: groups, Deny before Allow, explicit before inherited', () => {
    const s = ledger();
    expect(rightsName(effectiveRights(s, '/D/Shares/Finance/budget.xlsx', token(s, 'alice')))).toBe('Modify, Synchronize');
    expect(rightsName(effectiveRights(s, '/D/Shares/Finance/budget.xlsx', token(s, 'bob')))).toBe('ReadAndExecute, Synchronize');
    // A Deny for alice on the file beats the group's inherited Allow.
    run(s, 'icacls D:\\Shares\\Finance\\salaries.xlsx /deny "alice:(R)"');
    expect(run(s, 'icacls D:\\Shares\\Finance\\salaries.xlsx')).toContain('LEDGER\\alice:(DENY)(R)');
    expect(effectiveRights(s, '/D/Shares/Finance/salaries.xlsx', token(s, 'alice')) & 1).toBe(0);
    // An explicit Allow beats an inherited Deny.
    run(s, 'icacls D:\\Shares\\Finance /deny "bob:(OI)(CI)(W)"', 'icacls D:\\Shares\\Finance\\budget.xlsx /grant "bob:(M)"');
    expect(effectiveRights(s, '/D/Shares/Finance/budget.xlsx', token(s, 'bob')) & 2).toBe(2);
    expect(effectiveRights(s, '/D/Shares/Finance/salaries.xlsx', token(s, 'bob')) & 2).toBe(0);
  });

  it('icacls: the real display, /grant, /remove, /inheritance', () => {
    const s = ledger();
    expect(run(s, 'icacls D:\\Shares\\Finance')).toBe(
      [
        'D:\\Shares\\Finance LEDGER\\Accountants:(OI)(CI)(M)',
        '                  LEDGER\\svc_backup:(OI)(CI)(RX)',
        '                  BUILTIN\\Administrators:(I)(F)',
        '                  CREATOR OWNER:(I)(OI)(CI)(IO)(F)',
        '                  NT AUTHORITY\\SYSTEM:(I)(OI)(CI)(F)',
        '                  BUILTIN\\Administrators:(I)(OI)(CI)(F)',
        '                  BUILTIN\\Users:(I)(OI)(CI)(RX)',
        '                  BUILTIN\\Users:(I)(CI)(AD)',
        '                  BUILTIN\\Users:(I)(CI)(WD)',
        '',
        'Successfully processed 1 files; Failed processing 0 files',
      ].join('\n'),
    );
    expect(run(s, 'icacls D:\\Shares\\Finance /grant "bob:(OI)(CI)(RX)"')).toBe('processed file: D:\\Shares\\Finance\nSuccessfully processed 1 files; Failed processing 0 files');
    expect(run(s, 'icacls D:\\Shares\\Finance /inheritance:r')).toContain('Successfully processed 1 files');
    expect(run(s, 'icacls D:\\Shares\\Finance')).not.toContain('(I)');
    expect(run(s, 'icacls D:\\Shares\\Finance /remove bob')).toContain('processed file');
    expect(run(s, 'icacls D:\\Shares\\Finance /grant "nobody:F"')).toContain('nobody: No mapping between account names and security IDs was done.');
    expect(run(s, 'icacls D:\\Nope')).toContain('The system cannot find the file specified.');
    // Unquoted in PowerShell, the parentheses are expressions: (OI) runs a command OI.
    expect(run(s, 'icacls D:\\Shares\\Finance /grant bob:(OI)(CI)(M)')).toContain("OI : The term 'OI' is not recognized");
  });

  it('Get-Acl, a rule with New-Object, Set-Acl', () => {
    const s = ledger();
    expect(run(s, '(Get-Acl D:\\Shares\\Finance).Access | Where-Object IdentityReference -eq "LEDGER\\Accountants"')).toBe(
      '\nFileSystemRights  : Modify, Synchronize\nAccessControlType : Allow\nIdentityReference : LEDGER\\Accountants\nIsInherited       : False\nInheritanceFlags  : ContainerInherit, ObjectInherit\nPropagationFlags  : None',
    );
    run(
      s,
      '$acl = Get-Acl D:\\Shares\\Finance',
      '$rule = New-Object System.Security.AccessControl.FileSystemAccessRule("bob","Read","ContainerInherit,ObjectInherit","None","Allow")',
      '$acl.SetAccessRule($rule)',
      'Set-Acl D:\\Shares\\Finance $acl',
    );
    expect(run(s, 'icacls D:\\Shares\\Finance')).toContain('LEDGER\\bob:(OI)(CI)(R)');
    expect(run(s, '$r = New-Object System.Security.AccessControl.FileSystemAccessRule("ghost","Read","Allow"); $acl.AddAccessRule($r)')).toContain('Some or all identity references could not be translated.');
  });

  it('a user without rights is refused, with the real message', () => {
    const s = ledger();
    s.who = 'bob';
    expect(run(s, 'Set-Content D:\\Shares\\Finance\\budget.xlsx "x"')).toContain("Access to the path 'D:\\Shares\\Finance\\budget.xlsx' is denied.");
    expect(run(s, 'Get-ChildItem D:\\Backup')).toContain("Get-ChildItem : Access to the path 'D:\\Backup' is denied.");
  });

  it('through a share: the more restrictive of share and NTFS permissions', () => {
    const s = ledger();
    const finance = windows(s).shares.find((x) => x.name === 'Finance')!;
    // alice: share Change (Accountants) and NTFS Modify: she writes.
    expect(shareAccess(s, finance, '/D/Shares/Finance/budget.xlsx', 'alice', 'write')).toBe(true);
    // svc_backup: share Read only (Everyone) though NTFS gives it read and execute: no write either way.
    expect(shareAccess(s, finance, '/D/Shares/Finance/budget.xlsx', 'svc_backup', 'write')).toBe(false);
    // bob: NTFS Modify given, but the share only lets Everyone read: refused.
    run(s, 'icacls D:\\Shares\\Finance /grant "bob:(OI)(CI)(M)"');
    expect(shareAccess(s, finance, '/D/Shares/Finance/budget.xlsx', 'bob', 'write')).toBe(false);
    expect(run(s, 'Grant-SmbShareAccess -Name Finance -AccountName bob -AccessRight Change')).toContain('Are you sure you want to perform this action?');
    run(s, 'Y');
    expect(shareAccess(s, finance, '/D/Shares/Finance/budget.xlsx', 'bob', 'write')).toBe(true);
    expect(run(s, 'Get-SmbShareAccess Finance')).toMatch(/Finance +\* +LEDGER\\bob +Allow +Change/);
    run(s, 'Revoke-SmbShareAccess -Name Finance -AccountName bob -Force');
    expect(shareAccess(s, finance, '/D/Shares/Finance/budget.xlsx', 'bob', 'write')).toBe(false);
    // A share Change doesn't open what NTFS closes.
    expect(shareAccess(s, finance, '/D/Shares/Finance/budget.xlsx', 'bob', 'read')).toBe(true);
    run(s, 'icacls D:\\Shares\\Finance /deny "bob:(OI)(CI)(R)"');
    expect(shareAccess(s, finance, '/D/Shares/Finance/budget.xlsx', 'bob', 'read')).toBe(false);
  });
});

describe('Accounts', () => {
  it('Get-LocalUser, Get-LocalGroupMember, Add-LocalGroupMember, net user, net localgroup', () => {
    const s = ledger();
    expect(run(s, 'Get-LocalUser alice')).toMatch(/Name +Enabled +Description\n-+ +-+ +-+\nalice +True/);
    expect(run(s, 'Get-LocalGroupMember Accountants')).toBe('\nObjectClass Name         PrincipalSource\n----------- ----         ---------------\nUser        LEDGER\\alice Local');
    run(s, 'Add-LocalGroupMember -Group Accountants -Member bob');
    expect(run(s, 'Add-LocalGroupMember -Group Accountants -Member bob')).toContain('LEDGER\\bob is already a member of group Accountants.');
    expect(run(s, 'Add-LocalGroupMember -Group Accountants -Member ghost')).toContain('Principal ghost was not found.');
    expect(run(s, 'net localgroup Accountants')).toContain('alice\nbob\nThe command completed successfully.');
    const user = run(s, 'net user alice');
    expect(user).toContain('User name                    alice');
    expect(user).toContain('Account active               Yes');
    expect(user).toContain('Local Group Memberships      *Accountants         *Users');
    run(s, 'Disable-LocalUser bob');
    expect(run(s, '(Get-LocalUser bob).Enabled')).toBe('False');
    expect(run(s, 'whoami')).toBe('ledger\\you');
    expect(run(s, 'whoami /groups')).toContain('BUILTIN\\Administrators');
    expect(run(s, 'Set-LocalUser alice -Password (ConvertTo-SecureString "abc" -AsPlainText -Force)')).toContain('does not meet the length, complexity, or history requirements');
    expect(run(s, 'ConvertTo-SecureString "abc" -AsPlainText')).toContain('reissue the command specifying the Force parameter');
  });
});

describe('Services', () => {
  it('a password change breaks the service that kept the old one: 7038 and 7000, then sc.exe config mends it', () => {
    const s = ledger();
    run(s, 'Set-LocalUser svc_backup -Password (ConvertTo-SecureString "Backup-2030-svc" -AsPlainText -Force)');
    expect(run(s, 'Restart-Service BackupAgent')).toContain('Cannot stop service \'Backup Agent (BackupAgent)\' because it has dependent services.');
    const out = run(s, 'Restart-Service BackupAgent -Force');
    expect(out).toContain("Restart-Service : Service 'Backup Agent (BackupAgent)' cannot be started due to the following error: Cannot start service BackupAgent on computer '.'.");
    expect(out).toContain('    + FullyQualifiedErrorId : CouldNotStartService,Microsoft.PowerShell.Commands.RestartServiceCommand');
    expect(run(s, '(Get-Service BackupAgent).Status')).toBe('Stopped');
    const events = run(s, 'Get-WinEvent -FilterHashtable @{LogName="System"; Id=7000,7038} | Select-Object -ExpandProperty Message');
    expect(events).toContain('The BackupAgent service was unable to log on as .\\svc_backup with the currently configured password due to the following error: \nThe user name or password is incorrect.');
    expect(events).toContain('The Backup Agent service failed to start due to the following error: \nThe service did not start due to a logon failure.');
    expect(run(s, 'Get-EventLog -LogName System -EntryType Error -Newest 1')).toMatch(/Error +Service Control Manager +7000/);
    expect(run(s, 'Get-EventLog Security -InstanceId 4625 | Select-Object -ExpandProperty EntryType')).toBe('FailureAudit');
    expect(run(s, 'Get-CimInstance Win32_Service -Filter "Name=\'BackupAgent\'" | Select-Object Name, StartName')).toMatch(/BackupAgent \.\\svc_backup/);
    // "sc" is Set-Content in PowerShell: sc.exe has to be named.
    expect(run(s, 'sc config BackupAgent obj= .\\svc_backup')).toContain("A positional parameter cannot be found that accepts argument 'obj='.");
    expect(run(s, 'sc.exe config BackupAgent obj= .\\svc_backup password= Backup-2030-svc')).toBe('[SC] ChangeServiceConfig SUCCESS');
    expect(run(s, 'Start-Service BackupAgent; (Get-Service BackupAgent).Status')).toBe('Running');
    expect(run(s, 'sc.exe qc BackupAgent')).toContain('SERVICE_START_NAME : .\\svc_backup');
  });

  it('a disabled service, Set-Service, net stop, Get-Process', () => {
    const s = ledger();
    run(s, 'Set-Service Spooler -StartupType Disabled', 'Stop-Service Spooler');
    expect(run(s, 'Start-Service Spooler')).toContain("Service 'Print Spooler (Spooler)' cannot be started");
    expect(run(s, 'sc.exe start Spooler')).toContain('[SC] StartService FAILED 1058:');
    expect(run(s, 'net stop "Windows Time"')).toContain('The Windows Time service was stopped successfully.');
    expect(run(s, 'Get-Process sshd')).toMatch(/Handles +NPM\(K\) +PM\(K\) +WS\(K\) +CPU\(s\) +Id +SI +ProcessName/);
  });
});

describe('Scheduled tasks', () => {
  it('a nightly task whose account password changed: 0x8007052E, events 104 and 101; Set-ScheduledTask checks the password', () => {
    const s = ledger();
    expect(run(s, 'Get-ScheduledTask "Nightly Backup"')).toMatch(/TaskPath +TaskName +State\n-+ +-+ +-+\n\\ +Nightly Backup +Ready/);
    run(s, 'Set-LocalUser svc_backup -Password (ConvertTo-SecureString "Backup-2030-svc" -AsPlainText -Force)');
    advanceWindows(s, Date.UTC(2029, 10, 21, 2, 30, 0));
    const t = tasks(s)[0];
    expect(t.lastResult).toBe(LOGON_FAILURE);
    expect(run(s, 'Get-ScheduledTaskInfo "Nightly Backup"')).toContain('LastTaskResult     : 2147943726');
    const history = run(s, 'Get-WinEvent -LogName Microsoft-Windows-TaskScheduler/Operational -MaxEvents 3 | Select-Object -ExpandProperty Id');
    expect(history.split('\n')).toEqual(['101', '104', '107']);
    expect(run(s, 'Set-ScheduledTask -TaskName "Nightly Backup" -User svc_backup -Password wrong')).toContain('The user name or password is incorrect.');
    run(s, 'Set-ScheduledTask -TaskName "Nightly Backup" -User svc_backup -Password Backup-2030-svc');
    run(s, 'Start-ScheduledTask "Nightly Backup"');
    expect(t.lastResult).toBe(0);
    expect(s.find('/D/Backup/budget.xlsx')).not.toBeNull();
    expect(run(s, 'Get-Content D:\\Backup\\backup.log')).toBe('done');
    expect(run(s, 'schtasks /query /tn "Nightly Backup" /fo LIST')).toContain('Status:                               Ready');
  });

  it('a script that fails without throwing still returns 0 (the silent backup)', () => {
    const s = ledger();
    // The backup account loses its right to read the share: Copy-Item errors, the task "succeeds".
    run(s, 'icacls D:\\Shares\\Finance /deny "svc_backup:(OI)(CI)(R)"');
    run(s, 'Start-ScheduledTask "Nightly Backup"');
    expect(tasks(s)[0].lastResult).toBe(0);
    expect(s.find('/D/Backup/budget.xlsx')).toBeNull();
    expect(run(s, 'schtasks /run /tn "Nightly Backup"')).toBe('SUCCESS: Attempted to run the scheduled task "Nightly Backup".');
  });
});

describe('Event logs', () => {
  it('Get-WinEvent -ListLog, an unknown log, a disabled history', () => {
    const s = ledger({ taskHistory: false });
    expect(run(s, 'Get-WinEvent -ListLog Microsoft-Windows-TaskScheduler/Operational')).toMatch(/Circular +1052672 +0 Microsoft-Windows-TaskScheduler\/Operational/);
    run(s, 'Start-ScheduledTask "Nightly Backup"');
    expect(run(s, 'Get-WinEvent -LogName Microsoft-Windows-TaskScheduler/Operational')).toContain('No events were found that match the specified selection criteria.');
    run(s, 'wevtutil sl Microsoft-Windows-TaskScheduler/Operational /e:true', 'Start-ScheduledTask "Nightly Backup"');
    expect(run(s, 'Get-WinEvent -LogName Microsoft-Windows-TaskScheduler/Operational -MaxEvents 1 | Format-List')).toContain('Id           : 102');
    expect(run(s, 'Get-WinEvent -LogName Nope')).toContain('There is not an event log on the localhost computer that matches "Nope".');
  });
});

describe('Landing: cmd.exe without DefaultShell, PowerShell with it', () => {
  it('cmd.exe, its prompt, powershell inside it, exit', () => {
    const c = ledger({ defaultShell: null });
    expect(windowsLogin(c)).toContain('Microsoft Windows [Version 10.0.20348.2700]');
    expect(c.prompt()).toBe('you@LEDGER C:\\Users\\you>');
    expect(run(c, 'grep x')).toBe("'grep' is not recognized as an internal or external command,\noperable program or batch file.");
    expect(run(c, 'cd D:\\Shares')).toBe('');
    expect(run(c, 'dir')).toContain(' Directory of D:\\Shares');
    expect(run(c, 'powershell')).toContain('Windows PowerShell');
    expect(c.prompt()).toBe('PS D:\\Shares>');
    run(c, 'exit');
    expect(c.prompt()).toBe('you@LEDGER D:\\Shares>');
    run(c, 'exit');
    expect(c.output).toBe(true);
    // DefaultShell set by the documented command: the next session lands in PowerShell.
    const d = ledger({ defaultShell: null });
    run(d, 'powershell', 'New-ItemProperty -Path "HKLM:\\SOFTWARE\\OpenSSH" -Name DefaultShell -Value "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -PropertyType String -Force');
    expect(windowsLogin(d)).toContain('Windows PowerShell');
  });
});

describe('The manual', () => {
  it('every cmdlet and native program has its page, in every language', () => {
    for (const language of LANGUAGES) {
      const s = ledger({}, language as 'en');
      for (const c of CMDLETS) {
        expect(COMMANDS[c.name]?.cmdlet, c.name).toBe(true);
        const help = run(s, `Get-Help ${c.name}`);
        expect(help, c.name).toContain(c.name);
        expect(help, c.name).not.toContain('could not find');
      }
      for (const n of NATIVES.filter((x) => x.page)) expect(pageMan(n.page!, COMMANDS[n.page!], translator(language)), n.page).toMatch(/^[A-Z.]+\(CMD\)/);
    }
  });
  it('Get-Help -Examples, -Parameter; Get-Command -Noun', () => {
    const s = ledger();
    expect(run(s, 'Get-Help Get-Acl -Examples')).toContain('EXAMPLE 1');
    expect(run(s, 'Get-Help Set-LocalUser -Parameter Password')).toContain('-Password <SecureString>');
    expect(run(s, 'Get-Command -Noun LocalUser')).toContain('Set-LocalUser');
    expect(run(s, 'Get-Alias gsv')).toContain('gsv -> Get-Service');
  });
});
