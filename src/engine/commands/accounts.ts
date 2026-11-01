// Comptes et groupes : id, groups (coreutils), chgrp, chown (coreutils),
// usermod, userdel, gpasswd, chage (shadow-utils). Sources : https://man7.org/linux/man-pages/man1/id.1.html,
// https://man7.org/linux/man-pages/man1/chown.1.html,
// https://man7.org/linux/man-pages/man8/usermod.8.html,
// https://man7.org/linux/man-pages/man8/userdel.8.html, https://man7.org/linux/man-pages/man1/gpasswd.1.html,
// https://man7.org/linux/man-pages/man1/chage.1.html
// Règles réelles : seul root change le propriétaire ; le propriétaire d'un
// fichier peut en changer le groupe pour un groupe dont il est membre ;
// usermod -G remplace les groupes secondaires, usermod -aG en ajoute.

import type { Node } from '../world';
import type { Shell } from '../shell';
import { options } from '../tools';
import type { Command } from './index';

// « 1000(vous) »
const withNumber = (name: string, number: number | undefined) => `${number ?? '?'}(${name})`;

// Applique une modification à une cible, et à tout son contenu avec -R.
function forEach(n: Node, recursive: boolean, run: (n: Node) => void) {
  run(n);
  if (recursive && n.type === 'dossier') for (const e of Object.values(n.children)) forEach(e, true, run);
}

// Les cibles de chown et chgrp : vérifie l'accès, puis applique `faire`.
function change(game: Shell, command: string, targets: string[], recursive: boolean, allowed: (n: Node) => boolean, run: (n: Node) => void) {
  for (const target of targets) {
    const n = game.find(target);
    if (!n) game.error(game.t('error-access-missing', { command: command, target: target }));
    else if (!game.traverses(target)) game.error(game.t('error-access-permission', { command: command, target: target }));
    else if (!allowed(n)) game.error(game.t(`${command}-not-allowed`, { target: target }));
    else forEach(n, recursive, run);
  }
  return '';
}

