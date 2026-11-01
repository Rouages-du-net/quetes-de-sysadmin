// The map of the machine you're on: the places (directories) you know,
// as a tree from the root, with where you are. To give nothing
// away, it only shows the places you've entered (cd), the
// path leading to them, and the places you can glimpse from them (their
// visible subdirectories); a hidden place (.name) only appears once
// visited. Neither files, nor what is inside the places only glimpsed.

import type { Directory } from './world';
import type { Shell } from './shell';

export interface Place {
  name: string;
  path: string;
  // You've entered it; you're in it; it's home (~); you can't enter it yet.
  visit: boolean;
  here: boolean;
  home: boolean;
  closed: boolean;
  children: Place[];
}

const parents = (path: string) => {
  const chunks = path.split('/').filter(Boolean);
  return chunks.map((_, i) => '/' + chunks.slice(0, i + 1).join('/'));
};

/** The session's map: the tree of known places, from the root (/). */
export function map(sh: Shell): Place {
  // The places visited, and the whole path leading to them (you went through it).
  const walked = new Set<string>(['/']);
  for (const v of [...sh.visits, sh.cwd]) for (const p of parents(v)) walked.add(p);
  const place = (name: string, path: string, d: Directory, showChildren: boolean): Place => {
    const children = showChildren
      ? Object.entries(d.children)
          .filter(([n, e]) => e.type === 'directory' && (!n.startsWith('.') || walked.has(`${path === '/' ? '' : path}/${n}`)))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([n, e]) => {
            const c = `${path === '/' ? '' : path}/${n}`;
            return place(n, c, e as Directory, walked.has(c));
          })
      : [];
    return {
      name,
      path,
      visit: walked.has(path),
      here: path === sh.cwd,
      home: path === sh.home,
      closed: !!d.blocked?.(sh),
      children,
    };
  };
  // A visited place shows its subdirectories; so does a place passed through (you saw them on the way).
  return place('/', '/', sh.root, true);
}
