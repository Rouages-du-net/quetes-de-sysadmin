// A Windows Server as a story's MAIN machine, reached from the workstation
// with ssh: a test machine and story added for the time of these tests
// (no story of the game has one yet). Password logon (Windows OpenSSH
// allows it), the landing shell (cmd.exe without DefaultShell, PowerShell
// with it), no "logout" on exit, a disabled account refused.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { registerStories } from '../src/engine/story-registry';
import { MACHINES, type Machine } from '../src/engine/machines';
import type { Chapter, Story } from '../src/engine/world';
import { windowsMachine } from '../src/engine/windows-world';
import { OPTIONS } from './windows-fixture';

const MACHINE: Machine = { name: 'ledgertest', domain: 'ledgertest.internal', address: '192.0.2.250', story: 'windows-test', withoutKey: true, os: 'windows' };

function story(defaultShell: 'powershell' | null): Story {
  const m = windowsMachine({ ...OPTIONS, computer: 'LEDGERTEST', defaultShell }, {
    C: (c) => {
      const users = c.children.Users;
      if (users?.type === 'directory') {
        const home = users.children.you;
        if (home?.type === 'directory') home.children['welcome.txt'] = { type: 'file', content: 'Welcome to the ledger.', lines: true };
      }
    },
  });
  const chapter: Chapter = { id: 'windows-test-1', number: 1, commands: [], home: m.home, welcome: 'welcome.txt', final: '', events: [], createWorld: m.createWorld, accounts: m.accounts, state: m.state };
  return { id: 'windows-test', chapters: [chapter] };
}

describe('A Windows main machine, from the workstation', () => {
  let added: Story;
  beforeAll(() => {
    MACHINES.push(MACHINE);
  });
  afterAll(() => {
    MACHINES.splice(MACHINES.indexOf(MACHINE), 1);
    const i = STORIES.indexOf(added);
    if (i >= 0) STORIES.splice(i, 1);
  });
  const open = (shell: 'powershell' | null) => {
    const i = STORIES.indexOf(added);
    if (i >= 0) STORIES.splice(i, 1);
    added = story(shell);
    STORIES.push(added);
    registerStories([added]);
    const c = new Console({ language: 'en' });
    // The test story has no title in the texts: the console names it.
    const t = c.t;
    c.t = Object.assign((id: string, v?: Record<string, string>) => (id === 'story-windows-test' ? 'Ledger' : t(id, v)), t) as typeof t;
    const play = (...lines: string[]) => lines.map((l) => c.execute(l) ?? '').filter(Boolean).join('\n');
    return { c, play };
  };

  it('cmd.exe without DefaultShell; a password logon; no "logout" when leaving', () => {
    const { c, play } = open(null);
    play('ssh you@192.0.2.250', 'yes');
    expect(c.prompt()).toBe("you@192.0.2.250's password:");
    const banner = play(OPTIONS.password);
    expect(banner).toContain('Microsoft Windows [Version 10.0.20348.2700]');
    expect(banner).toContain('Welcome to the ledger.');
    expect(c.prompt()).toBe('you@LEDGERTEST C:\\Users\\you>');
    expect(play('hostname')).toBe('LEDGERTEST');
    play('powershell');
    expect(c.prompt()).toBe('PS C:\\Users\\you>');
    play('exit');
    expect(play('exit')).toBe('Connection to ledgertest.internal closed.');
  });

  it('PowerShell with DefaultShell; a disabled account is refused', () => {
    const { c, play } = open('powershell');
    play('ssh you@192.0.2.250', 'yes');
    expect(play(OPTIONS.password)).toContain('Windows PowerShell');
    expect(c.prompt()).toBe('PS C:\\Users\\you>');
    play('Disable-LocalUser alice', 'exit');
    expect(play('ssh alice@192.0.2.250', 'Alice-2029-pw', 'Alice-2029-pw', 'Alice-2029-pw')).toContain('Permission denied');
  });
});