export const ACCOUNTS: Record<string, Command> = {
  id: {
    launch: ({ args, game }) => {
      const name = args[0] ?? game.who;
      const u = game.accounts.users[name];
      if (!u) return game.error(game.t('id-missing', { user: name }));
      const gid = (g: string) => game.accounts.groups[g]?.gid;
      return game.t('id-line', {
        uid: withNumber(name, u.uid),
        gid: withNumber(u.group, gid(u.group)),
        groups: game.groupsFor(name).map((g) => withNumber(g, gid(g))).join(','),
      });
    },
  },

  groups: {
    launch: ({ args, game }) => {
      if (!args.length) return game.groupsFor(game.who).join(' ');
      return args
        .map((name) =>
          game.accounts.users[name] ? `${name} : ${game.groupsFor(name).join(' ')}` : game.error(game.t('groups-missing', { user: name })),
        )
        .filter(Boolean)
        .join('\n');
    },
  },

  chgrp: {
    launch: ({ args, game }) => {
      const { letters, rest } = options(args);
      const [group, ...targets] = rest;
      if (!group || !targets.length) return game.error(game.t('chgrp-usage'));
      if (!game.accounts.groups[group]) return game.error(game.t('chgrp-group-incorrect', { group: group }));
      const allowed = (n: Node) => game.who === 'root' || ((n.owner ?? game.player) === game.who && game.groupsFor(game.who).includes(group));
      return change(game, 'chgrp', targets, letters.has('R'), allowed, (n) => (n.group = group));
    },
  },

  chown: {
    launch: ({ args, game }) => {
      const { letters, rest } = options(args);
      const [owner, ...targets] = rest;
      if (!owner || !targets.length) return game.error(game.t('chown-usage'));
      // Un numéro (uid, gid) est accepté même sans compte qui le porte : ls -l l'affiche alors tel quel.
      const byUid = (x: string) => Object.entries(game.accounts.users).find(([, u]) => String(u.uid) === x)?.[0] ?? x;
      const byGid = (x: string) => Object.entries(game.accounts.groups).find(([, g]) => String(g.gid) === x)?.[0] ?? x;
      const [nameRaw, groupRaw] = owner.split(':');
      const name = nameRaw && /^\d+$/.test(nameRaw) ? byUid(nameRaw) : nameRaw;
      const group = groupRaw && /^\d+$/.test(groupRaw) ? byGid(groupRaw) : groupRaw;
      if (name && !/^\d+$/.test(name) && !game.accounts.users[name]) return game.error(game.t('chown-user-incorrect', { owner: owner }));
      if (group && !/^\d+$/.test(group) && !game.accounts.groups[group]) return game.error(game.t('chown-group-incorrect', { owner: owner }));
      // « chown malo: f » : le groupe principal de malo.
      const newGroup = group || (owner.endsWith(':') && name ? (game.accounts.users[name]?.group ?? name) : undefined);
      return change(game, 'chown', targets, letters.has('R'), () => game.who === 'root', (n) => {
        if (name) n.owner = name;
        if (newGroup) n.group = newGroup;
      });
    },
  },

  usermod: {
    launch: ({ args, game }) => {
      let addition = false;
      let listing: string | null = null;
      let lock: boolean | null = null;
      let expires: string | null = null;
      let shell: string | null = null;
      const rest: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (/^-[a-zA-Z]+$/.test(a)) {
          if (a.includes('a')) addition = true;
          // -L verrouille le mot de passe (un « ! » devant son empreinte dans /etc/shadow), -U le déverrouille.
          if (a.includes('L')) lock = true;
          if (a.includes('U')) lock = false;
          if (a.includes('G')) listing = args[++i] ?? '';
          // -e : date de fin de validité du compte (AAAA-MM-JJ, ou 1 : le 2 janvier 1970) ; -s : le shell de connexion.
          if (a.includes('e')) expires = args[++i] ?? '';
          if (a.includes('s')) shell = args[++i] ?? '';
        } else rest.push(a);
      }
      const name = rest[0];
      if (!name || (listing === null && lock === null && expires === null && shell === null))
        return game.error(game.t(addition && listing === null ? 'usermod-a-without-G' : 'usermod-usage'));
      if (addition && listing === null) return game.error(game.t('usermod-a-without-G'));
      if (game.who !== 'root') return game.error(game.t('usermod-permission'));
      const u = game.accounts.users[name];
      if (!u) return game.error(game.t('usermod-user-missing', { user: name }));
      let date: string | undefined;
      if (expires !== null && expires !== '') {
        date = dateExpiration(expires) ?? undefined;
        if (!date) return game.error(game.t('usermod-date-invalid', { date: expires }));
      }
      if (listing !== null) {
        const groups = listing.split(',').filter(Boolean);
        const unknown = groups.find((g) => !game.accounts.groups[g]);
        if (unknown) return game.error(game.t('usermod-group-missing', { group: unknown }));
        // Sans -a, les groupes secondaires sont REMPLACÉS par la liste.
        if (!addition) for (const g of Object.values(game.accounts.groups)) g.members = g.members.filter((m) => m !== name);
        for (const g of groups) if (!game.accounts.groups[g].members.includes(name)) game.accounts.groups[g].members.push(name);
      }
      if (lock !== null) {
        const locks: string[] = (game.state.lockedAccounts ??= []);
        game.state.lockedAccounts = lock ? [...new Set([...locks, name])] : locks.filter((v) => v !== name);
      }
      if (expires !== null) {
        if (date) u.expires = date;
        else delete u.expires;
      }
      if (shell !== null) u.shell = shell;
      return '';
    },
  },

  // userdel : supprime un compte (et, avec -r, son dossier personnel et sa boîte aux lettres).
  userdel: {
    launch: ({ args, game }) => {
      const { letters, rest } = options(args);
      const name = rest[0];
      if (!name) return game.error(game.t('userdel-usage'));
      if (game.who !== 'root') return game.error(game.t('userdel-permission'));
      const u = game.accounts.users[name];
      if (!u) return game.error(game.t('userdel-missing', { user: name }), 6);
      // Un compte encore utilisé par un processus n'est pas supprimé (sauf -f).
      const p = ((game.state.process ?? []) as { pid: number; user: string }[]).find((x) => x.user === name);
      if (p && !letters.has('f')) return game.error(game.t('userdel-used', { user: name, pid: String(p.pid) }), 8);
      delete game.accounts.users[name];
      for (const g of Object.values(game.accounts.groups)) g.members = g.members.filter((m) => m !== name);
      // Son groupe personnel (même nom) part aussi, s'il n'a pas d'autre membre.
      if (game.accounts.groups[u.group] && u.group === name && !game.accounts.groups[name].members.length) delete game.accounts.groups[name];
      if (letters.has('r')) {
        const home = u.home ?? `/home/${name}`;
        const output: string[] = [];
        if (game.exists(home)) game.erase(home);
        if (game.exists(`/var/mail/${name}`)) game.erase(`/var/mail/${name}`);
        else output.push(game.t('userdel-without-mail', { user: name }));
        return output.join('\n');
      }
      return '';
    },
  },

  // gpasswd -a / -d : ajoute ou retire un compte d'un groupe.
  gpasswd: {
    launch: ({ args, game }) => {
      const i = args.findIndex((a) => a === '-a' || a === '-d');
      const name = args[i + 1];
      const group = args.filter((_, k) => k !== i && k !== i + 1)[0];
      if (i < 0 || !name || !group) return game.error(game.t('gpasswd-usage'), 2);
      if (game.who !== 'root') return game.error(game.t('gpasswd-permission'), 1);
      const g = game.accounts.groups[group];
      if (!g) return game.error(game.t('gpasswd-group-missing', { group: group }), 3);
      if (!game.accounts.users[name]) return game.error(game.t('gpasswd-user-missing', { user: name }), 3);
      if (args[i] === '-a') {
        if (!g.members.includes(name)) g.members.push(name);
        return game.t('gpasswd-addition', { user: name, group: group });
      }
      if (!g.members.includes(name)) return game.error(game.t('gpasswd-not-member', { user: name, group: group }), 3);
      g.members = g.members.filter((m) => m !== name);
      return game.t('gpasswd-indent', { user: name, group: group });
    },
  },

  // chage -l (les dates du compte) et -E (sa fin de validité).
  chage: {
    launch: ({ args, game }) => {
      const i = args.indexOf('-E');
      const listing = args.includes('-l');
      const name = args.filter((a, k) => !a.startsWith('-') && (i < 0 || k !== i + 1)).at(-1);
      if (!name || (i < 0 && !listing)) return game.error(game.t('chage-usage'), 2);
      const u = game.accounts.users[name];
      if (!u) return game.error(game.t('chage-missing', { user: name }), 1);
      if (listing && i < 0) {
        if (game.who !== 'root' && game.who !== name) return game.error(game.t('chage-permission'), 1);
        return game.t('chage-list', { expire: u.expires ?? 'never' });
      }
      if (game.who !== 'root') return game.error(game.t('chage-permission'), 1);
      const value = args[i + 1] ?? '';
      if (value === '-1') delete u.expires;
      else {
        const date = value === '0' ? '1970-01-01' : dateExpiration(value);
        if (!date) return game.error(game.t('chage-date-invalid', { date: value }), 2);
        u.expires = date;
      }
      return '';
    },
  },
};

// Une date de fin de validité : AAAA-MM-JJ, ou un nombre de jours depuis le 1er janvier 1970.
function dateExpiration(text: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text))) return text;
  if (/^\d+$/.test(text)) return new Date(Number(text) * 86_400_000).toISOString().slice(0, 10);
  return null;
}
