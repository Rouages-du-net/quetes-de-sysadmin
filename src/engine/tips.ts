// Tips: small one-time advice, shown when what the player just typed shows
// a shortcut would help (going up one level at a time, typing a long name
// letter by letter…) or that a habit is missing (a silent command: on
// Linux, no message means success). Each tip is shown once in the whole
// game, never in exam mode, and can be turned off (an interface setting).
// The engine decides from the line typed and the session; the interface
// shows the text (src/texts/<language>/interface.ftl: tip-<id>) and
// remembers which tips were shown, with the progress.

import type { Shell } from './shell';

export const TIPS = ['silence', 'up-twice', 'cd-back', 'cd-home', 'tab'] as const;
export type Tip = (typeof TIPS)[number];

/** What a session remembers between lines, for the tips (kept by the interface, per session). */
export interface TipMemory {
  // The previous line, its directory before and after.
  previous: { words: string[]; before: string; after: string } | null;
  // Lines where a long name was typed in full, without Tab.
  longNames: number;
}

export const newMemory = (): TipMemory => ({ previous: null, longNames: 0 });

export interface TipLine {
  sh: Shell;
  // The session's directory before the line.
  before: string;
  // Tab was pressed while typing the line.
  tab: boolean;
  // The line printed something (the command, or the story reacting to it).
  said: boolean;
}

// Commands that say nothing when they succeed.
const SILENT = ['mv', 'cp', 'mkdir', 'touch', 'rm', 'rmdir', 'ln', 'chmod', 'chown', 'chgrp'];
// A name long enough that typing it in full is a chore.
const LONG = 9;
// Lines with a long name typed in full before the Tab tip.
const LONG_LINES = 3;

const onlyUp = (p: string) => /^(\.\.\/?)+$/.test(p);

/**
 * The tips this line earns, among those not shown yet (`shown`); updates
 * the session's memory. At most one tip per line.
 */
export function newTips(l: TipLine, memory: TipMemory, shown: readonly string[]): Tip[] {
  const { sh } = l;
  const commands = sh.last.commands;
  const words = commands.length === 1 ? commands[0] : [];
  const ok = !sh.last.errors.length && (sh.status ?? 0) === 0;
  const after = sh.cwd;
  const previous = memory.previous;
  memory.previous = { words, before: l.before, after };
  const found: Tip[] = [];
  const add = (tip: Tip, when: boolean) => {
    if (when && !shown.includes(tip) && !found.length) found.push(tip);
  };

  // A silent command that succeeded: nothing printed (not even by the story), nothing wrong.
  add('silence', ok && SILENT.includes(words[0]) && !l.said && !sh.last.redirection);

  if (words[0] === 'cd' && ok) {
    const target = words[1] ?? '';
    // cd .. twice in a row.
    add('up-twice', target.replace(/\/$/, '') === '..' && previous?.words[0] === 'cd' && (previous.words[1] ?? '').replace(/\/$/, '') === '..');
    // Home by a long path, when ~ (or cd alone) would do.
    const home = sh.resolve('~');
    add('cd-home', !!home && after === home && l.before !== home && target.includes('/') && !target.startsWith('~') && !onlyUp(target));
    // Back to where the previous cd started, by typing its path again.
    add(
      'cd-back',
      !!previous &&
        previous.words[0] === 'cd' &&
        previous.before !== previous.after &&
        after === previous.before &&
        target !== '-' &&
        target.includes('/') &&
        !onlyUp(target),
    );
  }

  // Long names typed in full, without Tab.
  if (ok && !l.tab && words.slice(1).some((w) => !w.startsWith('-') && (w.split('/').filter(Boolean).at(-1) ?? '').length >= LONG)) memory.longNames++;
  add('tab', memory.longNames >= LONG_LINES);

  return found;
}
