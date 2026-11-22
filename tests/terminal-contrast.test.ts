// The terminal's colours (src/interface/styles.css): the output colours read
// from the ANSI sequences (src/engine/colours.ts: --_a-*), the command line's
// highlighting (--_c-*), the text and the prompt, against each terminal
// theme's background: at least 4.5:1 (WCAG 1.4.3, AA), in every theme.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/interface/styles.css', 'utf8');

// The custom properties of every rule whose selector is exactly `selector`.
const block = (selector: string) => {
  const vars: Record<string, string> = {};
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const m of css.matchAll(new RegExp(`(?:^|\\n|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g')))
    for (const d of m[1].matchAll(/(--_[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)) vars[d[1]] = d[2];
  return vars;
};
// The game's default terminal colours: the fallbacks of .qds (light page) and its dark theme.
const fallback = (name: string, from: string) => new RegExp(`${name}:\\s*var\\(--qds-[\\w-]+,\\s*var\\(--qds-[\\w-]+,\\s*(#[0-9a-fA-F]{6})\\)\\)`).exec(from)?.[1];
const qds = css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)'));
const dark = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const base = block('.qds .terminal');
const themes: Record<string, { backgrounds: string[]; colours: Record<string, string> }> = {
  phosphor: {
    backgrounds: [fallback('--_terminal-background', qds)!, fallback('--_terminal-background', dark)!],
    colours: { ...base, '--_terminal-text': fallback('--_terminal-text', qds)!, '--_terminal-prompt': fallback('--_terminal-prompt', qds)! },
  },
};
for (const name of ['amber', 'contrast', 'paper']) {
  const own = block(`.qds .terminal[data-theme='${name}']`);
  themes[name] = { backgrounds: [own['--_terminal-background']], colours: { ...base, ...own } };
}

describe('the terminal colours have AA contrast in every theme', () => {
  it('finds the themes and their colours in styles.css', () => {
    expect(Object.keys(base).filter((k) => k.startsWith('--_a-3')).length).toBe(7);
    for (const [name, th] of Object.entries(themes)) {
      expect(th.backgrounds.every(Boolean), name).toBe(true);
      expect(th.colours['--_terminal-text'], name).toBeTruthy();
    }
  });
  for (const [name, th] of Object.entries(themes))
    it(`${name}: text, prompt, output colours and highlighting`, () => {
      const low: string[] = [];
      for (const bg of th.backgrounds)
        for (const [k, v] of Object.entries(th.colours)) {
          if (!/^--_(a-3[1-7]|c-|terminal-text|terminal-prompt)/.test(k)) continue;
          if (ratio(v, bg) < 4.5) low.push(`${k} ${v} on ${bg}: ${ratio(v, bg).toFixed(2)}`);
        }
      // ls's sticky other-writable directories: the background's colour (30) on green (42).
      const bg42 = th.colours['--_a-bg-42'];
      for (const bg of th.backgrounds) if (bg42 && ratio(bg, bg42) < 4.5) low.push(`30;42 on ${bg}: ${ratio(bg, bg42).toFixed(2)}`);
      // White on red (41).
      const bg41 = th.colours['--_a-bg-41'];
      if (bg41 && ratio('#ffffff', bg41) < 4.5) low.push(`41 white on ${bg41}`);
      expect(low).toEqual([]);
    });
});
