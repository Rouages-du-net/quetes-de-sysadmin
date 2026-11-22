// The cobol family (see families.ts): GnuCOBOL ("The Night Batch"): cobc, and the compiled programs the shell runs.

import { COBOL } from '../commands/cobol';
import { runProgram } from '../cobol';
import { registerFamily } from '../families';

export const HOOKS = { runProgram };

registerFamily('cobol', COBOL, HOOKS);
