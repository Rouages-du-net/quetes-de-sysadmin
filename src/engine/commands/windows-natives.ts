// The native programs of the game's Windows (C:\Windows\System32\*.exe),
// run from PowerShell or cmd.exe alike: found by name with or without .exe,
// any case. Each family declares its own (icacls, net, sc.exe, schtasks,
// reg, wevtutil, ipconfig, ping…); the shells themselves are here: cmd
// (cmd /c COMMAND runs one command) and powershell (-Command, -NoProfile,
// -File), which start a shell inside the session (exit comes back).
// Sources (Microsoft Learn): cmd
// (https://learn.microsoft.com/windows-server/administration/windows-commands/cmd),
// about_PowerShell_exe
// (https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_powershell_exe?view=powershell-5.1).

import type { Native } from '../powershell';
import { CMD_BANNER, POWERSHELL_BANNER, resolveWindows, toWindows } from '../windows';
import { FILE_NATIVES } from './windows-files';
import { ACL_NATIVES } from './windows-acl';
import { ACCOUNT_NATIVES } from './windows-accounts';
import { SERVICE_NATIVES } from './windows-services';
import { EVENT_NATIVES } from './windows-events';
import { TASK_NATIVES } from './windows-tasks';
import { SYSTEM_NATIVES } from './windows-system';
import { SHELL_HOOKS } from './windows-shells';
import { FIREWALL_NATIVES } from './windows-firewall';
import { GPO_NATIVES } from './windows-gpo';

const SHELLS: Native[] = [
  {
    name: 'cmd.exe',
    page: 'cmd',
    run: (game, args) => {
      const c = args.findIndex((a) => /^\/[ck]$/i.test(a));
      if (c >= 0) {
        const out = SHELL_HOOKS.cmd?.(game, args.slice(c + 1).join(' ')) ?? '';
        return { out, code: game.status ?? 0 };
      }
      return { out: CMD_BANNER, code: 0, shell: 'cmd' };
    },
  },
  {
    name: 'powershell.exe',
    page: 'powershell',
    run: (game, args) => {
      const rest = args.filter((a) => !/^-(noprofile|nologo|noninteractive|nop|executionpolicy|ep)$/i.test(a) && !/^(bypass|remotesigned|unrestricted)$/i.test(a));
      const file = rest.findIndex((a) => /^-f(ile)?$/i.test(a));
      if (file >= 0) {
        const where = resolveWindows(game, rest[file + 1] ?? '');
        const node = where.exists ? game.find(where.path) : null;
        if (!node) return { out: '', err: `The argument '${rest[file + 1] ?? ''}' to the -File parameter does not exist. Provide the path to an existing '.ps1' file as an argument to the -File parameter.`, code: -196608 };
        const code = SHELL_HOOKS.script?.(game, game.read(where.path) ?? '', toWindows(where.path)) ?? 0;
        return { out: '', code };
      }
      const cmd = rest.findIndex((a) => /^-c(ommand)?$/i.test(a));
      const line = cmd >= 0 ? rest.slice(cmd + 1).join(' ') : rest.join(' ');
      if (line.trim()) {
        const out = SHELL_HOOKS.powershell?.(game, line.replace(/^"(.*)"$/, '$1')) ?? '';
        return { out, code: game.status ?? 0 };
      }
      return { out: POWERSHELL_BANNER, code: 0, shell: 'powershell' };
    },
  },
];

export const NATIVES: Native[] = [...SHELLS, ...FILE_NATIVES, ...ACL_NATIVES, ...ACCOUNT_NATIVES, ...SERVICE_NATIVES, ...EVENT_NATIVES, ...TASK_NATIVES, ...SYSTEM_NATIVES, ...FIREWALL_NATIVES, ...GPO_NATIVES];

/** A native program by its name (icacls, ICACLS.EXE, C:\Windows\System32\icacls.exe). */
export function nativeNamed(typed: string): Native | undefined {
  const bare = typed.replace(/^.*[\\/]/, '').toLowerCase();
  return NATIVES.find((n) => n.name.toLowerCase() === bare || n.name.toLowerCase().replace(/\.exe$/, '') === bare);
}
