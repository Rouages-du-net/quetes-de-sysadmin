// Shared hosting, on the internet: an FTP server (Pure-FTPd, as on cPanel)
// that only accepts encrypted connections now (explicit FTPS: AUTH TLS on
// port 21), with a certificate in the host's name (*.hosting.example), an
// account, and its directory (public_html: the published site). lftp
// connects to it (commands/lftp.ts).
// A hosting's state lives on the workstation (state.hostings), created on
// the first connection from its definition, declared by the story that
// uses it (HOSTINGS).
// Sources: https://lftp.yar.ru/lftp-man.html, https://www.pureftpd.org/project/pure-ftpd/doc/,
// https://www.rfc-editor.org/rfc/rfc4217 (FTP over TLS)

import type { Directory, Node } from './world';
import type { Game } from './shell';
import type { Translate } from '../texts';

export interface HostingDef {
  // The names leading to the server (the host's name, and those of the customers pointing to it).
  names: string[];
  address: string;
  // The names covered by its certificate (*.hosting.example).
  certificate: string[];
  accounts: Record<string, string>;
  // Each account's directory, at the start.
  files: (t: Translate) => Record<string, Directory>;
}

export interface Hosting {
  def: string;
  roots: Record<string, Directory>;
  // Each successful connection: the account, encrypted or not, certificate verified or not.
  log: { account: string; tls: boolean; checked: boolean; send: boolean }[];
}

/** The hostings the stories declare (by server name). */
export const HOSTINGS: Record<string, HostingDef> = {};

export const definition = (name: string): [string, HostingDef] | null => {
  const n = name.toLowerCase();
  const e = Object.entries(HOSTINGS).find(([, d]) => d.names.includes(n) || d.address === n);
  return e ?? null;
};

/** The hosting's state (created on the first connection). */
export function hosting(j: Game, key: string): Hosting {
  const all = (j.state.hostings ??= {}) as Record<string, Hosting>;
  return (all[key] ??= { def: key, roots: HOSTINGS[key].files(j.t), log: [] });
}

/** Does a certificate cover this name? (*: a single level) */
export const covers = (certificate: string[], name: string) =>
  certificate.some((c) => (c.startsWith('*.') ? name.endsWith(c.slice(1)) && !name.slice(0, -c.length + 1).includes('.') : c === name));

// ——— The remote directory's paths ———

export const normalise = (cwd: string, path: string) => {
  const parts = (path.startsWith('/') ? path : `${cwd}/${path}`).split('/');
  const res: string[] = [];
  for (const p of parts) {
    if (!p || p === '.' || p === '~') continue;
    if (p === '..') res.pop();
    else res.push(p);
  }
  return '/' + res.join('/');
};

export function node(root: Directory, path: string): Node | null {
  let n: Node = root;
  for (const p of path.split('/').filter(Boolean)) {
    if (n.type !== 'directory') return null;
    const e: Node | undefined = n.children[p];
    if (!e) return null;
    n = e;
  }
  return n;
}

/** All the files of a remote directory, by relative path, with their contents. */
export function filesFor(root: Directory, path: string): Record<string, string> | null {
  const n = node(root, path);
  if (n?.type !== 'directory') return null;
  const res: Record<string, string> = {};
  const walk = (d: Node, rel: string) => {
    if (d.type === 'directory') for (const [k, e] of Object.entries(d.children)) walk(e, rel ? `${rel}/${k}` : k);
    else res[rel] = typeof d.content === 'string' ? d.content : '';
  };
  walk(n, '');
  return res;
}
