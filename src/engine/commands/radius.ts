// freeradius (radiusd) et radtest (freeradius-utils), sur le serveur RADIUS
// simulé (../radius.ts). Sorties en anglais, comme les vrais outils.
// Sources : https://manpages.debian.org/trixie/freeradius/freeradius.8.en.html,
// https://manpages.debian.org/trixie/freeradius-utils/radtest.1.en.html

import type { Shell } from '../shell';
import { loadRadius, inWorks, readRadius, handle, type Request, type Response } from '../radius';
import type { Command } from './index';

const VERSION = 'FreeRADIUS Version 3.2.7';

// Une réponse comme radclient l'affiche : « Received Access-Accept … », puis les attributs.
function received(r: Response, id: number, forEachOf: string, to: string): string[] {
  const type = r.what === 'accept' ? 'Access-Accept' : 'Access-Reject';
  const length = 20 + r.attributes.reduce((t, a) => t + 3 + a.value.length, 0);
  return [
    `Received ${type} Id ${id} from ${forEachOf}:1812 to ${to} length ${length}`,
    ...r.attributes.map(
      (a) =>
        `\t${a.attr.includes(':') ? a.attr : `${a.attr}:0`} = ${/^\d+$|^VLAN$|^IEEE-802$/.test(a.value) && !a.attr.startsWith('Tunnel-Private') ? a.value : `"${a.value}"`}`,
    ),
  ];
}

function radtest(game: Shell, args: string[]): string {
  const rest = args.filter((a) => !a.startsWith('-'));
  if (rest.length < 5) return game.error(game.t('radtest-usage'), 1);
  const [user, password, server, port, secret] = rest;
  const id = 154;
  const send = [
    `Sent Access-Request Id ${id} from 0.0.0.0:46327 to 127.0.0.1:1812 length ${77 + user.length}`,
    `\tUser-Name = "${user}"`,
    `\tUser-Password = "${password}"`,
    '\tNAS-IP-Address = 127.0.1.1',
    `\tNAS-Port = ${port}`,
    '\tMessage-Authenticator = 0x00',
    `\tCleartext-Password = "${password}"`,
  ];
  const local = ['localhost', '127.0.0.1', game.host].includes(server.split(':')[0]);
  const d: Request = { client: '127.0.0.1', iif: 'lo', secret, user, password };
  const r: Response = local ? handle(game, d) : { what: 'rien', attributes: [], log: [] };
  if (r.what === 'rien') {
    game.status = 1;
    return [...send, ...[1, 2].flatMap(() => send), `(0) No reply from server for ID ${id} socket 3`].join('\n');
  }
  const lines = [...send, ...received(r, id, '127.0.0.1', '127.0.0.1:46327')];
  if (r.what === 'reject') {
    lines.push('(0) -: Expected Access-Accept got Access-Reject');
    game.status = 1;
  }
  return lines.join('\n');
}

function freeradius(game: Shell, args: string[]): string {
  if (args.includes('-v')) return `radiusd: ${VERSION}, for host x86_64-pc-linux-gnu, built on Jan 10 2025 at 08:00:00`;
  const debug = args.some((a) => /^-[a-zA-Z]*X/.test(a));
  const check = args.some((a) => /^-[a-zA-Z]*C/.test(a));
  if (!debug && !check) return game.error(game.t('freeradius-usage'), 1);
  if (game.who !== 'root') return game.error(`Errors reading ${'/etc/freeradius/3.0'}: Permission denied`, 1);
  const { errors } = readRadius(game);
  const start = [VERSION, 'Copyright (C) 1999-2025 The FreeRADIUS server project and contributors', 'Starting - reading configuration files ...'];
  if (errors.length) return game.error([...start, ...errors].join('\n'), 1);
  if (check) return [...start, 'Configuration appears to be OK'].join('\n');
  if (inWorks(game))
    return game.error(
      [
        ...start,
        'Failed binding to auth address * port 1812 bound to server default: Address already in use',
        '/etc/freeradius/3.0/sites-enabled/default[59]: Error binding to port for 0.0.0.0 port 1812',
      ].join('\n'),
      1,
    );
  // radiusd -X : la configuration lue, puis les demandes des bornes traitées une à une.
  const before = game.state.radius;
  loadRadius(game);
  const conf = game.state.radius.conf;
  game.state.radius = before;
  const requests: Request[] = game.state.radiusDemandes ?? [];
  const lines = [...start, 'Listening on auth address * port 1812 bound to server default', 'Ready to process requests'];
  requests.forEach((d, i) => {
    const r = handle(game, d, { conf, works: true });
    lines.push(
      `(${i}) Received Access-Request Id ${40 + i} from ${d.client}:41234 to 10.10.30.1:1812 length 120`,
      `(${i})   User-Name = "${d.user}"`,
    );
    lines.push(...r.log.map((l) => (l.startsWith('(') ? l.replace(/^\(0\)/, `(${i})`) : `(${i}) ${l.replace(/^Auth: \(0\) /, '')}`)));
    if (r.what !== 'rien')
      lines.push(
        `(${i}) Sent ${r.what === 'accept' ? 'Access-Accept' : 'Access-Reject'} Id ${40 + i} from 10.10.30.1:1812 to ${d.client}:41234 length 0`,
        ...r.attributes.map((a) => `(${i})   ${a.attr} = ${a.value}`),
      );
  });
  lines.push('', game.t('freeradius-x-end'));
  return lines.join('\n');
}

export const RADIUS: Record<string, Command> = {
  freeradius: { section: 8, ownOptions: true, launch: ({ args, game }) => freeradius(game, args) },
  radtest: { ownOptions: true, launch: ({ args, game }) => radtest(game, args) },
};
