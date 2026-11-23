// The windows family (see families.ts): Windows Server's shells ("Next Door Windows", "The Music School", "The Card Catalogue"): PowerShell 5.1 and its cmdlets, cmd.exe, the Windows programs.

import { POWERSHELL, psCandidates, psComplete, runPowerShell } from '../commands/powershell';
import { runCmd } from '../commands/cmd';
import { registerFamily } from '../families';

export const HOOKS = { psCandidates, psComplete, runPowerShell, runCmd };

registerFamily('windows', POWERSHELL, HOOKS);
