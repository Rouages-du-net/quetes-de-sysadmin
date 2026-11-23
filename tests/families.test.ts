// What the first visit leaves out (docs/DEPLOYMENT.md, "Chunks and budget"):
// the engine's families (src/engine/families.ts), the manual's examples
// (commands/examples.ts), the chapters' summaries and the manual's
// sentences (src/texts/plugin.mjs).

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { STORIES } from '../src/engine/chapters';
import { COMMANDS } from '../src/engine/commands';
import { EXAMPLES } from '../src/engine/commands/examples';
import { PAGES } from '../src/engine/commands/pages';
import { commandFamilies, FAMILIES, FAMILY_COMMANDS, familyCommands, familyLoaded, type Family } from '../src/engine/families';
import { groups } from '../src/texts/plugin.mjs';

const SRC = resolve('src');

// The value imports of each source file (not `import type`), as absolute paths.
function importGraph(): Map<string, string[]> {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.ts')) files.push(p);
    }
  };
  walk(SRC);
  const graph = new Map<string, string[]>();
  for (const f of files) {
    const code = readFileSync(f, 'utf8');
    const out: string[] = [];
    for (const m of code.matchAll(/^\s*(?:import|export)\s+(?!type\b)([\s\S]*?)\s+from\s+['"](\.[^'"]+)['"]/gm)) {
      const names = m[1].trim();
      if (/^\{[^}]*\}$/.test(names) && names.replace(/[{}\s]/g, '').split(',').filter(Boolean).every((x) => x.startsWith('type'))) continue;
      out.push(m[2]);
    }
    for (const m of code.matchAll(/^\s*import\s+['"](\.[^'"]+)['"]/gm)) out.push(m[1]);
    graph.set(f, out.map((i) => resolve(dirname(f), i)).map((i) => (i.endsWith('.ts') || i.endsWith('.json') ? i : `${i}.ts`)));
  }
  return graph;
}

describe('The engine families', () => {
  it('stay out of the first visit: the game reaches none of their modules', () => {
    const graph = importGraph();
    const family = new Set(Object.keys(FAMILIES).map((f) => join(SRC, `engine/families/${f}.ts`)));
    // Each family's own command modules (what its module imports from commands/).
    for (const f of [...family]) for (const i of graph.get(f) ?? []) if (i.includes('/engine/commands/')) family.add(i);
    const seen = new Set<string>();
    const stack = [join(SRC, 'element.ts'), join(SRC, 'interface/game.ts')];
    const reached: string[] = [];
    while (stack.length) {
      const f = stack.pop()!;
      // The stories (and their chapters) load later, with their families.
      if (seen.has(f) || /\/engine\/(stories|chapters)\//.test(f)) continue;
      seen.add(f);
      if (family.has(f)) reached.push(relative(SRC, f));
      stack.push(...(graph.get(f) ?? []));
    }
    expect(reached).toEqual([]);
  });

  it('load with the stories that use their commands (each story module imports them)', () => {
    for (const s of STORIES) {
      const code = readFileSync(`src/engine/stories/${s.id}.ts`, 'utf8');
      const imported = [...code.matchAll(/^import '\.\.\/families\/([\w-]+)';/gm)].map((m) => m[1]).sort();
      const listed = s.chapters.flatMap((c) => [...c.commands, ...Object.values(c.hosts ?? {}).flatMap((h) => h.commands ?? [])]);
      const needed = [...new Set(listed.filter((n) => Object.hasOwn(FAMILY_COMMANDS, n)).map((n) => FAMILY_COMMANDS[n][0]))].sort();
      expect(imported, s.id).toEqual(needed);
    }
  });

  it('keep their entries in the table of commands, which runs their implementation', () => {
    for (const f of Object.keys(FAMILIES) as Family[]) {
      expect(familyLoaded(f)).toBe(true);
      const own = familyCommands(f);
      expect(Object.keys(own).length, f).toBeGreaterThan(0);
      for (const [name, c] of Object.entries(own)) {
        expect(FAMILY_COMMANDS[name]?.[0], name).toBe(f);
        const { launch: _, ...entry } = c;
        // The entry, completed by the manual's technical part (pages.ts).
        expect(COMMANDS[name], name).toMatchObject({ ...entry, ...PAGES[name] });
        expect(COMMANDS[name].launch).not.toBe(c.launch);
      }
    }
    // No two families share a command.
    const names = (Object.keys(FAMILIES) as Family[]).flatMap((f) => Object.keys(familyCommands(f)));
    expect(new Set(names).size).toBe(names.length);
  });

  it('are named by the words of a command line (the interface loads them before running it)', () => {
    expect(commandFamilies('ls -l | grep x')).toEqual([]);
    expect(commandFamilies('sudo kubectl get pods && virsh list --all; lpstat -t')).toEqual(['k8s', 'libvirt', 'cups']);
    expect(commandFamilies('echo $(promtool check config /etc/prometheus/prometheus.yml)')).toEqual(['prometheus']);
    // base64 and sleep belong to every story, not to a family.
    expect(commandFamilies('echo hi | base64; sleep 1')).toEqual([]);
    // Its manual needs no family: only a command in a command's place counts.
    expect(commandFamilies('man kubectl; kubectl --help; type virsh')).toEqual(['k8s']);
    expect(commandFamilies('KUBECONFIG=/etc/k.yaml sudo -E kubectl get pods')).toEqual(['k8s']);
    expect(commandFamilies('for i in 1 2; do lpstat -p; done')).toEqual(['cups']);
  });
});

describe('The manual\'s examples', () => {
  it('are apart from the options (examples.ts loads with the manual\'s texts)', () => {
    for (const [name, p] of Object.entries(PAGES)) expect(p, name).not.toHaveProperty('examples');
    expect(EXAMPLES.ls.examples?.length).toBeGreaterThan(0);
    expect(EXAMPLES.ls.see).toContain('cd');
  });
});

describe('The core texts', () => {
  for (const language of ['en', 'fr'])
    it(`${language}: the chapters' titles alone, their summaries and the manual's sentences elsewhere`, () => {
      const g = groups(language) as Record<string, [string, string][]>;
      const core = g.core.map(([, s]) => s).join('\n');
      expect(core).not.toMatch(/^man-summary-/m);
      const titles = g.core.find(([f]) => f === 'chapter titles')![1].split('\n');
      expect(titles.filter((l) => !/^chapter-[\w-]+ = /.test(l))).toEqual([]);
      const summaries = g.summaries[0][1];
      const chapters = STORIES.flatMap((s) => s.chapters.map((c) => c.id));
      for (const id of chapters) {
        expect(titles.some((l) => l.startsWith(`chapter-${id} =`)), id).toBe(true);
        expect(summaries, id).toMatch(new RegExp(`^chapter-${id} =.*\\n\\s+\\.summary = `, 'm'));
      }
    });
});
