// The two shells of the game's Windows call each other (cmd /c, powershell
// -Command): each registers here how it runs a line, to keep the modules
// free of import cycles at load time.

import type { Shell } from '../shell';

export const SHELL_HOOKS: {
  cmd: ((game: Shell, line: string) => string) | null;
  powershell: ((game: Shell, line: string) => string) | null;
  script: ((game: Shell, source: string, file: string) => number) | null;
} = { cmd: null, powershell: null, script: null };
