// The test Windows Server of tests/windows*.test.ts: LEDGER, an
// accounting office's file server (users, an Accountants group, a Finance
// share, a backup account running a service and a nightly task).

import { Shell } from '../src/engine/shell';
import type { Chapter } from '../src/engine/world';
import { windowsMachine, type WindowsOptions } from '../src/engine/windows-world';
import { windowsLogin } from '../src/engine/windows-accounts';

export const CLOCK = Date.UTC(2029, 10, 20, 9, 0, 0);
const ADMIN_PASSWORD = 'Ledger-2029-adm';

export const OPTIONS: WindowsOptions = {
  computer: 'LEDGER',
  player: 'you',
  password: ADMIN_PASSWORD,
  clock: CLOCK,
  volumes: [
    { letter: 'C', label: '', size: 120 * 1024 ** 3, base: 20 * 1024 ** 3 },
    { letter: 'D', label: 'Data', size: 200 * 1024 ** 3, base: 1024 ** 3 },
  ],
  network: { address: '192.0.2.60', mask: '255.255.255.0', gateway: '192.0.2.1', suffix: 'internal' },
  users: [
    { name: 'alice', password: 'Alice-2029-pw', fullName: 'Alice Martin', groups: ['Users', 'Accountants'] },
    { name: 'bob', password: 'Bob-2029-pw', groups: ['Users'] },
    { name: 'svc_backup', password: 'Backup-2029-svc', description: 'Backup service account', neverExpires: true, groups: ['Users', 'Backup Operators'] },
  ],
  groups: [{ name: 'Accountants', description: 'The accounting team' }],
  services: [
    { name: 'BackupAgent', display: 'Backup Agent', status: 'Running', start: 'Automatic', account: '.\\svc_backup', password: 'Backup-2029-svc', path: '"C:\\Program Files\\Backup\\agent.exe"', process: 'agent.exe' },
    { name: 'Reporter', display: 'Report Builder', status: 'Running', start: 'Manual', dependsOn: ['BackupAgent'] },
  ],
  shares: [{ name: 'Finance', path: 'D:\\Shares\\Finance', description: 'Accounting', change: [], access: [{ account: 'Everyone', right: 'Read' }, { account: 'LEDGER\\Accountants', right: 'Change' }] }],
  tasks: [
    {
      path: '\\',
      name: 'Nightly Backup',
      state: 'Ready',
      author: 'LEDGER\\you',
      user: 'LEDGER\\svc_backup',
      logon: 'Password',
      password: 'Backup-2029-svc',
      actions: [{ execute: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', arguments: '-NoProfile -File C:\\Scripts\\backup.ps1' }],
      triggers: [{ kind: 'Daily', start: Date.UTC(2029, 10, 1, 2, 0, 0) }],
      lastResult: 0,
      lastRun: Date.UTC(2029, 10, 20, 2, 0, 0),
    },
  ],
  taskHistory: true,
};

const BACKUP_SCRIPT = 'Copy-Item D:\\Shares\\Finance\\* D:\\Backup -Recurse -Force\r\nAdd-Content D:\\Backup\\backup.log "done"';

export function ledger(options: Partial<WindowsOptions> = {}, language: 'en' | 'fr' = 'en'): Shell {
  const o = { ...OPTIONS, ...options };
  const m = windowsMachine(o, {
    C: (c) => {
      if (c.type === 'directory') c.children.Scripts = { type: 'directory', children: { 'backup.ps1': { type: 'file', content: BACKUP_SCRIPT, lines: true } } };
    },
    D: {
      Shares: {
        type: 'directory',
        children: {
          Finance: {
            type: 'directory',
            children: { 'budget.xlsx': { type: 'file', content: '(binary)', size: 48_000 }, 'salaries.xlsx': { type: 'file', content: '(binary)', size: 12_000 } },
            acl: { aces: [{ id: 'LEDGER\\Accountants', mask: 0x1301bf, oi: true, ci: true }, { id: 'LEDGER\\svc_backup', mask: 0x1200a9, oi: true, ci: true }] },
          },
        },
      },
      Backup: {
        type: 'directory',
        children: {},
        acl: { protected: true, aces: [{ id: 'NT AUTHORITY\\SYSTEM', mask: 0x1f01ff, oi: true, ci: true }, { id: 'BUILTIN\\Administrators', mask: 0x1f01ff, oi: true, ci: true }, { id: 'LEDGER\\svc_backup', mask: 0x1301bf, oi: true, ci: true }] },
      },
    },
  });
  const chapter: Chapter = { id: 'windows-test', number: 1, commands: [], home: m.home, welcome: 'welcome.txt', final: '', events: [], createWorld: m.createWorld, accounts: m.accounts, state: m.state };
  const s = new Shell(chapter, language, 'ledger');
  windowsLogin(s);
  return s;
}

