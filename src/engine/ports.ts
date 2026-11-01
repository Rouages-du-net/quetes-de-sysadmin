// L'état d'un port TCP d'une machine, vu de la machine elle-même ou de
// l'extérieur : ouvert (un programme écoute et la connexion passe), refusé
// (personne n'écoute, ou ufw rejette), filtré (ufw jette le paquet : délai
// dépassé). Les connexions locales (lo) ne passent pas par ufw. Un port
// publié par Docker sur 0.0.0.0 contourne ufw (voir docker.ts).

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
