// The state of a machine's TCP port, seen from the machine itself or from
// outside: open (a program listens and the connection goes through),
// refused (nobody listens, or ufw rejects), filtered (ufw drops the packet:
// timeout). Local connections (lo) don't go through ufw. A port published
// by Docker on 0.0.0.0 bypasses ufw (see docker.ts).

import type { Game } from './shell';
import { verdict, type Firewall } from './firewall';
import { dockerListeners, publishedToWorld } from './docker';
import type { Listening } from './commands/ss';

export type PortState = 'open' | 'refused' | 'filtered';

export function portState(game: Game, port: number, local: boolean, source: string): PortState {
  const listeners: Listening[] = [...(game.state.listening ?? []), ...dockerListeners(game)].filter((e) => e.proto === 'tcp' && e.port === port);
  const onAll = listeners.some((e) => e.address === '0.0.0.0' || e.address === '[::]' || e.address === '*');
  if (local) return listeners.length ? 'open' : 'refused';
  if (publishedToWorld(game, port)) return 'open';
  const pf: Firewall | undefined = game.state.ufw;
  const pass = pf ? verdict(pf, port, source) : 'accepted';
  if (pass === 'blocked') return 'filtered';
  if (pass === 'refused') return 'refused';
  return onAll ? 'open' : 'refused';
}
