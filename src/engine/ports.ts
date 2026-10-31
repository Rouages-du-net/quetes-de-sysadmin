// L'état d'un port TCP d'une machine, vu de la machine elle-même ou de
// l'extérieur : ouvert (un programme écoute et la connexion passe), refusé
// (personne n'écoute, ou ufw rejette), filtré (ufw jette le paquet : délai
// dépassé). Les connexions locales (lo) ne passent pas par ufw. Un port
// publié par Docker sur 0.0.0.0 contourne ufw (voir docker.ts).

import type { Jeu } from './shell';
import { verdict, type PareFeu } from './firewall';
import { ecoutesDocker, publieAuMonde } from './docker';
import type { Ecoute } from './commands/ss';

export type EtatPort = 'ouvert' | 'refuse' | 'filtre';

export function etatPort(jeu: Jeu, port: number, local: boolean, source: string): EtatPort {
  const ecoutes: Ecoute[] = [...(jeu.etat.ecoute ?? []), ...ecoutesDocker(jeu)].filter((e) => e.proto === 'tcp' && e.port === port);
  const surToutes = ecoutes.some((e) => e.adresse === '0.0.0.0' || e.adresse === '[::]' || e.adresse === '*');
  if (local) return ecoutes.length ? 'ouvert' : 'refuse';
  if (publieAuMonde(jeu, port)) return 'ouvert';
  const pf: PareFeu | undefined = jeu.etat.ufw;
  const passe = pf ? verdict(pf, port, source) : 'accepte';
  if (passe === 'bloque') return 'filtre';
  if (passe === 'refuse') return 'refuse';
  return surToutes ? 'ouvert' : 'refuse';
}
