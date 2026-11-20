// Solaris 10's /usr/bin tools, older than their GNU cousins: the options a
// Debian habit reaches for and that they don't have. The POSIX versions
// (/usr/xpg4/bin/grep, sed…) and the BSD ones (/usr/ucb/ps) accept more:
// typed by their full path, they skip these checks (see shell.ts).
// Messages after Solaris 10's manual pages (https://docs.oracle.com/cd/E26505_01/).

const GREP_USAGE = 'Usage: grep -hblcnsviw pattern file . . .';
const LS_USAGE = 'usage: ls -aAbcCdeEfFghHilLmnopqrRsStuUwxvV1@/[c | v]%[atime | crtime | ctime | mtime | all] [files]';
const SED_USAGE = 'Usage:\tsed [-n] script [file...]\n\tsed [-n] [-e script]...[-f script_file]...[file...]';
const TAR_USAGE =
  'Usage: tar {c|r|t|u|x}[BDeEFhilmnopPqTvw@[0-7]][bfk][X...] [blocksize] [tarfile] [size] [exclude-file...] {file | -I include-file | -C directory file}...';
const DU_USAGE = 'usage: du [-Adorx] [-a|-s] [-h|-k|-m] [-H|-L] [file...]';
const DATE_USAGE = 'usage:\tdate [-u] mmddHHMM[[cc]yy][.SS]\n\tdate [-u] [+format]\n\tdate -a [-]sss[.fff]';
const PS_USAGE =
  "usage: ps [ -aAdeflcjLPyZ ] [ -o format ] [ -t termlist ]\n\t[ -u userlist ] [ -U userlist ] [ -G grouplist ]\n\t[ -p proclist ] [ -g pgrplist ] [ -s sidlist ] [ -z zonelist ] [-h lgrplist]\n  'format' is one or more of:\n\tuser ruser group rgroup uid ruid gid rgid pid ppid pgid sid taskid ctid\n\tpri opri pcpu pmem vsz rss osz nice class time etime stime zone zoneid\n\tf s c lwp nlwp psr tty addr wchan fname comm args projid project pset lgrp";

/** The first short option not in `allowed` (a long option counts as "-"). */
function illegal(args: string[], allowed: string, withValue = ''): string | null {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') break;
    if (a.startsWith('--')) return '-';
    if (!a.startsWith('-') || a === '-') continue;
    for (let j = 1; j < a.length; j++) {
      if (!allowed.includes(a[j])) return a[j];
      if (withValue.includes(a[j])) {
        if (j === a.length - 1) i++;
        break;
      }
    }
  }
  return null;
}

export const SOLARIS_CHECKS: Record<string, (args: string[]) => string | null> = {
  grep: (args) => {
    const bad = illegal(args, 'bchilnsvw');
    return bad ? `grep: illegal option -- ${bad}\n${GREP_USAGE}` : null;
  },
  ls: (args) => {
    const bad = illegal(args, 'aAbcCdeEfFghHilLmnopqrRsStuUwxvV1@');
    return bad ? `ls: illegal option -- ${bad}\n${LS_USAGE}` : null;
  },
  sed: (args) => {
    const bad = illegal(args, 'nef', 'ef');
    return bad ? `sed: illegal option -- ${bad}\n${SED_USAGE}` : null;
  },
  // tar's first word is its function letters, without a dash: no z (no gzip) on Solaris 10.
  tar: (args) => {
    const first = (args[0] ?? '').replace(/^-/, '');
    const bad = [...first].find((l) => !'crtuxBDeEFhilmnopPqTvw@01234567bfkX'.includes(l));
    return bad ? `tar: ${bad}: unknown function modifier\n${TAR_USAGE}` : null;
  },
  find: (args) => {
    const primary = args.find((a) => ['-maxdepth', '-mindepth', '-delete', '-printf', '-iname', '-regex', '-readable', '-writable', '-executable'].includes(a));
    return primary ? `find: bad option ${primary}\nfind: [-H | -L] path-list predicate-list` : null;
  },
  du: (args) => {
    const bad = illegal(args, 'Adorxashkm HL'.replace(' ', ''));
    return bad ? `du: illegal option -- ${bad}\n${DU_USAGE}` : null;
  },
  date: (args) => {
    const bad = illegal(args, 'ua');
    return bad ? `date: illegal option -- ${bad}\n${DATE_USAGE}` : null;
  },
  // /usr/bin/ps is System V's: "ps aux" (BSD's, without a dash) is /usr/ucb/ps.
  ps: (args) => {
    if (args[0] && !args[0].startsWith('-')) return PS_USAGE;
    const bad = illegal(args, 'aAdeflcjLPyZotuUGpgszh', 'otuUGpgszh');
    return bad ? `ps: illegal option -- ${bad}\n${PS_USAGE}` : null;
  },
};

// /usr/xpg4/bin's POSIX versions: more options, but still not GNU's.
// The usage of grep_xpg4's usage() (OpenSolaris's usr/src/cmd/grep_xpg4/grep.c,
// the closest public source to Solaris 10's binary), exit code 2.
const XPG4_GREP_USAGE = [
  'Usage:\tgrep [-c|-l|-q] [-bhinsvwx] pattern_list [file ...]',
  '\tgrep [-c|-l|-q] [-bhinsvwx] [-e pattern_list]... [-f pattern_file]... [file...]',
  '\tgrep -E [-c|-l|-q] [-bhinsvx] pattern_list [file ...]',
  '\tgrep -E [-c|-l|-q] [-bhinsvx] [-e pattern_list]... [-f pattern_file]... [file...]',
  '\tgrep -F [-c|-l|-q] [-bhinsvx] pattern_list [file ...]',
  '\tgrep -F [-c|-l|-q] [-bhinsvx] [-e pattern_list]... [-f pattern_file]... [file...]',
].join('\n');
export const XPG4_CHECKS: Record<string, (args: string[]) => string | null> = {
  // No context (-A, -B, -C), no -o, no -m: GNU additions.
  grep: (args) => {
    const bad = illegal(args, 'EFclqbhinsvwxef', 'ef');
    return bad ? `grep: illegal option -- ${bad}\n${XPG4_GREP_USAGE}` : null;
  },
};

// The paths of the POSIX, BSD and add-on versions, which skip these checks.
export const OTHER_BINS = /^\/usr\/(xpg4\/bin|xpg6\/bin|ucb|sfw\/bin|postgres\/8\.4\/bin|local\/bin)\/([\w.-]+)$/;
